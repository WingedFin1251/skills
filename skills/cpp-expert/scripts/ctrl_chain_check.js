// ctrl_chain_check.js — Control chain call graph analyzer
// Finds control algorithms (PLL/PID/FOC/Observer) that are defined but
// never called from any ISR or RTOS task entry point.
// Handles function pointer escape detection (downgrades to WARNING).

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['drivers', 'middlewares', '.git', 'node_modules', 'build', 'debug', 'release', '.vscode'];
const CONSUMER_PATTERNS = /(PLL|PID|Observer|FOC|Calc|Control|Update)/;

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

function extractFunctions(content) {
    const funcs = [];
    // Match function definitions: [static] [inline] return_type name(params) {
    // Captures the LAST identifier before ( as function name
    const re = /(?:[\w\s\*]*?)\b(\w+)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const name = m[1];
        const start = m.index;
        // Find matching closing brace (simple brace counter)
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

function main(dir) {
    const files = collectFiles(dir);
    const allFuncs = [];
    const rootFuncs = [];

    for (const f of files) {
        const raw = fs.readFileSync(f, 'utf-8');
        const content = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments
        const funcs = extractFunctions(content);
        for (const fn of funcs) {
            fn.file = f;
            if (/_IRQHandler\b/.test(fn.name)) rootFuncs.push(fn);
            allFuncs.push(fn);
        }
        // Extract RTOS task entry points: xTaskCreate(TaskFunc, ...)
        const taskRe = /xTaskCreate\s*\(\s*(\w+)\s*,/g;
        let tm;
        while ((tm = taskRe.exec(content)) !== null) {
            const taskName = tm[1];
            const taskFunc = allFuncs.find(fn => fn.name === taskName);
            if (taskFunc && !rootFuncs.includes(taskFunc)) rootFuncs.push(taskFunc);
        }
    }

    // Build set of all function names called from root functions
    const calledFromRoot = new Set();
    for (const root of rootFuncs) {
        for (const fn of allFuncs) {
            if (fn.name !== root.name && root.body.includes(fn.name)) {
                calledFromRoot.add(fn.name);
            }
        }
    }

    // Find consumers that match control algorithm patterns
    const breaks = [];
    for (const fn of allFuncs) {
        if (CONSUMER_PATTERNS.test(fn.name)) {
            const isRoot = rootFuncs.some(r => r.name === fn.name);
            if (isRoot) continue; // ISR handlers themselves are not "broken"
            if (calledFromRoot.has(fn.name)) continue;

            // Function pointer escape detection: assignment RHS, argument pass, or declaration
            const fpRe = new RegExp(`(?<![=!])=\\s*&?\\s*\\b${fn.name}\\b`);       // ptr = func or ptr = &func
            const paramRe = new RegExp(`[\\(,]\\s*&?\\s*\\b${fn.name}\\b`);         // func(arg) or RegisterCallback(func)
            const ptrDeclRe = new RegExp(`\\(\\s*\\*\\s*\\w+\\s*\\)\\s*\\(`);      // type (*ptr)(params)
            const isFuncPtr = allFuncs.some(other =>
                fpRe.test(other.body) ||                                            // assignment
                paramRe.test(other.body) ||                                         // passed as argument
                (ptrDeclRe.test(other.body) && other.body.includes(fn.name)) ||      // declared as function ptr type
                other.body.includes(fn.name + ';')                                   // end-of-statement reference
            );

            breaks.push({
                function: fn.name,
                severity: isFuncPtr ? 'WARNING' : 'HIGH',
                reason: isFuncPtr
                    ? `Never called directly, but assigned as function pointer — verify runtime reachability`
                    : `Defined but never called from any ISR or RTOS task`,
                definition: { file: fn.file, line: fn.startLine }
            });
        }
    }
    return breaks;
}

const targetDir = process.argv[2] || '.';
console.error(`[ctrl_chain] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
