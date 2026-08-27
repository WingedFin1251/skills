# cpp-expert v1.6 Design Document — Full-Scope C/C++ Audit Platform

**Date:** 2026-07-13
**Based on:** NAPI HarmonyOS code review (application-layer C/C++ gaps identified)

## Strategic Shift

v1.6 expands cpp-expert from "embedded hardware review" to "full-scope C/C++ audit platform":

```
v1.0-v1.5:  Embedded STM32 focus
            └─ GPIO, DMA, RCC, FreeRTOS, ISR stack

v1.6:       Embedded + Application focus
            ├─ Embedded: same as v1.5
            └─ Application: CMake build, POSIX syscalls, API consistency
```

The expansion is driven by project type auto-routing (Approach A).

## New Scripts

### `scripts/build_audit.js`
- Scan `CMakeLists.txt` for `add_library`/`add_executable`/`set(SOURCES ...)`
- Extract compiled source file list
- Cross-reference with actual `.c/.cpp` files in `Src/`
- Report orphan files (exist but never compiled)
- Output `build_orphans: [{ id: 'B30', severity: 'HIGH', file, detail }]`
- Also check CMake files listed but missing on disk (bidirectional)
- Support `target_sources()`, recursive CMakeLists.txt, variable expansion

### `scripts/syscall_audit.js`
| ID | Detection | Logic | Severity |
|----|-----------|-------|----------|
| B31 | Unchecked I/O | `fwrite`/`fread`/`chmod` not wrapped in `if` | 🟠 HIGH |
| B32 | Zombie risk | `waitpid(WNOHANG)` without retry loop surrounding | 🟠 HIGH |
| B33 | const_cast UB | `putenv(const_cast<char*>("..."))` | 🔴 CRITICAL |
| B36 | `dlopen`/`dlclose` mismatch | Opened library without close | 🟠 HIGH |
| B37 | `fork()`/`waitpid()` mismatch | Fork count > waitpid count | 🔴 CRITICAL |
| B38 | Deprecated C APIs | `strcpy`/`sprintf`/`gets` | 🟠 HIGH |
| B39 | `malloc`/`free` mismatch | Alloc without paired free (basic heuristic) | 🟠 HIGH |

### `scripts/api_style_audit.js`
| ID | Detection | Logic | Severity |
|----|-----------|-------|----------|
| B34 | Macro arity mismatch | Same macro called with different arg counts across files | 🔴 CRITICAL |
| B35 | Deprecated API | `sprintf`, `strcpy`, `gets` detected | 🟠 HIGH |

**Notes:**
- Variadic macros (`#define LOG(fmt, ...)`) are excluded from B34
- C++ function overloads (same name, different params) excluded from B34
- Macro definitions scanned from headers before analyzing call sites

## Project Type Routing

```
run-preaudit.js v1.6:

detectProjectType(rootDir):
  if (Drivers/ + stm32*hal.h) or (platformio.ini) or (.vscode/STM32) → 'embedded'
  if CMakeLists.txt or Makefile or BUILD.gn → 'app'
  default → 'app'

if embedded
  → run pin_audit, ctrl_chain_check, stack_depth_audit
else if app
  → run build_audit, syscall_audit

always run: style_audit, api_style_audit
```

## JSON Schema Extension

```json
{
  "build_orphans": [{ "id": "B30", "severity": "HIGH", "file": "Src/unused.cpp", "detail": "File exists but not in CMakeLists.txt" }],
  "syscall_issues": [{ "id": "B31", "severity": "HIGH", "file": "Src/main.c", "line": 42, "detail": "fwrite return unchecked" }],
  "api_mismatches": [{ "id": "B34", "severity": "CRITICAL", "detail": "OH_LOG_INFO: 2 args in a.c, 3 args in b.c" }]
}
```

## AGENTS.md Consumption Rules

| JSON Field | If Non-Empty | Report Action |
|------------|--------------|---------------|
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

## Performance Target

| Metric | v1.5 | v1.6 Target |
|--------|------|-------------|
| Precision | 100% | 100% |
| Recall (embedded) | 76.2% | >85% |
| Recall (app-layer) | — | >80% (new baseline) |
| F1 (embedded) | 0.86 | >0.92 |
| Project types | 1 (embedded) | 2 (embedded + app) |

## Out of Scope

- WebAssembly/JS C/C++ toolchain support
- Linux kernel module review
- Python/C extension review
