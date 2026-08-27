# cpp-expert v1.5 Implementation Plan — Plug the Final Blind Spots

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close 5 remaining recall gaps (F1: 0.86→0.92+) via rule route (magic numbers, static enforcement) + script route (style_audit.js).

**Architecture:** Two parallel routes — no-code AGENTS.md rule additions for semantic issues (B18/B15), and a new Node.js script for mechanical pattern detection (B16/B17). style_audit.js extends the unified-audit-report.json with a `style_issues[]` field.

**Tech Stack:** Node.js (vanilla), Markdown (documentation)

## Global Constraints

- AGENTS.md §5.7 uses ❌/✅ format
- style_audit.js: zero npm dependencies, Node.js 18+, Windows paths compatible
- JSON output must extend the existing unified schema
- All existing tests must continue to pass

---

### Task 1: AGENTS.md — Add Magic Number Rule to §5.7

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add item 6 to §5.7**

Find `### 5.7 Basic C Semantics & Compiler Traps (v1.3)` and append after `**5. Redundant `volatile` for Hardware-Register Width**`:

```markdown
**6. Magic Number Detection (v1.5 — MEDIUM)**

Scan for bare numeric literals in function bodies. Every value except `0`, `1`,
`-1` must be named via `#define` or `const`.

#### ❌ Incorrect

```c
void set_pwm() {
    TIM3->CCR1 = 5000;   // What does 5000 mean? Duty cycle? Period?
    if (adc_val > 4095)  // 4095 = 12-bit ADC max? Not obvious.
        adc_val = 4095;
}
```

#### ✅ Correct

```c
#define PWM_PERIOD 5000
#define ADC12_MAX  4095

void set_pwm() {
    TIM3->CCR1 = PWM_PERIOD;
    if (adc_val > ADC12_MAX)
        adc_val = ADC12_MAX;
}
```
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "feat(v1.5): add magic number detection rule to §5.7"
```

---

### Task 2: AGENTS.md — Add File-Scope Static Enforcement to §6.1

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add static enforcement to §6.1**

Find `### 6.1 Naming Conventions` and add after the existing ❌/✅ examples:

```markdown
### 6.1.1 File-Scope Static Enforcement (v1.5 — HIGH)

#### ❌ Incorrect

```c
// File scope — pollutes global namespace
int i;
float temp;
char buf[256];

void process(void) {
    for (i = 0; i < 10; i++) { ... }
}
// i, temp, buf are visible to the entire project — risk of linker conflict
```

#### ✅ Correct

```c
static int i;
static float temp;
static char buf[256];

void process(void) {
    for (i = 0; i < 10; i++) { ... }
}
// Now limited to this translation unit — linker safe
```

**Review rule:** Flag every non-static global variable in `.c` files. Single-letter
names (i, j, k) and generic names (cnt, temp, buf, ret) at file scope are
🟠 HIGH priority. Exceptions: `main`-level globals that are truly cross-module
(system state structs, hardware register maps).
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "feat(v1.5): add file-scope static enforcement to §6.1"
```

---

### Task 3: Create `scripts/style_audit.js`

**Files:**
- Create: `scripts/style_audit.js`

- [ ] **Step 1: Write style_audit.js**

```javascript
// style_audit.js — Code style & project structure auditor (v1.5)
// Detects: sentinel assignments (B16), EXTI wrong file (B17), file-scope global i/j/k
// Usage: node style_audit.js [--dir Src]

const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['Drivers', 'Middlewares', '.git', 'node_modules', 'build', 'Debug', 'Release', '.vscode'];
const EXTI_FILE_PATTERNS = [/bsp_exti/i, /exti/i, /gpio/i, /bsp_.*\.c$/];

function collectFiles(dirOrDirs, results = []) {
    const dirs = dirOrDirs.split(',').map(d => d.trim()).filter(d => d);
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !IGNORE_DIRS.includes(e.name)) collectFiles(full, results);
            else if (e.isFile() && /\.(c|cpp)$/i.test(e.name)) results.push(full);
        }
    }
    return results;
}

function detectSentinelAssignments(content, filePath) {
    const issues = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/(\w+)\[(\d+)\]\s*=\s*\w+\[\s*\w+\s*\]/);
        if (m && m[2] === '0') {
            issues.push({
                id: 'B16',
                pattern: 'sentinel_assignment',
                severity: 'MEDIUM',
                file: filePath,
                line: i + 1,
                detail: `${m[1]}[0] = ${m[1]}[...] — potential sentinel misuse in sort/swap context`
            });
        }
    }
    return issues;
}

function detectEXTIFilePlacement(content, filePath) {
    const issues = [];
    const fileName = path.basename(filePath);
    const isExpectedFile = EXTI_FILE_PATTERNS.some(p => p.test(fileName));

    if (isExpectedFile) return issues; // Already in correct file

    const hasEXTICode = /EXTI|NVIC_Init|HAL_NVIC_SetPriority|GPIO_EXTI/.test(content);
    if (hasEXTICode) {
        issues.push({
            id: 'B17',
            pattern: 'exti_wrong_file',
            severity: 'MEDIUM',
            file: filePath,
            line: 1,
            detail: `EXTI/NVIC configuration in ${fileName}, expected in bsp_exti.c or gpio.c`
        });
    }
    return issues;
}

function detectFileScopeGlobals(content, filePath) {
    const issues = [];
    const lines = content.split('\n');
    // Skip function bodies — only check file scope lines
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Track brace depth to identify file scope
        for (const ch of line) {
            if (ch === '{') braceDepth++;
            else if (ch === '}') braceDepth--;
        }
        if (braceDepth > 0) continue; // Inside a function — skip

        // Match non-static global declarations of single-letter variables
        const m = line.match(/^(?!.*static)\s*(int|float|char|double|uint8_t|uint16_t|uint32_t)\s+(i|j|k|cnt|temp|buf|ret|tmp)\b/);
        if (m) {
            issues.push({
                id: 'B15',
                pattern: 'file_scope_global',
                severity: 'HIGH',
                file: filePath,
                line: i + 1,
                detail: `Non-static global '${m[2]}' at file scope — should be static`
            });
        }
    }
    return issues;
}

function main(dir) {
    const files = collectFiles(dir);
    const issues = [];
    for (const f of files) {
        const content = fs.readFileSync(f, 'utf-8');
        issues.push(...detectSentinelAssignments(content, f));
        issues.push(...detectEXTIFilePlacement(content, f));
        issues.push(...detectFileScopeGlobals(content, f));
    }
    return issues;
}

const targetDir = process.argv[2] || '.';
console.error(`[style_audit] Scanning ${targetDir}...`);
const results = main(targetDir);
console.log(JSON.stringify(results, null, 2));
```

- [ ] **Step 2: Verify syntax**

```bash
node -c scripts/style_audit.js && echo "syntax OK"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/style_audit.js && git commit -m "feat(v1.5): add style_audit.js — sentinel, EXTI file, global scope checks"
```

---

### Task 4: Update `run-preaudit.js` — Include style_audit

**Files:**
- Modify: `scripts/run-preaudit.js`

- [ ] **Step 1: Add style_audit module call**

Add `style_audit.js` to the sequential module chain and add `style_issues` to the report:

```javascript
const { findings: styleIssues, status: styleStatus } = await runScript('style_audit.js');
```

Include in report:
```javascript
modules: {
    // ...existing modules...
    style_audit: { status: styleStatus, findings: styleIssues.length }
},
style_issues: styleIssues,
// ...existing fields...
```

Update console summary:
```javascript
console.log(`[PREAUDIT] ${pinConflicts.length} conflicts, ${chainBreaks.length} chain breaks, ${stackRisks.length} stack risks, ${styleIssues.length} style issues — ${report.meta.scan_time_ms}ms`);
```

- [ ] **Step 2: Verify syntax**

```bash
node -c scripts/run-preaudit.js && echo "syntax OK"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/run-preaudit.js && git commit -m "feat(v1.5): integrate style_audit into run-preaudit scheduler"
```

---

### Task 5: Update SKILL.md — Bundled Resources

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Add style_audit.js to Bundled Resources**

Append after the existing js script entries:
```markdown
- **scripts/style_audit.js** — v1.5 style auditor (sentinel patterns, EXTI file placement, file-scope globals)
```

- [ ] **Step 2: Commit**

```bash
git add SKILL.md && git commit -m "docs(v1.5): add style_audit to Bundled Resources"
```

---

### Task 6: Verify and Tag

- [ ] **Step 1: Syntax check**

```bash
for f in scripts/*.js; do node -c "$f" && echo "  ✅ $f" || echo "  ❌ $f"; done
```

- [ ] **Step 2: Quick test**

```bash
cd /tmp && rm -rf v15-test && mkdir v15-test && cd v15-test
mkdir Src

# Test B16: sentinel pattern
cat > Src/utils.c << 'EOF'
void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; }
void sort(int *s, int n) {
    s[0] = s[n-1];  // sentinel pattern
    for (int i = 0; i < n; i++) { }
}
EOF

# Test B17: EXTI in wrong file
cat > Src/main.c << 'EOF'
#include "stm32f4xx_hal.h"
void main(void) {
    HAL_Init();
    HAL_NVIC_SetPriority(EXTI0_IRQn, 1, 0);  // Wrong place!
}
EOF

# Test B15: file-scope global
cat > Src/control.c << 'EOF'
int i;  // file scope, non-static, bad
float temp;  // also bad
void process(void) { i = 0; }
EOF

node /path/to/cpp-expert/scripts/run-preaudit.js --include-dir Src/ 2>&1
echo "---"
node -e "const r=require('./unified-audit-report.json'); console.log('style_issues:', r.style_issues.length); r.style_issues.forEach(i => console.log(' ', i.id, i.severity, i.detail));"
```

Expected:
- B16: s[0] sentinel detected
- B17: EXTI in main.c flagged
- B15: global `i` and `temp` flagged

- [ ] **Step 3: Tag and final log**

```bash
cd /path/to/cpp-expert
git tag -a v1.5 -m "cpp-expert v1.5: plug final blind spots — magic numbers rule, static enforcement, style_audit.js"
git log --oneline -6
```