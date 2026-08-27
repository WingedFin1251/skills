const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['drivers', 'middlewares', '.git', 'node_modules', 'build', 'debug', 'release', 'cmake-build-debug', 'out'];
const DEPRECATED_APIS = /\b(sprintf|strcpy|strcat|gets)\s*\(/g;

function collectFiles(dirOrDirs) {
    const results = [];
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !IGNORE_DIRS.includes(e.name.toLowerCase())) results.push(...collectFiles(full));
            else if (e.isFile() && /\.(c|cpp|h|hpp)$/i.test(e.name)) results.push(full);
        }
    }
    return results;
}

function stripComments(content) {
    return content
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
        .replace(/\/\/.*/g, '');
}

function isVariadic(content, macroName) {
    // Check all files (not just headers) for variadic macro definition
    const re = new RegExp('#define\\s+' + macroName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\([^)]*\\.\\.\\.');
    return re.test(content);
}

function main(dir) {
    const files = collectFiles(dir);
    // Build concatenated content of ALL files for variadic detection (comment-stripped)
    const allContent = files.map(f => { try { return stripComments(fs.readFileSync(f, 'utf-8')); } catch(e) { return ''; } }).join('\n');

    const callStats = {};
    const issues = [];

    for (const f of files) {
        if (/\.(h|hpp)$/i.test(f)) continue;
        const raw = fs.readFileSync(f, 'utf-8');
        const content = stripComments(raw);
        const lines = content.split('\n');

        // B34: Only match ALL_CAPS macros to avoid C++ overload false positives
        const macroRe = /\b([A-Z][A-Z0-9_]{2,})\s*\(([^)]*)\)/g;
        let m;
        while ((m = macroRe.exec(content)) !== null) {
            const name = m[1];
            if (/^(true|false|NULL|NULLPTR|__FILE__|__LINE__|__DATE__)$/i.test(name)) continue;
            if (isVariadic(allContent, name)) continue;
            // Skip #define lines (macro definition, not a call) — handle # spaces
            const lineStart = content.lastIndexOf('\n', m.index) + 1;
            const lineText = content.substring(lineStart, m.index).trim();
            if (/^#\s*define/.test(lineText)) continue;
            // Skip function pointer: lineText ends with (*, or 20-char prefix has (* (cross-line)
            if (/\(\s*\*\s*$/.test(lineText)) continue;
            const prefix = content.substring(Math.max(0, m.index - 20), m.index);
            if (/\(\s*\*\s*$/.test(prefix)) continue;
            const argsStr = m[2];
            // Skip if args contain nested parens (regex truncated by [^)]*)
            if (argsStr.includes('(')) continue;
            // Handle empty args: MY_MACRO() → 0 args, not 1 ("" split)
            const args = argsStr.trim() === '' ? 0 : argsStr.split(',').length;
            if (!callStats[name]) callStats[name] = {};
            if (!callStats[name][args]) callStats[name][args] = [];
            const lineNum = content.substring(0, m.index).split('\n').length;
            callStats[name][args].push(f + ':' + lineNum);
        }

        // B35: Deprecated API detection (exclude C++ member calls like obj.sprintf)
        let inMacro = false;
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (inMacro) {
                inMacro = trimmed.endsWith('\\');
                if (inMacro) continue; // still inside macro, skip
                // else: macro ended, fall through to detect this line
            }
            if (trimmed.startsWith('//') || trimmed.startsWith('#')) {
                inMacro = trimmed.startsWith('#') && trimmed.endsWith('\\');
                continue;
            }
            const matches = [...lines[i].matchAll(DEPRECATED_APIS)];
            for (const m of matches) {
                // Exclude if preceded by '.', '->', or '::' (C++ member/namespace/ptr call)
                const prefix = lines[i].substring(0, m.index);
                if (/(?:\.|->|::)\s*$/.test(prefix)) continue;
                issues.push({
                    id: 'B35', severity: 'HIGH', pattern: 'deprecated_api',
                    file: f, line: i + 1,
                    detail: "Deprecated API '" + m[1] + "' — use safer alternative"
                });
            }
        }
    }

    for (const [name, arities] of Object.entries(callStats)) {
        const arityKeys = Object.keys(arities);
        if (arityKeys.length > 1) {
            const locs = Object.entries(arities)
                .map(([arity, locs]) => arity + ' args: ' + locs.join(', '))
                .join('; ');
            issues.push({
                id: 'B34', severity: 'CRITICAL', pattern: 'macro_arity_mismatch',
                file: '.', line: 1,
                detail: "Macro '" + name + "' called with inconsistent arg counts: " + locs
            });
        }
    }

    return issues;
}

const targetDir = process.argv[2] || '.';
console.error('[api_style_audit] Scanning ' + targetDir + '...');
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
