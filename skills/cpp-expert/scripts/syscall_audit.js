const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['drivers', 'middlewares', '.git', 'node_modules', 'build', 'debug', 'release', 'cmake-build-debug', 'out'];

function collectFiles(dirOrDirs) {
    const results = [];
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !IGNORE_DIRS.includes(e.name.toLowerCase())) results.push(...collectFiles(full));
            else if (e.isFile() && /\.(c|cpp)$/i.test(e.name)) results.push(full);
        }
    }
    return results;
}

function stripContent(content) {
    return content
        .replace(/"(?:\\.|[^"\\])*"/g, '""')
        .replace(/'(?:\\.|[^'\\])*'/g, "''")
        .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
        .replace(/\/\/.*/g, '');
}

function main(dir) {
    const files = collectFiles(dir);
    const issues = [];
    let forkCount = 0, waitpidCount = 0;
    const forkFiles = new Set(), waitpidFiles = new Set();
    const dlopenReported = new Set();
    let hasSigIgn = false, hasBulkReap = false;

    for (const f of files) {
        const raw = fs.readFileSync(f, 'utf-8');
        const stripped = stripContent(raw);
        if (!hasSigIgn && (/signal\s*\(\s*SIGCHLD\s*,\s*SIG_IGN\s*\)/.test(stripped) ||
            (/\bsigaction\s*\(\s*SIGCHLD\b/.test(stripped) && /\bsa_handler\s*=\s*SIG_IGN\b/.test(stripped)))) hasSigIgn = true;
        const strippedLines = stripped.split('\n');

        for (let i = 0; i < strippedLines.length; i++) {
            const line = strippedLines[i];

            // B31: Unchecked I/O — fwrite must be inside control-flow condition to be checked
            const ioMatch = line.match(/\b(fwrite|fread|chmod)\s*\(/);
            if (ioMatch) {
                const context = strippedLines.slice(Math.max(0, i - 3), i + 1).join('\n');
                // hasAssignment: check for `=` before func with unclosed parens (covers all ops/casts)
                const eqIdx = context.indexOf('=');
                const hasAssignment = /=\s*[\s\S]*?\b(fwrite|fread|chmod)\s*\(/.test(context) && !/==\s*[\s\S]*?\b(fwrite|fread|chmod)\s*\(/.test(context);
                const hasVoidCast = /\(\s*void\s*\)\s*(fwrite|fread|chmod)\s*\(/.test(context);
                // fwrite inside condition: check parens balance in PREFIX only
                const prefix = line.substring(0, ioMatch.index);
                const pOpen = (prefix.match(/\(/g) || []).length;
                const pClose = (prefix.match(/\)/g) || []).length;
                const inCondition = /\b(if|while|for|switch|return)\b/.test(prefix) && pOpen > pClose;
                // Multi-line condition: find LAST control keyword, count parens from there
                const multiLineContext = strippedLines.slice(Math.max(0, i - 5), i).join('\n');
                // Match last control keyword and everything after it
                const ctrlMatch = multiLineContext.match(/[\s\S]*\b(if|while|for|switch|return)\b([\s\S]*)$/i);
                const inMultilineCondition = ctrlMatch !== null &&
                    ((ctrlMatch[2].match(/\(/g) || []).length > (ctrlMatch[2].match(/\)/g) || []).length);
                if (!inCondition && !inMultilineCondition && !hasAssignment && !hasVoidCast) {
                    issues.push({
                        id: 'B31', severity: 'HIGH', pattern: 'unchecked_io',
                        file: f, line: i + 1,
                        detail: line.match(/\b(fwrite|fread|chmod)\b/)[1] + ' return unchecked'
                    });
                }
            }
            // B32: Non-blocking waitpid without retry loop (cross-line via [\s\S]*?)
            const waitpidContext = strippedLines.slice(Math.max(0, i - 1), i + 3).join('\n');
            if (/waitpid\s*\([\s\S]*?WNOHANG/.test(waitpidContext)) {
                const ctx = strippedLines.slice(Math.max(0, i - 10), i + 6).join(' ');
                if (!/\b(for|while|do)\b/.test(ctx)) {
                    issues.push({
                        id: 'B32', severity: 'HIGH', pattern: 'zombie_risk',
                        file: f, line: i + 1,
                        detail: 'Non-blocking waitpid without retry loop — zombie risk'
                    });
                }
            }
            // B33: putenv with const_cast or string literal (use context for cross-line)
            const putenvContext = strippedLines.slice(Math.max(0, i - 3), i + 1).join('\n');
            if (/putenv\s*\(\s*const_cast/.test(putenvContext)) {
                issues.push({
                    id: 'B33', severity: 'CRITICAL', pattern: 'const_cast_ub',
                    file: f, line: i + 1,
                    detail: 'putenv with const_cast string literal — UB'
                });
            } else if (/putenv\s*\(\s*"[^"]*"\s*\)/.test(putenvContext)) {
                issues.push({
                    id: 'B33', severity: 'CRITICAL', pattern: 'putenv_literal',
                    file: f, line: i + 1,
                    detail: 'putenv with string literal — POSIX may modify the string'
                });
            }
            // B36: dlopen heuristic (dedup per file)
            if (/\bdlopen\s*\(/.test(line) && !dlopenReported.has(f)) {
                dlopenReported.add(f);
                issues.push({
                    id: 'B36', severity: 'MEDIUM', pattern: 'dlopen_leak',
                    file: f, line: i + 1,
                    detail: 'dlopen() used — verify matching dlclose() to prevent resource leaks'
                });
            }
            // Note: deprecated C API detection (sprintf/strcpy/gets) is handled by api_style_audit.js → B35
        }

        if (!hasBulkReap && /\bwhile\b[\s\S]{0,200}\bwaitpid\s*\(/.test(stripped)) hasBulkReap = true;
        const fk = (stripped.match(/\bfork\s*\(/g) || []).length;
        const wp = (stripped.match(/\b(?:waitpid|wait)\s*\(/g) || []).length;
        forkCount += fk;
        waitpidCount += wp;
        if (fk > 0) forkFiles.add(f);
        if (wp > 0) waitpidFiles.add(f);
    }

    // Exempt SIGCHLD=SIG_IGN and bulk-reap (while waitpid > 0, tracked per-file above)
    if (forkCount > waitpidCount && !hasSigIgn && !hasBulkReap) {
        issues.push({
            id: 'B37', severity: 'CRITICAL', pattern: 'fork_wait_mismatch',
            file: [...forkFiles][0] || '.', line: 1,
            detail: 'fork() called ' + forkCount + ' times but waitpid() only ' + waitpidCount + ' times — zombie risk'
        });
    }
    return issues;
}

const targetDir = process.argv[2] || '.';
console.error('[syscall_audit] Scanning ' + targetDir + '...');
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
