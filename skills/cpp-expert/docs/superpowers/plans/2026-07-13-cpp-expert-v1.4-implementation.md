# cpp-expert v1.4 Implementation Plan — Tool-Assisted Dimensionality Reduction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 4 Node.js preprocessing scripts and update workflow to reduce Stage-2 AI attention from ~8k to ~0.5k tokens.

**Architecture:** Three-stage pipeline: Stage 0 (Node scripts → unified JSON report) → Stage 1 (micro-logic scan, unchanged) → Stage 2 (macro-verdict, reads JSON only).

**Tech Stack:** Node.js (vanilla, zero deps), regex extraction, JSON output.

## Global Constraints

- All scripts must run on Node.js 18+ with zero npm dependencies (no `require` beyond `fs`, `path`)
- Must support Windows paths (backslashes)
- Output JSON must match the unified schema exactly
- Scripts must handle missing source directories gracefully

---

### Task 1: Create `scripts/pin_audit.js`

**Files:**
- Create: `scripts/pin_audit.js`

- [ ] **Step 1: Write pin_audit.js**

```javascript
// pin_audit.js — GPIO pin conflict matrix scanner
// Extracts all pin configurations and detects duplicate/conflicting assignments.
// Usage: node pin_audit.js [--dir Src] [--exclude Drivers]

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];

function collectFiles(dir, results = []) {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !IGNORE_DIRS.includes(e.name)) collectFiles(full, results);
        else if (e.isFile() && /\.(c|cpp|h|hpp)$/i.test(e.name)) results.push(full);
    }
    return results;
}

function parseGPIOConfig(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const results = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // GPIO_PinAFConfig(GPIOE, GPIO_PinSource9, GPIO_AF_TIM1)
        let m = line.match(/GPIO_PinAFConfig\((\w+),\s*(\w+),\s*(\w+)\)/);
        if (m) results.push({ file: filePath, line: lineNum, pin: m[1] + '_' + m[2].replace('GPIO_PinSource', ''), config: m[3] });

        // GPIO_InitStructure.GPIO_Pin = GPIO_Pin_9 | GPIO_Pin_10
        m = line.match(/GPIO_Pin\s*=\s*([^;]+)/);
        if (m) {
            const pinExpr = m[1].trim();
            // Extract port from GPIOx (e.g. GPIOE)
            let portMatch = content.slice(0, content.indexOf(line)).match(/(GPIO[A-Z]+)\s*(?:GPIO_Init|InitStructure)/g);
            const port = portMatch ? portMatch[portMatch.length-1].replace('GPIO_Init', '').trim() : 'UNKNOWN';
            results.push({ file: filePath, line: lineNum, pin: port + '_' + pinExpr, config: 'GPIO_INIT' });
        }
    }
    return results;
}

function main(dir) {
    const files = collectFiles(dir);
    const pinMap = {};
    for (const f of files) {
        const configs = parseGPIOConfig(f);
        for (const c of configs) {
            if (!pinMap[c.pin]) pinMap[c.pin] = [];
            pinMap[c.pin].push(c);
        }
    }

    const conflicts = [];
    for (const [pin, occs] of Object.entries(pinMap)) {
        if (occs.length > 1) {
            // Check if they have different AF configs
            const afConfigs = [...new Set(occs.filter(o => o.config !== 'GPIO_INIT').map(o => o.config))];
            if (afConfigs.length > 1) {
                conflicts.push({
                    pin,
                    severity: 'CRITICAL',
                    reason: `Multiple AF configurations: ${afConfigs.join(', ')}`,
                    occurrences: occs.map(o => ({ file: o.file, line: o.line, config: o.config }))
                });
            } else {
                conflicts.push({
                    pin,
                    severity: 'MEDIUM',
                    reason: 'Initialized multiple times',
                    occurrences: occs.map(o => ({ file: o.file, line: o.line, config: o.config }))
                });
            }
        }
    }
    return conflicts;
}

// CLI
const targetDir = process.argv[2] || '.';
console.error(`[pin_audit] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
```

- [ ] **Step 2: Quick test**

```bash
cd /tmp && mkdir ptest && cd ptest && cat > test_pin.c << 'EOF'
#include "stm32f4xx_hal.h"
void init_pins() {
    GPIO_InitTypeDef GPIO_InitStruct;
    GPIO_InitStruct.Pin = GPIO_PIN_9 | GPIO_PIN_10;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
    HAL_GPIO_Init(GPIOE, &GPIO_InitStruct);
    GPIO_PinAFConfig(GPIOE, GPIO_PinSource9, GPIO_AF_TIM1);
    GPIO_PinAFConfig(GPIOE, GPIO_PinSource10, GPIO_AF_TIM1);
}
EOF
node /path/to/cpp-expert/scripts/pin_audit.js /tmp/ptest
```

Expected: JSON with pin configurations listed.

- [ ] **Step 3: Commit**

```bash
git add scripts/pin_audit.js && git commit -m "feat(v1.4): add pin_audit.js — GPIO conflict scanner"
```

---

### Task 2: Create `scripts/ctrl_chain_check.js`

**Files:**
- Create: `scripts/ctrl_chain_check.js`

- [ ] **Step 1: Write ctrl_chain_check.js**

```javascript
// ctrl_chain_check.js — Control chain call graph analyzer
// Finds control algorithms (PLL/PID/FOC/Observer) that are defined but
// never called from any ISR or RTOS task entry point.
// Handles function pointer escape detection (downgrades to WARNING).

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];
const ROOT_PATTERNS = [/_IRQHandler\b/, /xTaskCreate\s*\(/];
const CONSUMER_PATTERNS = /\b(PLL|PID|Observer|FOC|Calc|Control|Update)\b/;

function collectFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !IGNORE_DIRS.includes(e.name)) collectFiles(full, results);
        else if (e.isFile() && /\.(c|cpp)$/i.test(e.name)) results.push(full);
    }
    return results;
}

function extractFunctions(content) {
    const funcs = [];
    // Match function definitions: return_type name(params) {
    const re = /(\w+)\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const name = m[2];
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
        const content = fs.readFileSync(f, 'utf-8');
        const funcs = extractFunctions(content);
        for (const fn of funcs) {
            fn.file = f;
            const isRoot = ROOT_PATTERNS.some(p => p.test(fn.name));
            if (isRoot) rootFuncs.push(fn);
            allFuncs.push(fn);
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

            // Function pointer escape detection: check if assigned to a variable
            const isFuncPtr = allFuncs.some(other =>
                other.body.includes('= ' + fn.name) || other.body.includes('=  ' + fn.name)
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/ctrl_chain_check.js && git commit -m "feat(v1.4): add ctrl_chain_check.js — control chain call graph"
```

---

### Task 3: Create `scripts/stack_depth_audit.js`

**Files:**
- Create: `scripts/stack_depth_audit.js`

- [ ] **Step 1: Write stack_depth_audit.js**

```javascript
// stack_depth_audit.js — ISR stack depth estimator
// For each *_IRQHandler, estimate stack usage from local variables
// and called functions. Flags when depth exceeds thresholds.
// Includes nesting risk multiplier for nested interrupt patterns.

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];
const STACK_THRESHOLD_HIGH = 512;
const STACK_THRESHOLD_MED = 256;
const NESTING_PATTERNS = [/NVIC_SetPendingIRQ/, /__enable_irq\(\)/, /HAL_NVIC_SetPendingIRQ/];

function collectFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory() && !IGNORE_DIRS.includes(e.name)) collectFiles(full, results);
        else if (e.isFile() && /\.(c|cpp)$/i.test(e.name)) results.push(full);
    }
    return results;
}

function extractFunctionBodies(content) {
    const funcs = [];
    const re = /(\w+)\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        const name = m[2];
        if (!name.endsWith('_IRQHandler') && !name.endsWith('_IRQn')) continue;
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
    // float/double variables: float x[N] → N*4
    const floatRe = /(float|double|int32_t|uint32_t)\s+\w+(?:\[\s*(\d+)\s*\])?/g;
    let m;
    while ((m = floatRe.exec(body)) !== null) {
        const type = m[1];
        const arraySize = m[2] ? parseInt(m[2]) : 1;
        const size = (type === 'double') ? 8 : 4;
        total += size * arraySize;
    }
    // Large local arrays: u8 buf[1024]
    const bufRe = /(u?int(?:8|16|32)_t|char|u8|u16)\s+\w+\[\s*(\d+)\s*\]/g;
    while ((m = bufRe.exec(body)) !== null) {
        const elemSize = m[1].includes('16') ? 2 : m[1].includes('32') ? 4 : 1;
        total += elemSize * parseInt(m[2]);
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
        const content = fs.readFileSync(f, 'utf-8');
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/stack_depth_audit.js && git commit -m "feat(v1.4): add stack_depth_audit.js — ISR stack estimator"
```

---

### Task 4: Create `scripts/run-preaudit.js`

**Files:**
- Create: `scripts/run-preaudit.js`

- [ ] **Step 1: Write run-preaudit.js (scheduler)**

```javascript
// run-preaudit.js — v1.4 Pre-audit scheduler
// Orchestrates pin_audit, ctrl_chain_check, stack_depth_audit.
// Merges results into unified-audit-report.json.
// Uses execFile(process.execPath) for cross-platform reliability:
//   - process.execPath: bypasses PATH, always finds current node
//   - execFile (no shell): avoids cmd/bash argument parsing differences
// Usage: node scripts/run-preaudit.js [--include-dir Src] [--exclude Drivers]

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const includeDirs = [];
const excludeDirs = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--include-dir' && i + 1 < args.length) includeDirs.push(args[++i]);
    if (args[i] === '--exclude' && i + 1 < args.length) excludeDirs.push(args[++i]);
}

const targetDir = includeDirs.length > 0 ? includeDirs[0] : '.';
const rootDir = process.cwd();
const scriptsDir = __dirname;

function runScript(name) {
    return new Promise((resolve) => {
        const scriptPath = path.join(scriptsDir, name);
        if (!fs.existsSync(scriptPath)) {
            console.error(`[preaudit] WARNING: ${name} not found, skipping`);
            return resolve([]);
        }
        execFile(process.execPath, [scriptPath, targetDir], { cwd: rootDir, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                console.error(`[preaudit] ERROR running ${name}: ${err.message}`);
                return resolve([]);
            }
            if (stderr) console.error(stderr);
            try {
                resolve(JSON.parse(stdout));
            } catch {
                console.error(`[preaudit] ${name} returned invalid JSON`);
                resolve([]);
            }
        });
    });
}

async function main() {
    const start = Date.now();

    const [pinConflicts, chainBreaks, stackRisks] = await Promise.all([
        runScript('pin_audit.js'),
        runScript('ctrl_chain_check.js'),
        runScript('stack_depth_audit.js')
    ]);

    const report = {
        meta: {
            tool_version: '1.4.0',
            scan_time_ms: Date.now() - start,
            excluded_dirs: excludeDirs,
            target_dir: targetDir
        },
        pin_conflicts: pinConflicts,
        control_chain_breaks: chainBreaks,
        stack_overflow_risks: stackRisks
    };

    const outputPath = path.join(rootDir, 'unified-audit-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

    console.log(`[PREAUDIT] ${pinConflicts.length} conflicts, ${chainBreaks.length} chain breaks, ${stackRisks.length} stack risks — ${report.meta.scan_time_ms}ms`);
    console.log(`[PREAUDIT] Report written to ${outputPath}`);
}

main().catch(err => { console.error('[preaudit] Fatal:', err); process.exit(1); });
```

- [ ] **Step 2: Commit**

```bash
git add scripts/run-preaudit.js && git commit -m "feat(v1.4): add run-preaudit.js — pre-audit scheduler"
```

---

### Task 5: Update SKILL.md — Three-Stage Workflow

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Replace the Development Process section**

Replace the current steps with the three-stage workflow (Pre-stage + Stage 1 + Stage 2 with attention budget allocation and degradation mode).

- [ ] **Step 2: Commit**

```bash
git add SKILL.md && git commit -m "feat(v1.4): three-stage workflow with tool preprocessing"
```

---

### Task 6: Update AGENTS.md — Attention Budget Guide

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add §1.2 Attention Budget Guide**

Add after the existing §1.1 (or after the existing Rule 0 description):

```markdown
### Attention Budget Guide (v1.4)
This section is MANDATORY reading before starting any review.

The review is split into three stages with explicit attention budgets:

| Stage | Budget | Focus | Rule |
|-------|--------|-------|------|
| 0. Preprocessing | 0% | Run `node scripts/run-preaudit.js` | Mechanical, no AI involvement |
| 1. Micro Logic | 70% | Single-function semantics | Do NOT read pre-audit JSON |
| 2. Macro Verdict | 30% | Cross-file architecture | Read ONLY `unified-audit-report.json` |

**Micro vs Macro separation is enforced:**
- In Stage 1, do NOT think about GPIO conflicts, ISR priorities, or control chains
- In Stage 2, do NOT re-read GPIO/ISR/DMA init code — the JSON is the sole source of truth for hardware conflicts

**Degradation mode:** If `unified-audit-report.json` does not exist
(Node.js unavailable), fall back to manual guidance:
- "Please check Src/pwm.c line 42 for AF configuration conflicts."
- The report quality will be lower, but the skill still provides value.
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "feat(v1.4): add attention budget guide to AGENTS.md"
```

---

### Task 7: Update .gitignore, Verify, Tag

- [ ] **Step 1: Add to .gitignore**

```bash
echo "unified-audit-report.json" >> .gitignore
```

- [ ] **Step 2: Verify syntax**

```bash
cd /path/to/cpp-expert
node -c scripts/pin_audit.js && echo "pin_audit.js ✅"
node -c scripts/ctrl_chain_check.js && echo "ctrl_chain_check.js ✅"
node -c scripts/stack_depth_audit.js && echo "stack_depth_audit.js ✅"
node -c scripts/run-preaudit.js && echo "run-preaudit.js ✅"
```

- [ ] **Step 3: Run a dry test against a small C file**

```bash
cd /tmp && mkdir drytest && cd drytest
echo 'void EXTI0_IRQHandler(void) { int x; }' > test.c
node /path/to/cpp-expert/scripts/pin_audit.js /tmp/drytest > /dev/null && echo "pin_audit dry ✅"
node /path/to/cpp-expert/scripts/ctrl_chain_check.js /tmp/drytest > /dev/null && echo "ctrl_chain dry ✅"
node /path/to/cpp-expert/scripts/stack_depth_audit.js /tmp/drytest > /dev/null && echo "stack_depth dry ✅"
```

- [ ] **Step 4: Tag and final log**

```bash
git add .gitignore && git commit -m "chore: add unified-audit-report.json to gitignore"
git tag -a v1.4 -m "cpp-expert v1.4: tool-assisted dimensionality reduction (3 Node.js pre-audit scripts)"
git log --oneline -6
```
