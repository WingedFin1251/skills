// stack_depth_audit.js — ISR stack depth estimator
// For each *_IRQHandler, estimate stack usage from local variables
// and called functions. Flags when depth exceeds thresholds.
// Includes nesting risk multiplier for nested interrupt patterns.

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['drivers', 'middlewares', '.git', 'node_modules', 'build', 'debug', 'release', '.vscode'];
const STACK_THRESHOLD_HIGH = 512;
const STACK_THRESHOLD_MED = 256;
const NESTING_PATTERNS = [/NVIC_SetPendingIRQ/, /__enable_irq\(\)/, /HAL_NVIC_SetPendingIRQ/];

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

function extractFunctionBodies(content) {
    const funcs = [];
    const re = /(?:[\w\s\*]+?)\b(\w+)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const name = m[1];
        if (!name.endsWith('_IRQHandler')) continue;
        const start = m.index;
        let depth = 1, pos = re.lastIndex;
        while (depth > 0 && pos < content.length) {
            if (content[pos] === '{') depth++;
            else if (content[pos] === '}') depth--;
            pos++;
        }
        funcs.push({ name, body: content.slice(start, pos), startLine: content.slice(0, start).split('\n').length });
    }
    return funcs;
}

function estimateStack(body) {
    let total = 0;
    // Unified regex — covers all C local variable types, no double count
    const typeMap = {
        double: 8, float: 4, int32_t: 4, uint32_t: 4, int16_t: 2, uint16_t: 2,
        int8_t: 1, uint8_t: 1, char: 1, u8: 1, u16: 2, int: 4, unsigned: 4
    };
    const varRe = /(double|float|int32_t|uint32_t|int16_t|uint16_t|int8_t|uint8_t|char|u8|u16|int|unsigned)\s+\w+(?:\[\s*(\d+)\s*\])?/g;
    let m;
    while ((m = varRe.exec(body)) !== null) {
        const count = m[2] ? parseInt(m[2]) : 1;
        const size = typeMap[m[1]] || 4;
        total += size * count;
    }
    // Function calls: each call ~8 bytes for return address + frame
    const callCount = (body.match(/\b\w+\(/g) || []).length;
    total += callCount * 8;
    return total;
}

function main(dir) {
    const files = collectFiles(dir);
    const risks = [];
    for (const f of files) {
        const raw = fs.readFileSync(f, 'utf-8');
        const content = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments
        const isrs = extractFunctionBodies(content);
        for (const isr of isrs) {
            const depth = estimateStack(isr.body);
            const hasNesting = NESTING_PATTERNS.some(p => p.test(isr.body));
            const adjustedDepth = hasNesting ? Math.round(depth * 1.5) : depth;

            if (adjustedDepth > STACK_THRESHOLD_MED) {
                risks.push({
                    context: `${isr.name} (${path.basename(f)})`,
                    severity: adjustedDepth > STACK_THRESHOLD_HIGH ? 'HIGH' : 'MEDIUM',
                    estimated_depth_bytes: adjustedDepth,
                    reason: hasNesting
                        ? `Est. ${depth} bytes ×1.5 nesting factor = ${adjustedDepth} bytes [NESTING_RISK]`
                        : `Est. ${adjustedDepth} bytes from locals + calls`,
                    file: f,
                    line: isr.startLine
                });
            }
        }
    }
    return risks;
}

const targetDir = process.argv[2] || '.';
console.error(`[stack_depth] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
