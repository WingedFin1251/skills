// style_audit.js — Code style & project structure auditor (v1.5)
// Detects: sentinel assignments (B16), EXTI wrong file (B17), file-scope global i/j/k
// Usage: node style_audit.js <target-dir>

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['drivers', 'middlewares', '.git', 'node_modules', 'build', 'debug', 'release', '.vscode'];
const SORT_KEYWORDS = /\b(sort|partition|qsort|qusort|quick|pivot|swap)\b/i;

function collectFiles(dirOrDirs, results = []) {
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !IGNORE_DIRS.includes(e.name.toLowerCase())) collectFiles(full, results);
            else if (e.isFile() && /\.(c|cpp)$/i.test(e.name)) results.push(full);
        }
    }
    return results;
}

function hasContext(lines, idx, keywords, range = 10) {
    const start = Math.max(0, idx - range);
    const end = Math.min(lines.length, idx + range + 1);
    for (let i = start; i < end; i++) {
        if (keywords.test(lines[i])) return true;
    }
    return false;
}

function detectSentinelAssignments(strippedContent, filePath) {
    const issues = [];
    const lines = strippedContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/(\w+)\[(\d+)\]\s*=\s*\w+\[\s*[^\]]+\]/);
        if (m && m[2] === '0' && hasContext(lines, i, SORT_KEYWORDS)) {
            issues.push({
                id: 'B16',
                pattern: 'sentinel_assignment',
                severity: 'MEDIUM',
                file: filePath,
                line: i + 1,
                detail: `${m[1]}[0] = ${m[1]}[...] in sort/search context — potential sentinel misuse`
            });
        }
    }
    return issues;
}

function detectEXTIFilePlacement(strippedContent, filePath) {
    const issues = [];
    const fileName = path.basename(filePath);
    if (/^(bsp_exti|exti|stm32.*it|gpio)/i.test(fileName)) return issues;

    // Match EXTI-specific init functions
    const hasEXTIInit = /\b(HAL_EXTI_Init|EXTI_Init)\s*\(/.test(strippedContent);
    // Use \w+ to support EXTI9_5_IRQn and cross-line calls
    const hasEXTIPriority = /\bHAL_NVIC_SetPriority\s*\(\s*EXTI\w+_IRQn/.test(strippedContent);

    if (hasEXTIInit || hasEXTIPriority) {
        issues.push({
            id: 'B17',
            pattern: 'exti_wrong_file',
            severity: 'MEDIUM',
            file: filePath,
            line: 1,
            detail: `EXTI/NVIC init in ${fileName}, expected in bsp_exti.c or gpio.c`
        });
    }
    return issues;
}

function detectFileScopeGlobals(rawContent, strippedContent, filePath) {
    const issues = [];
    const strippedLines = strippedContent.split('\n');
    const rawLines = rawContent.split('\n');

    let braceDepth = 0;
    for (let i = 0; i < rawLines.length; i++) {
        const cleanLine = strippedLines[i];
        if (cleanLine === undefined) continue;

        const opens = (cleanLine.match(/{/g) || []).length;
        const closes = (cleanLine.match(/}/g) || []).length;

        if (braceDepth === 0) {
            const lineToCheck = cleanLine.trim();
            if (lineToCheck && !lineToCheck.startsWith('#')) {
                // Support const/volatile/unsigned prefixes, pointer (*), exclude typedef/extern
                // Match non-static globals: single or comma-separated (int i, j, k;)
                const declRe = /^(?!.*static)(?!.*typedef)(?!.*extern)\s*(?:volatile\s+|const\s+|unsigned\s+)*(int|float|char|double|u8|u16|u32|uint8_t|uint16_t|uint32_t|bool)\s*\**\s*/;
                const m = lineToCheck.match(declRe);
                if (m) {
                    // After the type prefix, extract all variable names: i, j, k or buf[256] or temp
                    const rest = lineToCheck.slice(m[0].length);
                    const varRe = /\b(i|j|k|cnt|temp|buf|ret|tmp)\s*[=;\[,]/g;
                    let vm;
                    while ((vm = varRe.exec(rest)) !== null) {
                        issues.push({
                            id: 'B15',
                            pattern: 'file_scope_global',
                            severity: 'HIGH',
                            file: filePath,
                            line: i + 1,
                            detail: `Non-static global '${vm[1]}' at file scope — should be static`
                        });
                    }
                }
            }
        }

        braceDepth += (opens - closes);
    }
    return issues;
}

function stripContent(content) {
    // Strip strings first, then comments — preserving newlines in block comments
    return content
        .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
        .replace(/'(?:\\.|[^'\\\n])*'/g, "''")
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
        .replace(/\/\/.*/g, '');
}

function main(dir) {
    const files = collectFiles(dir);
    const issues = [];
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf-8');
        const stripped = stripContent(content);
        issues.push(...detectSentinelAssignments(stripped, f));
        issues.push(...detectEXTIFilePlacement(stripped, f));
        issues.push(...detectFileScopeGlobals(content, stripped, f));
    }
    return issues;
}

const targetDir = process.argv[2] || '.';
console.error(`[style_audit] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
