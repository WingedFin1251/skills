# cpp-expert v1.7 & v1.8 Design Document — CASTLE Benchmark Coverage

**Date:** 2026-07-15
**Based on:** CASTLE-Benchmark 25 CWE evaluation (F1=0.914, P=87.9%, R=95.2%)

## Strategic Rationale

CASTLE-Benchmark results confirm cpp-expert achieves F1=0.914 across 25 CWE
categories with 157 unique bugs. Two remaining weak spots account for 7/7 FN:

| CWE | FN | Root Cause | Approach | Version |
|-----|----|-----------|----------|---------|
| 770 | 4 | OS resource leaks (FD, fork, scanf-loop) | Script — deterministic | v1.7 |
| 362 | 3 | Race conditions (TOCTOU, shared vars) | Rule — AI reasoning | v1.8 |

---

## v1.7: syscall_audit.js Extension (CWE-770)

### New Rules in `syscall_audit.js`

**B40 — File Descriptor Leak**
- Detect: `open()` / `fopen()` / `creat()` / `socket()` / `accept()`
- Verify: matching `close()` / `fclose()` exists within same function
- Exclude: global/scoped wrappers might have close outside (known limitation)
- Severity: 🟠 HIGH

**B41 — Process Leak (extends existing B37)**
- Detect: `fork()` without matching `waitpid()` / `wait()` / `_exit()` in child
- Currently B37 checks cross-file fork/wait ratio; B41 adds per-call check
- Severity: 🟠 HIGH

**B42 — Input Loop Overflow**
- Detect: `scanf()` / `fscanf()` inside `while(1)` or `for(;;)`
- Verify: return value is checked (`!= EOF` / `== expected_count`)
- If unchecked in infinite loop → memory exhaustion
- Severity: 🟠 HIGH

### JSON Schema Extension

```json
{
  "resource_leaks": [
    {
      "id": "B40",
      "severity": "HIGH",
      "file": "Src/io.c",
      "line": 42,
      "detail": "open() at line 42 without matching close() — FD leak"
    },
    {
      "id": "B42",
      "severity": "HIGH",
      "file": "Src/input.c",
      "line": 15,
      "detail": "scanf() in while(1) with unchecked return — potential infinite loop"
    }
  ]
}
```

### AGENTS.md Consumption Rules (v1.7)

New row in the JSON Usage Rules table:

| JSON Field | If Non-Empty | Report Action |
|------------|--------------|---------------|
| `resource_leaks` | `id: B40/B41` | 🟠 HIGH — "OS resource leak" |
| `resource_leaks` | `id: B42` | 🟠 HIGH — "input loop may exhaust memory" |

---

## v1.8: AGENTS.md Concurrency Rules (CWE-362)

### New §4.6 — TOCTOU Race Detection

```markdown
### 4.6 TOCTOU Race Detection (v1.8)

**Impact: HIGH | Category: concurrency**

#### ❌ Incorrect
```c
if (access("file", R_OK) == 0) {
    // TOCTOU: file can be replaced between check and use!
    int fd = open("file", O_RDONLY);
}
```

#### ✅ Correct
```c
// Open first, then check — atomic
int fd = open("file", O_RDONLY);
if (fd >= 0) { process(fd); close(fd); }
```

**Review rule:** When `access()` or `stat()` is followed by `open()` without
synchronization, flag as 🟠 HIGH — TOCTOU race window.
```

### New §4.7 — Shared Variable Locking

```markdown
### 4.7 Shared Variable Locking (v1.8)

**Impact: CRITICAL | Category: concurrency**

When a global or static variable is accessed from multiple thread entry
points (pthread_create callbacks, std::thread), check for:
- `std::mutex` / `pthread_mutex_t` wrapping the access
- `std::atomic<T>` for simple types
- `volatile` only for Cortex-M single-copy-atomic cases

Missing protection → 🔴 CRITICAL data race risk.
```

### New §4.8 — Signal Handler Safety

```markdown
### 4.8 Signal Handler Safety (v1.8)

**Impact: CRITICAL | Category: concurrency**

Signal handlers may only call async-signal-safe functions and access
`volatile sig_atomic_t` variables. Calling `printf()`, `malloc()`,
`free()`, or locking a mutex in a signal handler → 🔴 CRITICAL UB.
```

## Performance Target

| Metric | Current (v1.6) | v1.7 Target | v1.8 Target |
|--------|---------------|-------------|-------------|
| Precision | 87.9% | 87.9% (no new FP) | >88% |
| Recall | 95.2% | >97% (close 4 FN) | >98% |
| F1 Score | 0.914 | >0.93 | >0.94 |
| CWE coverage | 25 | 25 (deeper 770) | 25 (deeper 362) |

## Out of Scope

- Full CFG construction for cross-function FD tracking (v2.0)
- C++ RAII-based leak detection (unique_ptr, shared_ptr) — CWE-770 subset
- Dynamic analysis via ASan/LSan integration
