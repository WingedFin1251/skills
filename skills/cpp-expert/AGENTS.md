# C/C++ Expert Guidelines

**A comprehensive guide for AI agents reviewing C/C++ code**, organized by priority and impact.

---

## Table of Contents

### Language Detection — **MANDATORY**
0. [Language Identification](#rule-0-language-identification)

### Correctness — **CRITICAL**
1. [Memory Safety](#1-memory-safety)
2. [Undefined Behavior & Compilation](#2-undefined-behavior--compilation)

### Resource & Concurrency — **HIGH**
3. [RAII & Resource Management](#3-raii--resource-management)
4. [Concurrency Safety](#4-concurrency-safety)

### Style & Modern Practices — **MEDIUM**
5. [Modern C++ Best Practices](#5-modern-c-best-practices)
    5.7 [Basic C Semantics & Compiler Traps (v1.3)](#57-basic-c-semantics--compiler-traps-v13)
6. [Code Style & Organization](#6-code-style--organization)
    6.1.1 [File-Scope Static Enforcement (v1.5)](#611-file-scope-static-enforcement-v15)

### Review Process — **MANDATORY**
7. [Attention Budget Guide (v1.4)](#attention-budget-guide-v14--mandatory)

---

## Rule 0: Language Identification

**Impact: MANDATORY | Category: meta | Tags:** c-vs-cpp, language-detection

Before applying any rules, identify the language using file extension and code constructs.

| Heuristic | C | C++ |
|-----------|---|-----|
| File extension | `.c`, `.h` | `.cpp`, `.hpp`, `.cc`, `.cxx`, `.hh` |
| Key constructs | `malloc`/`free`, plain `struct` | `class`, `template`, `namespace`, `std::` |
| Standard libs | `<stdio.h>`, `<stdlib.h>` | `<iostream>`, `<vector>`, `<memory>` |

**If C code:** Skip section 5 (Modern C++). Use `free()`+NULL instead of smart pointers. Keep UB, resource management, concurrency, and style rules.

**If C++ code:** Apply all sections fully.

### Attention Budget Guide (v1.4 — MANDATORY)
This section defines how to allocate your limited context attention.

| Stage | Budget | Focus | Constraint |
|-------|--------|-------|------------|
| 0. Preprocessing | 0% | Run `node scripts/run-preaudit.js` (ALL projects, script auto-detects type) | Mandatory if Node.js available |
| 1. Micro Logic | 70% | Single-function semantics | Do NOT read pre-audit JSON |
| 2. Macro Verdict | 30% | Cross-file architecture | Read ONLY `unified-audit-report.json` |

**Rules:**
- In Stage 1, do NOT think about GPIO conflicts, ISR priorities, or control chains
- In Stage 2, do NOT re-read raw GPIO/ISR/DMA init code — the JSON is the sole source of truth
- If `unified-audit-report.json` does not exist → degradation mode: guide user manually

### Unified Audit Report — Usage Rules (v1.4)

When `unified-audit-report.json` is present, you MUST use it as the **sole source of truth** for hardware conflicts, control chain continuity, and ISR stack risks.

| JSON Field | If Non-Empty | Report Action |
|------------|--------------|---------------|
| `pin_conflicts` | Yes | 🔴 CRITICAL — include all occurrences with file/line in final report |
| `control_chain_breaks` | `severity: HIGH` | 🟠 HIGH — "control loop open — no ISR/RTOS call" |
| `control_chain_breaks` | `severity: WARNING` | 🟡 MEDIUM — "function pointer escape — verify runtime" |
| `stack_overflow_risks` | `severity: HIGH` | 🟠 HIGH — include estimated depth and file/line |
| `stack_overflow_risks` | `severity: MEDIUM` | 🟡 MEDIUM — "stack usage advisory" |
| `style_issues` | `id: B15` | 🟠 HIGH — "file-scope global — should be static" |
| `style_issues` | Others | 🟡 MEDIUM — "code style or structure concern" |
| `build_orphans` | Yes | 🟠 HIGH — "orphan source — not compiled (dead code)" |
| `syscall_issues` | `id: B31` | 🟠 HIGH — "I/O return value unchecked" |
| `syscall_issues` | `id: B32` | 🟠 HIGH — "zombie process risk" |
| `syscall_issues` | `id: B33` | 🔴 CRITICAL — "putenv on string literal — UB" |
| `syscall_issues` | `id: B36` | 🟡 MEDIUM — "dlopen without dlclose" |
| `syscall_issues` | `id: B37` | 🔴 CRITICAL — "fork without waitpid — zombie leak" |
| `api_mismatches` | `id: B34` | 🔴 CRITICAL — "macro arity mismatch — possible API version mixing" |
| `api_mismatches` | `id: B35` | 🟠 HIGH — "deprecated API usage" |

**Degradation mode (no JSON available):**
- Do NOT claim specific line numbers you cannot verify.
- Output: "⚠️ Pre-audit unavailable. Based on Stage 1 scanning, potential GPIO/control issues noted at [general location]. Manual verification recommended."
- Downgrade severity by one level when based solely on manual inspection.

**Skipped Module Rules (v1.6.1 — MANDATORY):**
- **Skipped != Passed**: If a module's status is `skipped` or `skipped_no_build_system`,
  you MUST NOT conclude the code is safe in that aspect. The tool had a blind spot.
- **Contextual Awareness**:
  - If `build_audit` skipped (Keil/IAR): "Source compilation tracking was not performed
    due to incompatible build system. Manual verification of source file inclusion in the
    IDE project is recommended."
  - If `syscall_audit` skipped (Embedded): Do not mention system call issues.

## 1. Memory Safety

**Impact: CRITICAL | Category: memory-safety | Tags:** pointers, leaks, buffer-overflow

### Why This Matters
Memory bugs are the #1 cause of security vulnerabilities in C/C++. Use-after-free,
buffer overflows, and double-free lead to exploitable crashes and data corruption.

### 1.1 Prefer Smart Pointers Over Raw Ownership

#### ❌ Incorrect

```cpp
void process() {
    Widget* w = new Widget();
    w->doWork();
    delete w;  // Not exception-safe — leaks if doWork() throws
}
```

#### ✅ Correct

```cpp
#include <memory>

void process() {
    auto w = std::make_unique<Widget>();
    w->doWork();
}  // Automatically deleted, exception-safe
```

### 1.2 Use `make_unique` / `make_shared` Over `new` / `delete`

#### ❌ Incorrect

```cpp
auto p = std::shared_ptr<Widget>(new Widget);
// Separate allocation + construction — leak between new and shared_ptr ctor
```

#### ✅ Correct

```cpp
auto p = std::make_shared<Widget>();  // Single allocation, exception-safe
```

### 1.3 Avoid Dangling Pointers and References

#### ❌ Incorrect

```cpp
int* get_data() {
    int local = 42;
    return &local;  // BUG: returning reference to stack variable
}
```

#### ✅ Correct

```cpp
int* get_data() {
    auto p = std::make_unique<int>(42);
    return p.release();  // Transfer ownership (caller must delete)
}

// Better: return by value
int get_data_value() {
    return 42;
}
```

### 1.4 For C Code: Nullify Freed Pointers

#### ❌ Incorrect

```c
#include <stdlib.h>

void process() {
    int* p = malloc(sizeof(int) * 10);
    free(p);
    // p is now dangling
    if (p) {        // Useless check — free() doesn't set p to NULL
        p[0] = 1;   // Use-after-free!
    }
}
```

#### ✅ Correct

```c
#include <stdlib.h>

void process() {
    int* p = malloc(sizeof(int) * 10);
    free(p);
    p = NULL;  // Prevents accidental reuse
}
```

### 1.5 Track Borrowed Lifetimes

#### ❌ Incorrect

```cpp
const int* get_data() {
    static std::vector<int> data = {1, 2, 3};
    return data.data();  // Caller does not know when this pointer becomes invalid
}

void process() {
    const int* ptr = get_data();
    // If internal operation causes data to reallocate...
    // ptr is now dangling!
    use(*ptr);           // Use-after-free
}
```

#### ✅ Correct

```cpp
#include <span>

std::span<const int> get_data() {
    static std::vector<int> data = {1, 2, 3};
    return data;  // span carries size and bounds information
}

void process() {
    auto view = get_data();
    use(view[0]);        // span documents the expected lifetime contract
}

// Even better: return by value
std::vector<int> get_data_copy() {
    return {1, 2, 3};    // No lifetime ambiguity
}
```

#### Why This Matters
Returning raw pointers to internally-owned data creates implicit lifetime
contracts that callers cannot verify. `std::span` documents the intent
(a non-owning view) and carries size information, reducing the chance of
buffer overruns and dangling accesses.

## 2. Undefined Behavior & Compilation

**Impact: CRITICAL | Category: ub-compilation | Tags:** ub, overflow, aliasing, odr

### Why This Matters
Undefined behavior means the compiler can generate ANY code — including code that
appears to work until the worst possible moment. These bugs are notoriously hard
to debug.

### 2.1 Avoid Signed Integer Overflow

#### ❌ Incorrect

```cpp
int multiply(int a, int b) {
    return a * b;  // UB if overflow occurs
}
```

#### ✅ Correct

```cpp
#include <limits>

bool multiply_safe(int a, int b, int& result) {
    if (a > 0 && b > 0 && a > std::numeric_limits<int>::max() / b)
        return false;  // Would overflow
    result = a * b;
    return true;
}
```

### 2.2 Initialize All Variables

#### ❌ Incorrect

```cpp
int count;
// ... some code ...
if (condition) count = 10;
use(count);  // UB if condition was false — count is uninitialized
```

#### ✅ Correct

```cpp
int count = 0;  // Always initialize
if (condition) count = 10;
use(count);
```

### 2.3 Mark Destructors `virtual` in Base Classes

#### ❌ Incorrect

```cpp
class Base {
    ~Base() {}  // Non-virtual — deleting Derived through Base* is UB
};

class Derived : public Base {
    int* data;
};
```

#### ✅ Correct

```cpp
class Base {
    virtual ~Base() = default;  // Virtual destructor
};

class Derived : public Base {
    std::unique_ptr<int> data;
};
```

### 2.4 Avoid Strict Aliasing Violations

#### ❌ Incorrect

```cpp
float f = 3.14f;
int* i = reinterpret_cast<int*>(&f);  // UB — dereferencing aliases different types
```

#### ✅ Correct

```cpp
float f = 3.14f;
int i;
memcpy(&i, &f, sizeof(f));  // OK — memcpy is the legal way to re-interpret bytes
```

### 2.5 No Throwing From Destructors

#### ❌ Incorrect

```cpp
class Resource {
    ~Resource() {
        cleanup();  // May throw — terminates if stack is unwinding
    }
};
```

#### ✅ Correct

```cpp
void cleanup();  // Forward declaration

class Resource {
    ~Resource() noexcept {
        try {
            cleanup();
        } catch (...) {
            // Log and swallow — destructors must not throw
        }
    }
};
```


### 2.6 Watch for C ABI Boundary Violations

#### ❌ Incorrect

```cpp
// Widget has non-trivial members -- layout is not standard
struct Widget {
    std::string name;
    int id;
};

extern "C" void process(Widget w);  // UB! Non-standard-layout type across C ABI
```

#### ✅ Correct

```cpp
struct WidgetData {
    char name[64];
    int id;
};
static_assert(std::is_standard_layout_v<WidgetData>, "C ABI requires standard layout");

extern "C" void process(WidgetData d);  // OK -- standard layout type
```

#### Why This Matters
C++ types passed through `extern "C"` boundaries must be standard-layout
(`std::is_standard_layout`). Non-standard-layout types (those with virtual
functions, non-static members with different access control, or members of
reference type) have undefined layout, and passing them across C ABI
boundaries is undefined behavior.

### 2.7 Control Algorithm Continuity (v1.2)

**Impact: MEDIUM | Category: ub-compilation | Tags:** control, math, boundary, continuity

#### Why This Matters
When reviewing motor control, power conversion, or signal processing code,
AI often misidentifies **mathematically continuous** piecewise functions
as "boundary bugs". A sector boundary with `<=` on one side and `<` on the
other is harmless when the underlying function is continuous at that point.

#### ❌ Incorrect (false positive)

```cpp
// Misidentified as "boundary discontinuity" — but it IS continuous
if (theta >= 0.0f && theta <= PI / 3.0f) {
    t4 = 1.5f * Ur * sinf(PI / 3.0f - theta);
    // At theta = PI/3: t4 = 1.5*Ur*sin(0) = 0
} else if (theta <= 2.0f * PI / 3.0f) {
    t4 = 1.5f * Ur * sinf(theta - PI / 3.0f);
    // At theta = PI/3: t4 = 1.5*Ur*sin(0) = 0 ✅ continuous
}
```

#### ✅ Correct (genuine discontinuity)

```cpp
// GENUINE discontinuity — denominator changes sign
if (abs_vd < 1e-6f) {
    // division by zero imminent → handle separately
} else {
    result = vq / vd;  // sign change across threshold
}
```

#### Review Rule
For piecewise math functions (SVPWM, Clark/Park, filters, interpolation):

1. **Continuity test**: evaluate both branches at the boundary point — same result? → no bug
2. **Domain check**: division by zero, sqrt(negative), log(negative) → genuine 🔴 CRITICAL
3. **Limit behavior**: if the function is `sin`, `cos`, `tanh`, `exp`, or a polynomial, the
   boundary condition is almost certainly continuous unless there's a denominator zero
4. **Report calibration**: flag boundary concerns as 🟡 MEDIUM or lower when continuity
   can be verified, unless a division/mod/domain error is identified

---

## 3. RAII & Resource Management

**Impact: HIGH | Category: raii-resource | Tags:** raii, rule-of-five, cleanup, exception-safety

### Why This Matters
RAII (Resource Acquisition Is Initialization) is the cornerstone of C++ resource
management. Every resource (memory, file handle, mutex, socket) should be owned
by a stack-allocated object whose destructor releases it.

### 3.1 Follow the Rule of Five

If a class defines any of: destructor, copy constructor, copy assignment, move
constructor, or move assignment — define all five (or =default/=delete them).

#### ❌ Incorrect

```cpp
#include <cstddef>

class Buffer {
    int* data;
    std::size_t size;
public:
    Buffer(std::size_t n) : data(new int[n]), size(n) {}
    ~Buffer() { delete[] data; }
    // Missing copy/move — compiler-generated shallow copy leads to double-free!
};
```

#### ✅ Correct

```cpp
class Buffer {
    std::vector<int> data;  // Let vector handle Rule of Five
public:
    explicit Buffer(size_t n) : data(n) {}
};

// Or if manual management is truly needed:
class Buffer {
    std::unique_ptr<int[]> data;
    size_t size;
public:
    Buffer(size_t n) : data(std::make_unique<int[]>(n)), size(n) {}
    // unique_ptr = move-only, Rule of Five handled automatically
};
```

### 3.2 Prefer `std::vector` Over Raw Arrays

#### ❌ Incorrect

```cpp
int* arr = new int[n];
// Manual bounds tracking, manual delete[]
```

#### ✅ Correct

```cpp
std::vector<int> vec(n);  // Automatic bounds, automatic cleanup
vec.push_back(42);         // Can grow
```

### 3.3 Use RAII Wrappers for All OS Resources

#### ❌ Incorrect

```cpp
void write_log(const char* msg) {
    FILE* f = fopen("log.txt", "a");
    if (!f) return;
    fprintf(f, "%s\n", msg);
    fclose(f);  // Leaks if fprintf throws (it won't in C, but in C++...)
}
```

#### ✅ Correct

```cpp
void write_log(const std::string& msg) {
    std::ofstream f("log.txt", std::ios::app);
    if (!f) return;
    f << msg << std::endl;
    // Automatically closed when f goes out of scope
}
```

### 3.4 Exception Safety Guarantees

#### ❌ Incorrect

```cpp
void process_data(Container& c) {
    c.reserve(c.size() + 10);
    // If next line throws, c is left in modified state with no rollback
    modify_elements(c);
}
```

#### ✅ Correct

```cpp
void process_data(Container& c) {
    auto snapshot = c;              // Copy original
    c.reserve(c.size() + 10);
    try {
        modify_elements(c);
    } catch (...) {
        c = std::move(snapshot);    // Rollback on failure (strong guarantee)
        throw;
    }
}
```

## 4. Concurrency Safety

**Impact: HIGH | Category: concurrency | Tags:** threads, mutex, data-race, deadlock

### Why This Matters
Data races are undefined behavior in C++. The compiler and hardware can reorder
operations in ways that break unsynchronized concurrent access, leading to
impossible-to-reproduce bugs.

### 4.1 Use `std::scoped_lock` for Multiple Mutexes

#### ❌ Incorrect

```cpp
void transfer(Account& from, Account& to, int amount) {
    std::lock_guard<std::mutex> lk1(from.mtx);
    std::lock_guard<std::mutex> lk2(to.mtx);
    // DEADLOCK if another thread calls transfer(to, from) simultaneously
    from.balance -= amount;
    to.balance += amount;
}
```

#### ✅ Correct

```cpp
void transfer(Account& from, Account& to, int amount) {
    std::scoped_lock lk(from.mtx, to.mtx);  // Lock both with deadlock avoidance
    from.balance -= amount;
    to.balance += amount;
}
```

### 4.2 Avoid Locking Where Not Needed — Use `std::atomic`

#### ❌ Incorrect

```cpp
int counter;
std::mutex mtx;

void increment() {
    std::lock_guard lk(mtx);
    ++counter;  // Heavyweight — mutex for a single int
}
```

#### ✅ Correct

```cpp
std::atomic<int> counter{0};

void increment() {
    ++counter;  // Lock-free on most platforms
}
```

### 4.3 Thread-Safe Initialization

#### ❌ Incorrect

```cpp
static std::shared_ptr<Config> config;
std::shared_ptr<Config> get_config() {
    if (!config) {
        config = std::make_shared<Config>();  // Double-checked locking bug!
    }
    return config;
}
```

#### ✅ Correct

```cpp
Config& get_config() {
    static Config config;  // Function-local static — thread-safe in C++11+
    return config;
}

// Or:
std::once_flag flag;
std::unique_ptr<Config> config;

void init_config() {
    std::call_once(flag, []() {
        config = std::make_unique<Config>();
    });
}
```

### 4.4 Handle Spurious Wakeups in Condition Variables

#### ❌ Incorrect

```cpp
std::condition_variable cv;
std::mutex mtx;
bool ready = false;

void wait_for_work() {
    std::unique_lock lk(mtx);
    cv.wait(lk);  // May return even if ready is still false (spurious wakeup)
}
```

#### ✅ Correct

```cpp
void wait_for_work() {
    std::unique_lock lk(mtx);
    cv.wait(lk, []{ return ready; });  // Predicate handles spurious wakeups
}
```

---

### 4.5 Architecture-Specific Atomicity (v1.2)

**Impact: HIGH | Category: concurrency | Tags:** atomic, architecture, arm, cortex-m

#### Why This Matters
Not all architectures treat unguarded variable access the same. On
Cortex-M3/M4/M7, 32-bit aligned reads and writes are **single-copy
atomic**. Flagging every cross-interrupt variable access as 🔴 CRITICAL
overestimates the risk on these platforms.

#### Architecture Atomicity Table

| Architecture | 32-bit aligned | 64-bit | volatile needed? |
|-------------|---------------|--------|-----------------|
| Cortex-M0/M0+ | ❌ Not atomic | ❌ | ✅ yes |
| **Cortex-M3/M4/M7** | ✅ **Single-copy atomic** | ❌ | ✅ yes for compiler |
| Cortex-A (generic) | ❌ Depends on cache policy | ❌ | ✅ yes |
| x86/x64 | ✅ Up to 64-bit | ✅ (if aligned) | ✅ yes for compiler |

#### ❌ Incorrect (over-escalated)

```cpp
// 🔴 WRONG for Cortex-M4 — 32-bit float access IS atomic on M4
// Only missing volatile risk: compiler may cache the value
float sensor_value;  // Missing volatile

void EXTI_IRQHandler() {
    sensor_value = read_adc();  // 32-bit aligned store → atomic on M4
}

void control_loop() {
    if (sensor_value > 50.0f) { ... }  // compiler may use stale value
}
```

#### ✅ Correct

```cpp
// 🟡 MEDIUM — no tear, but compiler might cache
volatile float sensor_value;  // volatile prevents compiler caching

void EXTI_IRQHandler() {
    sensor_value = read_adc();  // atomic store, compiler won't skip
}

void control_loop() {
    if (sensor_value > 50.0f) { ... }  // re-reads every time
}
```

#### Calibration Rule
When reviewing shared-variable access across ISR/main contexts:

1. **Check architecture**: if Cortex-M3/M4/M7 with 32-bit aligned access → tear is not the risk
2. **Check volatile**: missing volatile → compiler optimization risk → 🟠 HIGH, not 🔴 CRITICAL
3. **Check access size**: if type > 32-bit (double, 64-bit struct) or unaligned → 🔴 CRITICAL tear possible
4. **Document reasoning**: note the architecture context in the report so the reader understands the calibration

---


## 5. Modern C++ Best Practices

**Impact: MEDIUM | Category: modern-cpp | Tags:** cpp11, cpp14, cpp17, cpp20

### Why This Matters
Modern C++ (C++11 and later) provides safer, clearer, and often faster alternatives
to older idioms. Migrating to modern constructs reduces bugs and improves readability.

### 5.1 Prefer `auto` for Type Deduction

#### ❌ Incorrect

```cpp
std::vector<std::pair<int, std::string>>::const_iterator it = v.begin();
```

#### ✅ Correct

```cpp
auto it = v.cbegin();  // Clear, concise, and always correct
```

### 5.2 Use `nullptr` Instead of `NULL` or `0`

#### ❌ Incorrect

```cpp
void* ptr = NULL;
void* ptr2 = 0;
```

#### ✅ Correct

```cpp
void* ptr = nullptr;  // Type-safe, unambiguous
```

### 5.3 Use `override` on All Overridden Virtual Functions

#### ❌ Incorrect

```cpp
class Derived : public Base {
    void doSomething();  // Is this overriding or hiding? Unclear.
};
```

#### ✅ Correct

```cpp
class Derived : public Base {
    void doSomething() override;  // Compiler will error if nothing to override
};
```

### 5.4 Use `enum class` Over Plain `enum`

#### ❌ Incorrect

```cpp
enum Color { RED, GREEN, BLUE };
enum Fruit { APPLE, BANANA };
// RED and APPLE are in the same scope! Conflict!
```

#### ✅ Correct

```cpp
enum class Color { RED, GREEN, BLUE };
enum class Fruit { APPLE, BANANA };
// Scoped: Color::RED, Fruit::APPLE — no conflicts
```

### 5.5 Use `constexpr` for Compile-Time Values

#### ❌ Incorrect

```cpp
int array_size = 100;  // Runtime variable — not usable in template params
```

#### ✅ Correct

```cpp
constexpr int array_size = 100;  // Compile-time constant
std::array<int, array_size> data;  // OK
```

### 5.6 Use `[[nodiscard]]` to Prevent Ignoring Return Values

#### ❌ Incorrect

```cpp
int compute_result();
// Caller can accidentally ignore:
compute_result();  // Return value discarded silently
```

#### ✅ Correct

```cpp
[[nodiscard]] int compute_result();
// Compiler warns: "discarding return value of 'nodiscard' function"
```

### 5.7 Basic C Semantics & Compiler Traps (v1.3)

**Impact: CRITICAL | Category: c-semantics | Tags:** pass-by-value, volatile, array-bounds, variable-shadowing, optimization

#### Why This Matters
The F1 analysis of 15 real-world embedded bugs showed that **micro-logic
errors** (pass-by-value, variable shadowing, volatile-omission) are the
most frequently missed category. They hide in plain sight because macro-
architecture thinking consumes attention tokens.

#### Mandatory Checks (do NOT skip these)

**1. Function Parameter Pass-by-Value**

```c
// ❌ CRITICAL: pass-by-value cannot modify the caller's variable
void normalize(float angle) {
    if (angle > 360.0f) angle -= 360.0f;  // modifies local copy only!
}

// ✅ Must use pointer
void normalize(float *angle) {
    if (*angle > 360.0f) *angle -= 360.0f;
}
```

**2. Empty-Loop Optimization Trap**

```c
// ❌ BUG: Compiled away at -O2 — optimizer removes the empty body
for (i = 0; i < 1000; i++);

// ✅ volatile prevents optimization
for (volatile int i = 0; i < 1000; i++);

// ✅ Or use HAL_Delay / library delay
HAL_Delay(1);
```

**3. Array Bounds with Narrow Index Type**

```c
// ❌ Potential overflow: u8 can only index 0-255
void process(u8 times, uint8_t *buf) {
    for (u8 i = 0; i < times; i++) {
        buf[i] = 0;  // if times > 255: i wraps to 0, infinite loop or overflow
    }
}

// ✅ Use matching sizes
void process(size_t times, uint8_t *buf) {
    for (size_t i = 0; i < times; i++) {
        buf[i] = 0;
    }
}
```

**4. Variable Shadowing / Misuse in Sequential Assignments**

```c
// ❌ BUG: V_err_all accumulates Ierr instead of V_err
V_err_all = V_err_all + Ierr;  // Should be: V_err_all + V_err

// ❌ BUG: consecutive assignments with subtle copy-paste error
Ia_ctrl = PID_Calc(&pid_Ia, Ia_fbk);  // correct
Va_ctrl = PID_Calc(&pid_Ia, Ia_fbk);  // copy-paste: should be Va_fbk!
```

**5. Redundant `volatile` for Hardware-Register Width**

```c
// ❌ CRITICAL: compiler may cache reads from peripheral registers
uint32_t get_status() {
    while (!(USART1->SR & USART_SR_RXNE));  // SR read may not happen each time!
    return USART1->DR;
}

// ✅ Volatile forces re-read on every access
#define USART1_SR  (*(volatile uint32_t *)USART1_BASE + 0x00)
```

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

## 6. Code Style & Organization

**Impact: MEDIUM | Category: style | Tags:** naming, headers, const, formatting

### Why This Matters
Consistent style reduces cognitive overhead, makes code review faster, and
prevents trivial style debates from blocking meaningful technical discussion.

### 6.1 Naming Conventions

#### ❌ Incorrect

```cpp
class user_account {
    int ID;
    string GetName() { ... }
};

int calc_value(int x) {
    return x * 2;
}
```

#### ✅ Correct

```cpp
class UserAccount {  // PascalCase for types
    int id_;          // snake_case with trailing _ for member variables (Google style)
public:
    std::string GetName() const { ... }  // PascalCase methods or snake_case — be consistent
};

int calculate_value(int x) {  // snake_case for functions
    return x * 2;
}
```

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

### 6.2 Include Order

#### ❌ Incorrect

```cpp
#include <vector>
#include "my_header.h"
#include <iostream>
#include <algorithm>
```

#### ✅ Correct

```cpp
#include "my_header.h"     // 1. Own header (catches missing includes early)
#include <algorithm>        // 2. Standard library
#include <iostream>
#include <vector>
#include "project/utils.h"  // 3. Project headers
```

### 6.3 Header Guards

#### ❌ Incorrect

```cpp
// my_header.h — no guard! Will cause redefinition errors
```

#### ✅ Correct

```cpp
#pragma once  // Simple, modern — supported by all major compilers

// Or traditional:
#ifndef MY_HEADER_H_
#define MY_HEADER_H_
// ...
#endif
```

### 6.4 Const Correctness

#### ❌ Incorrect

```cpp
std::string get_name(/* should be const ref */ User& u) {
    return u.name_;
}

void print_data(/* should be const */ std::vector<int>& data) {
    for (auto x : data) std::cout << x;
}
```

#### ✅ Correct

```cpp
std::string get_name(const User& u) {  // Const-ref: no copy, no mutation
    return u.name_;
}

void print_data(const std::vector<int>& data) {  // Read-only guaranteed
    for (auto x : data) std::cout << x;
}
```

### 6.5 Header-Source Separation

#### ❌ Incorrect

```cpp
// my_class.h
#include <iostream>
using namespace std;  // Pollutes namespace of every file that includes this

class MyClass {
    void doSomething();  // Implementation in header — OK for inline, but...
};
```

#### ✅ Correct

```cpp
// my_class.h — declarations only
class MyClass {
    void doSomething();
};

// my_class.cpp — implementations
#include "my_class.h"
void MyClass::doSomething() {
    // implementation
}
```

---

## Code Review Report Format

When reviewing C/C++ code, structure your output as:

```markdown
## Summary
[Brief overview of the code and main issues found]

## Critical Issues 🔴

### 1. [Issue Title]
**File:** `path/to/file.cpp:42`
**Call path:** [main() → init → ... → function — required: prove this code is reachable]
**Issue:** [Description of the problem]
**Impact:** [Why this matters — e.g., "use-after-free leads to exploitable crash"]
**Fix:**
```cpp
// Corrected code
```

## High Priority 🟠

### 1. [Issue Title]
...

## Medium Priority 🟡

...

## Tool Results
### Syntax Check (`g++ -fsyntax-only`)
```
[compiler output if run]
```
### Static Analysis (clang-tidy + cppcheck)
```
[script output]
```
### Sanitizer (ASan/UBSan) — if run
```
[script output]
```

## Issue Count
- 🔴 CRITICAL: N
- 🟠 HIGH: N
- 🟡 MEDIUM: N

**Recommendation:** [Overall assessment and next steps]
```

## Quick Reference

### Priority Matrix

| Level | Description | Examples | Action |
|-------|-------------|----------|--------|
| **CRITICAL** | Memory corruption, UB, security | Use-after-free, overflow, deadlock | Fix immediately |
| **HIGH** | Resource leaks, correctness risk | Missing Rule of Five, data race | Fix before merge |
| **MEDIUM** | Style, modern idioms | Missing override, `NULL` vs `nullptr` | Fix or accept |

### References

- [cppreference.com](https://en.cppreference.com/)
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/)
- [SEI CERT C++ Coding Standard](https://wiki.sei.cmu.edu/confluence/pages/viewpage.action?pageId=88046682)
