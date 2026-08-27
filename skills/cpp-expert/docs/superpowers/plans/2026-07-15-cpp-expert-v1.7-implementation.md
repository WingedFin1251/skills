# cpp-expert v1.7 Implementation Plan — CASTLE CWE-770 Coverage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close 4 CASTLE FN in CWE-770 (OS resource leaks) via deterministic script rules in syscall_audit.js.

**Architecture:** Three new functions in syscall_audit.js (B40/B41/B42), output via new `resource_leaks[]` JSON field. No new scripts, no structural changes.

**Tech Stack:** Node.js (vanilla), regex extraction, JSON output.

## Global Constraints

- Same codebase patterns as existing syscall_audit.js
- Zero npm dependencies
- Same IGNORE_DIRS, same collectFiles, same stripContent
- JSON output schema extends unified-audit-report.json

---

### Task 1: Extend `syscall_audit.js` with B40/B41/B42

**Files:**
- Modify: `scripts/syscall_audit.js`

- [ ] **Step 1: Add B40 — File Descriptor Leak**

Add after the existing B37 block (before `return issues`):

```javascript
    // B40: File descriptor leak — open/fopen/socket without close
    function detectFDLeaks(content, filePath) {
        const issues = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Detect open/fopen/creat/socket/accept calls
            let m = line.match(/\b(open|fopen|creat|socket)\s*\(/);
            if (m) {
                const func = m[1];
                // Search remaining lines for matching close/fclose
                let foundClose = false;
                for (let j = i; j < Math.min(i + 30, lines.length); j++) {
                    const closeRe = func === 'fopen' ? /\bfclose\s*\(/ :
                                    func === 'socket' || func === 'accept' ? /\bclose\s*\(/ :
                                    /\bclose\s*\(/;
                    if (closeRe.test(lines[j])) { foundClose = true; break; }
                }
                if (!foundClose) {
                    issues.push({
                        id: 'B40', severity: 'HIGH', pattern: 'fd_leak',
                        file: filePath, line: i + 1,
                        detail: func + '() without matching close() within 30 lines — FD leak'
                    });
                }
            }
        }
        return issues;
    }
```

- [ ] **Step 2: Add B41 — Process Leak (per-call fork/exec check)**

```javascript
    // B41: Process leak — fork without waitpid/_exit in child path
    function detectProcessLeaks(content, filePath) {
        const issues = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (!/\bfork\s*\(/.test(lines[i])) continue;
            // Check if there's a waitpid within 50 lines after fork
            let hasWait = false, hasExit = false;
            for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
                if (/\bwaitpid\s*\(/.test(lines[j]) || /\bwait\s*\(/.test(lines[j])) hasWait = true;
                if (/\b_exit\s*\(/.test(lines[j]) || /\bexit\s*\(/.test(lines[j])) hasExit = true;
            }
            if (!hasWait) {
                issues.push({
                    id: 'B41', severity: 'HIGH', pattern: 'process_leak',
                    file: filePath, line: i + 1,
                    detail: 'fork() without matching waitpid() within 50 lines — zombie risk'
                });
            }
        }
        return issues;
    }
```

- [ ] **Step 3: Add B42 — Input Loop Overflow**

```javascript
    // B42: scanf/fscanf in infinite loop without return-value check
    function detectInputLoopOverflow(content, filePath) {
        const issues = [];
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check if line contains scanf inside an infinite loop
            if (!/\b(scanf|fscanf)\s*\(/.test(line)) continue;
            // Scan context upward for while(1)/for(;;)
            let inInfiniteLoop = false;
            for (let j = Math.max(0, i - 10); j <= i; j++) {
                if (/while\s*\(\s*1\s*\)/.test(lines[j]) || /for\s*\(\s*;\s*;\s*\)/.test(lines[j]) || /while\s*\(true\)/.test(lines[j]))
                    inInfiniteLoop = true;
            }
            if (!inInfiniteLoop) continue;
            // Check if return value is verified
            const hasCheck = /\b(scanf|fscanf)\s*\([^)]*\)\s*(!=|==|>|<|>=|<=)\s*EOF/.test(line) ||
                             /\b(scanf|fscanf)\s*\([^)]*\)\s*(!=|==|>|<|>=|<=)/.test(line);
            if (!hasCheck) {
                issues.push({
                    id: 'B42', severity: 'HIGH', pattern: 'input_overflow',
                    file: filePath, line: i + 1,
                    detail: 'scanf() in infinite loop without return-value check — memory exhaustion risk'
                });
            }
        }
        return issues;
    }
```

- [ ] **Step 4: Integrate into main()**

Add calls in `main()` function after the B38 note:

```javascript
        issues.push(...detectFDLeaks(stripped, f));
        issues.push(...detectProcessLeaks(stripped, f));
        issues.push(...detectInputLoopOverflow(stripped, f));
```

And add `resource_leaks` to output:

```javascript
    return { issues, resourceLeaks: issues.filter(i => ['B40','B41','B42'].includes(i.id)) };
```

But to maintain backward compatibility, return the full issues array and add `resource_leaks` at the run-preaudit.js level.

Actually simpler: keep returning the full issues array. The `resource_leaks` field is built in `run-preaudit.js` by filtering.

- [ ] **Step 5: Verify syntax**

```bash
node -c scripts/syscall_audit.js && echo "syntax OK"
```

- [ ] **Step 6: Commit**

```bash
git add scripts/syscall_audit.js && git commit -m "feat(v1.7): add B40/FD leak, B41/process leak, B42/input loop overflow"
```

---

### Task 2: Update `run-preaudit.js` — Add `resource_leaks` to report

**Files:**
- Modify: `scripts/run-preaudit.js`

- [ ] **Step 1: Add resource_leaks field**

After the existing report fields, filter B40/B41/B42 from syscallIssues:

```javascript
        resource_leaks: syscallIssues.filter(i => ['B40','B41','B42'].includes(i.id)),
```

- [ ] **Step 2: Update version to 1.7.0**

```javascript
            tool_version: '1.7.0',
```

- [ ] **Step 3: Verify syntax**

```bash
node -c scripts/run-preaudit.js && echo "syntax OK"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/run-preaudit.js && git commit -m "feat(v1.7): add resource_leaks to report, bump version"
```

---

### Task 3: Update AGENTS.md — `resource_leaks` consumption rules

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add new rows to JSON Usage Rules table**

After the existing `api_mismatches` rows:
```markdown
| `resource_leaks` | `id: B40/B41` | 🟠 HIGH — "OS resource leak (FD/process)" |
| `resource_leaks` | `id: B42` | 🟠 HIGH — "input loop may exhaust memory" |
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "feat(v1.7): add resource_leaks consumption rules"
```

---

### Task 4: Verify and Tag

- [ ] **Step 1: Syntax check all scripts**

```bash
for f in scripts/*.js; do node -c "$f" && echo "  ✅ $f" || echo "  ❌ $f"; done
```

- [ ] **Step 2: Quick test**

```bash
cd /tmp && rm -rf v17-test && mkdir v17-test && cd v17-test

# B40: open without close
cat > test_b40.c << 'EOF'
void leak(void) { int fd = open("file", 0); /* no close */ }
EOF

# B41: fork without waitpid
cat > test_b41.c << 'EOF'
void zombie(void) { pid_t p = fork(); if (p == 0) { _exit(0); } /* parent: no waitpid */ }
EOF

# B42: scanf in while(1) without check
cat > test_b42.c << 'EOF'
void loop(void) { while (1) { scanf("%d", &x); /* no return check */ } }
EOF

node /path/to/cpp-expert/scripts/run-preaudit.js 2>&1
node -e "const r=require('./unified-audit-report.json'); console.log('resource_leaks:', r.resource_leaks.length); r.resource_leaks.forEach(i => console.log(' ', i.id, i.pattern, 'line', i.line));"
```

Expected output:
```
resource_leaks: 3
  B40 fd_leak line 2
  B41 process_leak line 2
  B42 input_overflow line 2
```

- [ ] **Step 3: Tag**

```bash
cd /path/to/cpp-expert
git tag -a v1.7 -m "cpp-expert v1.7: CASTLE CWE-770 coverage — FD/process/input leak detection"
git log --oneline -5
```
