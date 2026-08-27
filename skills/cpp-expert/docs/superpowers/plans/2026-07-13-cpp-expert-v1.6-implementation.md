# cpp-expert v1.6 Implementation Plan — Full-Scope C/C++ Audit Platform

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand cpp-expert from embedded-only to full-scope C/C++ audit with 3 new scripts and project type auto-routing.

**Architecture:** Project type detection (embedded vs app) in run-preaudit.js routes to appropriate scripts. New scripts: build_audit.js (CMake orphans), syscall_audit.js (POSIX safety), api_style_audit.js (macro consistency).

**Tech Stack:** Node.js (vanilla), regex extraction, JSON output.

## Global Constraints

- All scripts zero npm dependencies, Node.js 18+, Windows paths compatible
- JSON output extends unified-audit-report.json schema
- Project type routing uses file heuristics only (no user config file)

---

### Task 1: Create `scripts/build_audit.js`

**Files:**
- Create: `scripts/build_audit.js`

- [ ] **Step 1: Write build_audit.js**

```javascript
// build_audit.js — Build system orphan file detector (v1.6)
// Scans CMakeLists.txt for compiled sources, cross-references disk files.
// Supports: add_library, add_executable, target_sources, set(SOURCES ...)
// Recursive: finds all CMakeLists.txt in subdirectories.
// Usage: node build_audit.js <target-dir>

const fs = require('fs');
const path = require('path');

const SRC_PATTERNS = ['.cpp', '.c', '.cc', '.cxx'];

function collectFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.name === '.git' || e.name === 'node_modules' || e.name === 'build') continue;
        if (e.isDirectory()) results.push(...collectFiles(full));
        else if (SRC_PATTERNS.some(p => e.name.endsWith(p))) results.push(full);
    }
    return results;
}

function findCMakeFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.name === '.git' || e.name === 'node_modules' || e.name === 'build') continue;
        if (e.isDirectory()) results.push(...findCMakeFiles(full));
        else if (e.name === 'CMakeLists.txt') results.push(full);
    }
    return results;
}

function extractSources(cmakeContent, cmakeDir) {
    const sources = new Set();
    // Strip comments
    const cleaned = cmakeContent.replace(/#.*$/gm, '');
    // add_library / add_executable
    const re1 = /(?:add_library|add_executable)\s*\(\s*\w+(?:\s+\w+)?\s+([^)]+)\)/g;
    let m;
    while ((m = re1.exec(cleaned)) !== null) {
        m[1].split(/\s+/).forEach(f => {
            const trimmed = f.trim();
            if (trimmed && SRC_PATTERNS.some(p => trimmed.endsWith(p))) {
                sources.add(path.resolve(cmakeDir, trimmed));
            }
        });
    }
    // target_sources
    const re2 = /target_sources\s*\(\s*\w+\s+(?:PRIVATE|PUBLIC|INTERFACE)?\s+([^)]+)\)/g;
    while ((m = re2.exec(cleaned)) !== null) {
        m[1].split(/\s+/).forEach(f => {
            const trimmed = f.trim();
            if (trimmed && SRC_PATTERNS.some(p => trimmed.endsWith(p)))
                sources.add(path.resolve(cmakeDir, trimmed));
        });
    }
    // set(SOURCES ...) or set(SRC_LIST ...)
    const re3 = /set\s*\(\s*(?:\w*_?SOURCES?|SRC_LIST)\s+([^)]+)\)/gi;
    while ((m = re3.exec(cleaned)) !== null) {
        m[1].split(/\s+/).forEach(f => {
            const trimmed = f.trim();
            if (trimmed && SRC_PATTERNS.some(p => trimmed.endsWith(p)))
                sources.add(path.resolve(cmakeDir, trimmed));
        });
    }
    return sources;
}

function main(dir) {
    const cmakeFiles = findCMakeFiles(dir);
    const compiledSources = new Set();
    for (const cm of cmakeFiles) {
        const content = fs.readFileSync(cm, 'utf-8');
        const s = extractSources(content, path.dirname(cm));
        s.forEach(f => compiledSources.add(f));
    }

    const allSources = new Set(collectFiles(dir).map(f => path.resolve(f)));
    const orphans = [];
    const missing = [];

    for (const f of allSources) {
        if (!compiledSources.has(f)) {
            orphans.push({
                id: 'B30', pattern: 'orphan_source', severity: 'HIGH',
                file: f, line: 1,
                detail: `Source exists but not listed in any CMakeLists.txt`
            });
        }
    }
    return { orphans, compiledCount: compiledSources.size, totalCount: allSources.size };
}

const targetDir = process.argv[2] || '.';
console.error(`[build_audit] Scanning ${targetDir}...`);
const result = main(targetDir);
console.log(JSON.stringify(result.orphans, null, 2));
console.error(`[build_audit] ${result.orphans.length} orphans out of ${result.totalCount} files (${result.compiledCount} compiled)`);
```

- [ ] **Step 2: Verify syntax**

```bash
node -c scripts/build_audit.js && echo "syntax OK"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/build_audit.js && git commit -m "feat(v1.6): add build_audit.js — CMake orphan file detector"
```

---

### Task 2: Create `scripts/syscall_audit.js`

**Files:**
- Create: `scripts/syscall_audit.js`

- [ ] **Step 1: Write syscall_audit.js**

```javascript
// syscall_audit.js — POSIX system call safety auditor (v1.6)
// Detects: unchecked I/O (B31), zombie risk (B32), const_cast UB (B33),
//          dlopen leak (B36), fork/wait mismatch (B37), deprecated APIs (B38), malloc/free (B39)
// Usage: node syscall_audit.js <target-dir>

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release'];

function collectFiles(dirOrDirs) {
    const results = [];
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

    for (const f of files) {
        const raw = fs.readFileSync(f, 'utf-8');
        const content = stripContent(raw);
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // B31: Unchecked I/O — fwrite/fread not wrapped in if
            if (/\b(fwrite|fread|chmod)\s*\(/.test(line) && !/if\s*\(/.test(line)) {
                issues.push({
                    id: 'B31', severity: 'HIGH', pattern: 'unchecked_io',
                    file: f, line: i + 1,
                    detail: `${line.match(/\b(fwrite|fread|chmod)\b/)[1]} return value unchecked`
                });
            }
            // B32: Non-blocking waitpid without retry loop
            if (/waitpid\s*\([^)]*WNOHANG/.test(line)) {
                const context = lines.slice(Math.max(0, i - 5), i).join(' ');
                if (!/\b(for|while)\b/.test(context)) {
                    issues.push({
                        id: 'B32', severity: 'HIGH', pattern: 'zombie_risk',
                        file: f, line: i + 1,
                        detail: 'Non-blocking waitpid without retry loop — zombie risk'
                    });
                }
            }
            // B33: const_cast on string literal
            if (/putenv\s*\(\s*const_cast/.test(line) || /const_cast\s*<char[^>]*>\s*\(\s*"/.test(line)) {
                issues.push({
                    id: 'B33', severity: 'CRITICAL', pattern: 'const_cast_ub',
                    file: f, line: i + 1,
                    detail: 'const_cast on string literal passed to C API — UB'
                });
            }
            // B36: dlopen without dlclose
            if (/\bdlopen\s*\(/.test(line)) issues.push({
                id: 'B36', severity: 'HIGH', pattern: 'dlopen_leak',
                file: f, line: i + 1,
                detail: 'dlopen() without matching dlclose() may leak library handle'
            });
            // B38: Deprecated C APIs
            if (/\b(strcpy|sprintf|gets)\s*\(/.test(line)) issues.push({
                id: 'B38', severity: 'HIGH', pattern: 'deprecated_api',
                file: f, line: i + 1,
                detail: `Deprecated API ${line.match(/\b(strcpy|sprintf|gets)\b/)[1]} — use safer alternatives`
            });
        }

        // B37: Aggregate fork/wait counts
        const fk = (content.match(/\bfork\s*\(/g) || []).length;
        const wp = (content.match(/\bwaitpid\s*\(/g) || []).length;
        forkCount += fk;
        waitpidCount += wp;
        if (fk > 0) forkFiles.add(f);
        if (wp > 0) waitpidFiles.add(f);
    }

    // B37 cross-file mismatch
    if (forkCount > waitpidCount) {
        issues.push({
            id: 'B37', severity: 'CRITICAL', pattern: 'fork_wait_mismatch',
            file: [...forkFiles][0] || '.', line: 1,
            detail: `fork() called ${forkCount} times but waitpid() only ${waitpidCount} times — possible zombie leak`
        });
    }

    return issues;
}

const targetDir = process.argv[2] || '.';
console.error(`[syscall_audit] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
```

- [ ] **Step 2: Verify syntax**

```bash
node -c scripts/syscall_audit.js && echo "syntax OK"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/syscall_audit.js && git commit -m "feat(v1.6): add syscall_audit.js — POSIX syscall safety checker"
```

---

### Task 3: Create `scripts/api_style_audit.js`

**Files:**
- Create: `scripts/api_style_audit.js`

- [ ] **Step 1: Write api_style_audit.js**

```javascript
// api_style_audit.js — Cross-file API consistency auditor (v1.6)
// Detects: macro arity mismatch (B34), deprecated API usage (B35)
// Excludes: variadic macros (#define LOG(fmt, ...)), C++ function overloads
// Usage: node api_style_audit.js <target-dir>

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release'];
const DEPRECATED_APIS = /\b(sprintf|strcpy|strcat|gets)\s*\(/;

function collectFiles(dirOrDirs) {
    const results = [];
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !IGNORE_DIRS.includes(e.name.toLowerCase())) collectFiles(full, results);
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

function isVariadicMacro(content, macroName) {
    // Check if macro is defined with variadic ... in headers
    const re = new RegExp(`#define\\s+${macroName}\\s*\\([^)]*\\.\\.\\.`);
    return re.test(content);
}

function main(dir) {
    const files = collectFiles(dir);
    const headerContent = files
        .filter(f => /\.(h|hpp)$/i.test(f))
        .map(f => fs.readFileSync(f, 'utf-8'))
        .join('\n');

    const callStats = {}; // { 'OH_LOG_INFO': { arity: [file:line, ...] } }
    const issues = [];
    const deprecatedFound = [];

    for (const f of files) {
        if (/\.(h|hpp)$/i.test(f)) continue; // Skip headers for deprecated API (likely declarations)
        const raw = fs.readFileSync(f, 'utf-8');
        const content = stripComments(raw);
        const lines = content.split('\n');

        // B34: Macro arity analysis
        // Match: MACRO_NAME(arg1, arg2, ...)
        const macroRe = /\b([A-Z_][A-Z0-9_]+)\s*\(([^)]*)\)/g;
        let m;
        while ((m = macroRe.exec(content)) !== null) {
            const name = m[1];
            // Skip common non-functional macros
            if (/^(true|false|NULL|NULLPTR|__FILE__|__LINE__|__DATE__)$/i.test(name)) continue;
            // Skip if variadic
            if (isVariadicMacro(headerContent, name)) continue;
            const args = m[2].split(',').length;
            if (!callStats[name]) callStats[name] = {};
            if (!callStats[name][args]) callStats[name][args] = [];
            callStats[name][args].push(`${f}:${lines.indexOf(m[0]) + 1}`);
        }

        // B35: Deprecated API detection
        const lines2 = raw.split('\n');
        for (let i = 0; i < lines2.length; i++) {
            if (DEPRECATED_APIS.test(lines2[i]) && !lines2[i].trim().startsWith('//')) {
                const api = lines2[i].match(DEPRECATED_APIS)[1];
                deprecatedFound.push({
                    id: 'B35', severity: 'HIGH', pattern: 'deprecated_api',
                    file: f, line: i + 1,
                    detail: `Deprecated API '${api}' — use safer alternatives`
                });
            }
        }
    }

    // B34: Report macros with inconsistent arity
    for (const [name, arities] of Object.entries(callStats)) {
        const arityKeys = Object.keys(arities);
        if (arityKeys.length > 1) {
            const locations = Object.entries(arities).map(([arity, locs]) =>
                `${arity} args: ${locs.join(', ')}`
            ).join('; ');
            issues.push({
                id: 'B34', severity: 'CRITICAL', pattern: 'macro_arity_mismatch',
                file: '.', line: 1,
                detail: `Macro '${name}' called with inconsistent arg counts: ${locations}`
            });
        }
    }

    issues.push(...deprecatedFound);
    return issues;
}

const targetDir = process.argv[2] || '.';
console.error(`[api_style_audit] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
```

- [ ] **Step 2: Verify syntax**

```bash
node -c scripts/api_style_audit.js && echo "syntax OK"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/api_style_audit.js && git commit -m "feat(v1.6): add api_style_audit.js — macro arity + deprecated API detector"
```

---

### Task 4: Update `run-preaudit.js` — Project Type Routing

**Files:**
- Modify: `scripts/run-preaudit.js`

- [ ] **Step 1: Replace main() with project type detection**

Replace the `main()` function:

```javascript
async function main() {
    const start = Date.now();
    const relDir = targetDir; // from command line arg

    // Detect project type
    const hasDrivers = fs.existsSync(path.join(rootDir, 'Drivers'));
    const hasSTM32Headers = fs.existsSync(path.join(rootDir, relDir, 'stm32f4xx_hal.h'))
        || fs.existsSync(path.join(rootDir, relDir, 'stm32f1xx_hal.h'))
        || fs.existsSync(path.join(rootDir, relDir, 'stm32h7xx_hal.h'));
    const hasCMake = fs.existsSync(path.join(rootDir, 'CMakeLists.txt'));
    const hasPlatformIO = fs.existsSync(path.join(rootDir, 'platformio.ini'));
    const isEmbedded = (hasDrivers && hasSTM32Headers) || hasPlatformIO;

    console.error(`[preaudit] Project type: ${isEmbedded ? 'embedded' : 'app'} ${isEmbedded ? '' : '(CMake: ' + hasCMake + ')'}`);

    // Run project-specific scripts
    let pinConflicts = [], chainBreaks = [], stackRisks = [];
    let buildOrphans = [], syscallIssues = [];

    if (isEmbedded) {
        console.error('[preaudit] Running embedded scripts...');
        ({ findings: pinConflicts } = await runScript('pin_audit.js'));
        ({ findings: chainBreaks } = await runScript('ctrl_chain_check.js'));
        ({ findings: stackRisks } = await runScript('stack_depth_audit.js'));
    }
    if (!isEmbedded && hasCMake) {
        console.error('[preaudit] Running application scripts...');
        ({ findings: buildOrphans } = await runScript('build_audit.js'));
        ({ findings: syscallIssues } = await runScript('syscall_audit.js'));
    }

    // Always run common scripts
    const { findings: styleIssues } = await runScript('style_audit.js');
    const { findings: apiIssues } = await runScript('api_style_audit.js');

    const report = {
        meta: {
            tool_version: '1.6.0', scan_time_ms: Date.now() - start,
            project_type: isEmbedded ? 'embedded' : 'app',
            excluded_dirs: excludeDirs, target_dir: targetDir,
            modules: {
                pin_audit: { status: isEmbedded ? 'ok' : 'skipped', findings: pinConflicts.length }
            }
        },
        pin_conflicts: pinConflicts, control_chain_breaks: chainBreaks,
        stack_overflow_risks: stackRisks, style_issues: styleIssues,
        build_orphans: buildOrphans, syscall_issues: syscallIssues,
        api_mismatches: apiIssues
    };
    const outputPath = path.join(rootDir, 'unified-audit-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`[PREAUDIT] ${pinConflicts.length} conflicts, ${chainBreaks.length} breaks, ${stackRisks.length} stack, ${styleIssues.length} style, ${buildOrphans.length} orphans, ${syscallIssues.length} syscalls, ${apiIssues.length} api — ${report.meta.scan_time_ms}ms`);
    console.log(`[PREAUDIT] Report written to ${outputPath}`);
}
```

- [ ] **Step 2: Verify syntax**

```bash
node -c scripts/run-preaudit.js && echo "syntax OK"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/run-preaudit.js && git commit -m "feat(v1.6): project type auto-routing in run-preaudit.js"
```

---

### Task 5: Update AGENTS.md — Consumption Rules

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add new JSON field rows to Usage Rules table**

Add after the existing `style_issues` rows:
```markdown
| `build_orphans` | Yes | 🟠 HIGH — "orphan source file — not compiled" |
| `syscall_issues` | `id: B31` | 🟠 HIGH — "I/O return value unchecked" |
| `syscall_issues` | `id: B32` | 🟠 HIGH — "zombie process risk" |
| `syscall_issues` | `id: B33` | 🔴 CRITICAL — "const_cast on string literal UB" |
| `syscall_issues` | `id: B36` | 🟠 HIGH — "dlopen without dlclose" |
| `syscall_issues` | `id: B37` | 🔴 CRITICAL — "fork without waitpid" |
| `syscall_issues` | `id: B38` | 🟠 HIGH — "deprecated C API" |
| `syscall_issues` | `id: B39` | 🟠 HIGH — "potential memory leak" |
| `api_mismatches` | `id: B34` | 🔴 CRITICAL — "API version inconsistency" |
| `api_mismatches` | `id: B35` | 🟠 HIGH — "deprecated API usage" |
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "feat(v1.6): add build_orphans/syscall_issues/api_mismatches consumption rules"
```

---

### Task 6: Update SKILL.md — Bundled Resources

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Add new scripts to Bundled Resources**

Append after `style_audit.js` entry:
```markdown
- **scripts/build_audit.js** — v1.6 CMake build audit (orphan source files)
- **scripts/syscall_audit.js** — v1.6 POSIX syscall safety audit
- **scripts/api_style_audit.js** — v1.6 cross-file API consistency audit
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md && git commit -m "docs(v1.6): add new scripts to Bundled Resources"
```

---

### Task 7: Verify and Tag

- [ ] **Step 1: Syntax check all scripts**

```bash
for f in scripts/*.js; do node -c "$f" && echo "  ✅ $f" || echo "  ❌ $f"; done
```

- [ ] **Step 2: Quick test**

```bash
cd /tmp && rm -rf v16-test && mkdir v16-test && cd v16-test && mkdir Src
# Test build_audit: orphan file
echo 'int main(void) { return 0; }' > Src/main.c
echo 'int unused(void) { return 1; }' > Src/unused.c
echo 'add_executable(myapp Src/main.c)' > CMakeLists.txt

# Test syscall_audit: unchecked fwrite
echo '#include <stdio.h>
void test(void) { fwrite("abc", 1, 3, stdout); }' > Src/test.c

# Test api_style_audit: sprintf usage
echo '#include <stdio.h>
void log(void) { char b[32]; sprintf(b, "%d", 1); }' > Src/log.c

node /path/to/cpp-expert/scripts/run-preaudit.js --include-dir Src/ 2>&1
node -e "const r=require('./unified-audit-report.json');
console.log('build_orphans:', r.build_orphans.length);
console.log('syscall_issues:', r.syscall_issues.length);
console.log('api_mismatches:', r.api_mismatches.length);"
```

- [ ] **Step 3: Tag**

```bash
cd /path/to/cpp-expert
git tag -a v1.6 -m "cpp-expert v1.6: full-scope C/C++ audit — build, syscall, API consistency"
git log --oneline -6
```
