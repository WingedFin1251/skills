# ArkTS/HarmonyOS Expert Guidelines

**A comprehensive guide for AI agents reviewing ArkTS/HarmonyOS code**, organized by priority and impact.

---

## Table of Contents

### Version Detection — **MANDATORY**
0. [HarmonyOS Version Detection](#0-harmonyos-version-detection)

### Correctness — **CRITICAL**
1. [ArkTS Syntax Rules](#1-arkts-syntax-rules)
2. [State Management](#2-state-management)
3. [UI Components](#3-ui-components)

### Resource & Performance — **HIGH**
4. [Navigation & Routing](#4-navigation--routing)
5. [Performance Optimization](#5-performance-optimization)
6. [Side Effects & Lifecycle](#6-side-effects--lifecycle)
7. [Android → HarmonyOS Migration](#7-android--harmonyos-migration)

### Style — **MEDIUM**
8. [Code Style & Organization](#8-code-style--organization)

### Review Process — **MANDATORY**
9. [Attention Budget Guide](#attention-budget-guide--mandatory)

---

## Attention Budget Guide (v1.0 — MANDATORY)

This section defines how to allocate your limited context attention.

| Stage | Budget | Focus | Constraint |
|-------|--------|-------|------------|
| 1. Micro Logic | 70% | Single-file, single-function semantics | Do NOT think about cross-file architecture |
| 2. Macro Verdict | 30% | Cross-file patterns, migration, performance | Do NOT re-read single-function logic |

**Rules:**
- In Stage 1, do NOT consider navigation, performance, or Android migration
- In Stage 2, do NOT re-verify syntax or state decorators — those are Stage 1 findings
- If code is large (>500 lines), prioritize: syntax → state → UI first, then navigation → performance → migration

**Degradation mode (no project config found):**
- Do NOT claim specific API version you cannot verify.
- Output: "⚠️ API version undetected. Applying all V1+V2 rules. Manual verification of target API version recommended."
- Apply the broadest rule set when uncertain.

**Skipped File Rules (v1.0 — MANDATORY):**
- **Skipped != Passed**: If a file was not scanned due to size or context limits,
  you MUST NOT conclude the code is safe in that file. You had a blind spot.
- **Contextual Awareness**:
  - If `.ets` files skipped: "Some ETS files were not scanned due to context limits. Manual review recommended."
  - If `.ts` files skipped: "TypeScript utility files were not scanned. Verify type definitions manually."

---

## 0. HarmonyOS Version Detection

**Impact: MANDATORY | Category: meta | Tags:** harmonyos-version, api-detection

Before applying any rules, determine the target API version from `build-profile.json5` or `module.json5`:

| Heuristic | API 9 | API 10+ | API 12+ |
|-----------|-------|---------|---------|
| Core | ArkTS V1 | ArkTS V1 + V2 preview | ArkTS V2 stable |
| State Mgmt | @State/@Prop/@Link | V1 + @ObservedV2/@Trace | V2 full |
| Navigation | router (deprecated) | Navigation component | Navigation + NavDestination |
| Component | struct components | struct + custom | Custom Component Model |

**If API 9:** Apply V1 state management only. Flag deprecated router usage.
**If API 10+:** Prefer Navigation over router. Use V1 state management.
**If API 12+:** Recommend V2 state management for new code. Migration guide for V1.

---

## 1. ArkTS Syntax Rules

**Impact: CRITICAL | Category: arkts-syntax | Tags:** no-any-unknown, limited-throw, inferred-generics, implicit-return-types

### Why This Matters
ArkTS is a strict subset of TypeScript optimized for AOT compilation. These rules exist because the compiler cannot optimize `any`/`unknown` types, non-Error throws break stack unwinding, and missing type parameters force runtime inference.

### 1.1 arkts-no-any-unknown

ArkTS禁止使用 `any` 或 `unknown` 类型。TypeScript 的动态类型特性在 ArkTS 中不可用。

#### ❌ Incorrect

```typescript
function processData(data: any) {  // ERROR: arkts-no-any-unknown
  console.log(data.name);
}

function convert(value: unknown) {  // ERROR: arkts-no-any-unknown
  return value as string;
}
```

#### ✅ Correct

```typescript
interface UserData {
  name: string;
  age: number;
}

function processData(data: UserData) {
  console.log(data.name);
}

function convert(value: string): string {
  return value.toUpperCase();
}
```

### 1.2 arkts-limited-throw

ArkTS限制 `throw` 只能抛出 `Error` 类及其子类实例。不能抛出字符串、数字或其他对象。

#### ❌ Incorrect

```typescript
function validate(input: string) {
  if (!input) {
    throw "Input is empty";  // ERROR: arkts-limited-throw
  }
  if (input.length > 100) {
    throw 42;  // ERROR: arkts-limited-throw
  }
}
```

#### ✅ Correct

```typescript
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function validate(input: string) {
  if (!input) {
    throw new ValidationError("Input is empty");
  }
  if (input.length > 100) {
    throw new RangeError("Input too long");
  }
}
```

### 1.3 arkts-no-inferred-generic-params

ArkTS要求泛型调用显式指定类型参数。不能依赖类型推断。

#### ❌ Incorrect

```typescript
function createPromise(): Promise {  // ERROR: missing type parameter
  return new Promise((resolve) => {
    resolve("done");
  });
}

const result = Promise.resolve(42);  // ERROR: inferred generic param
```

#### ✅ Correct

```typescript
function createPromise(): Promise<string> {
  return new Promise<string>((resolve) => {
    resolve("done");
  });
}

const result = Promise.resolve<number>(42);
```

### 1.4 arkts-no-implicit-return-types

ArkTS要求所有函数显式标注返回类型。不能依赖类型推断。

#### ❌ Incorrect

```typescript
function calculate(a: number, b: number) {  // ERROR: missing return type
  return a + b;
}

function fetchData() {  // ERROR: missing return type
  return fetch("/api/data");
}
```

#### ✅ Correct

```typescript
function calculate(a: number, b: number): number {
  return a + b;
}

function fetchData(): Promise<Response> {
  return fetch("/api/data");
}
```

### 1.5 arkts-no-untyped-obj-literals

ArkTS禁止未类型化的对象字面量直接作为参数传递。

#### ❌ Incorrect

```typescript
interface Config {
  url: string;
  timeout: number;
}

function fetchWithConfig(config: Config) { /* ... */ }

// ERROR: Object literal with no type annotation
fetchWithConfig({ url: "https://example.com", timeout: 5000 });
```

#### ✅ Correct

```typescript
const config: Config = {
  url: "https://example.com",
  timeout: 5000
};

fetchWithConfig(config);
```

---

## 2. State Management

**Impact: CRITICAL | Category: state-management | Tags:** decorators, v1, v2, reactivity

### Why This Matters
State management is the foundation of ArkUI's reactivity system. Wrong decorator choices cause UI not updating, unnecessary re-renders, or state synchronization bugs.

### 2.1 V1 Decorators (API 9+)

#### @State — Component-local state

#### ❌ Incorrect

```typescript
@Entry
@Component
struct MyPage {
  count: number = 0;  // Missing @State — UI won't update

  build() {
    Column() {
      Text(`${this.count}`)
      Button("Increment")
        .onClick(() => {
          this.count++;  // UI won't re-render
        })
    }
  }
}
```

#### ✅ Correct

```typescript
@Entry
@Component
struct MyPage {
  @State count: number = 0;  // Correct — UI updates on change

  build() {
    Column() {
      Text(`${this.count}`)
      Button("Increment")
        .onClick(() => {
          this.count++;  // UI re-renders
        })
    }
  }
}
```

#### @Prop — One-way parent→child binding

#### ❌ Incorrect

```typescript
@Component
struct ChildComponent {
  @State label: string = "";  // Should be @Prop for parent binding

  build() {
    Text(this.label)
  }
}
```

#### ✅ Correct

```typescript
@Component
struct ChildComponent {
  @Prop label: string = "";  // Receives from parent, local copy

  build() {
    Text(this.label)
  }
}

@Entry
@Component
struct ParentPage {
  @State title: string = "Hello";

  build() {
    Column() {
      ChildComponent({ label: this.title })
    }
  }
}
```

#### @Link — Two-way parent↔child binding

#### ❌ Incorrect

```typescript
@Component
struct SliderComponent {
  @Prop value: number = 0;  // One-way — child changes won't propagate

  build() {
    Slider({ value: this.value })
  }
}
```

#### ✅ Correct

```typescript
@Component
struct SliderComponent {
  @Link value: number;  // Two-way — child changes propagate to parent

  build() {
    Slider({ value: this.value })
  }
}

@Entry
@Component
struct ParentPage {
  @State sliderValue: number = 50;

  build() {
    Column() {
      SliderComponent({ value: $sliderValue })  // Note: $ for @Link
    }
  }
}
```

### 2.2 @Observed/@ObjectLink — Nested object reactivity

#### ❌ Incorrect

```typescript
@Observed
class UserProfile {
  name: string = "";
  avatar: string = "";
}

@Component
struct ProfileCard {
  @ObjectLink profile: UserProfile;

  build() {
    Column() {
      Text(this.profile.name)  // Won't update if only profile.name changes
    }
  }
}
```

#### ✅ Correct

```typescript
@Observed
class UserProfile {
  name: string = "";
  avatar: string = "";
}

@Component
struct ProfileCard {
  @ObjectLink profile: UserProfile;

  build() {
    Column() {
      Text(this.profile.name)  // Updates when profile.name changes
    }
  }
}
```

### 2.3 V2 Decorators (API 12+)

#### @ObservedV2 / @Trace

#### ❌ Incorrect

```typescript
// Using V1 decorators in V2 context
@Observed
class Counter {
  count: number = 0;
}
```

#### ✅ Correct

```typescript
@ObservedV2
class Counter {
  @Trace count: number = 0;  // V2 trace decorator
}

@ComponentV2
struct CounterComponent {
  @Local counter: Counter = new Counter();

  build() {
    Column() {
      Text(`${this.counter.count}`)
      Button("Increment")
        .onClick(() => {
          this.counter.count++;  // V2 reactivity
        })
    }
  }
}
```

### 2.4 State Duplication

#### ❌ Incorrect

```typescript
@Entry
@Component
struct MyPage {
  @State items: string[] = ["a", "b", "c"];
  @State itemCount: number = 3;  // REDUNDANT — derivable from items.length

  build() {
    Column() {
      Text(`Count: ${this.itemCount}`)
    }
  }
}
```

#### ✅ Correct

```typescript
@Entry
@Component
struct MyPage {
  @State items: string[] = ["a", "b", "c"];

  build() {
    Column() {
      Text(`Count: ${this.items.length}`)  // Derived, not duplicated
    }
  }
}
```

---

## 3. UI Components

**Impact: CRITICAL | Category: ui-components | Tags:** build, lifecycle, builder, re-render

### Why This Matters
ArkUI uses a declarative UI model where `build()` describes the UI tree. Inefficient build functions cause unnecessary re-renders, and wrong component patterns break reactivity.

### 3.1 Component Lifecycle

```typescript
@Entry
@Component
struct MyPage {
  @State message: string = "Hello";

  aboutToAppear() {
    // Called before first build — initialization here
    console.log("Page about to appear");
  }

  aboutToDisappear() {
    // Called before component is destroyed — cleanup here
    console.log("Page about to disappear");
  }

  onPageShow() {
    // Called when page becomes visible
    console.log("Page shown");
  }

  onPageHide() {
    // Called when page becomes hidden
    console.log("Page hidden");
  }

  build() {
    Column() {
      Text(this.message)
    }
  }
}
```

### 3.2 @Builder Patterns

#### ❌ Incorrect

```typescript
@Entry
@Component
struct MyPage {
  @State items: string[] = [];

  build() {
    Column() {
      // Anonymous function in build — causes full re-render
      this.items.forEach((item: string) => {
        Text(item)  // No key — list optimization disabled
      })
    }
  }
}
```

#### ✅ Correct

```typescript
@Entry
@Component
struct MyPage {
  @State items: string[] = [];

  @Builder
  ItemBuilder(item: string, index: number) {
    Text(item)
      .key(`item-${index}`)
  }

  build() {
    Column() {
      ForEach(this.items, (item: string, index: number) => {
        this.ItemBuilder(item, index)
      })
    }
  }
}
```

### 3.3 Re-render Optimization

#### ❌ Incorrect

```typescript
@Entry
@Component
@Component
struct MyPage {
  @State count: number = 0;
  @State label: string = "Hello";

  build() {
    Column() {
      Text(this.label)  // Re-renders when count changes (unnecessary)
      Button(`${this.count}`)
        .onClick(() => { this.count++; })
    }
  }
}
```

#### ✅ Correct

```typescript
@Entry
@Component
struct MyPage {
  @State count: number = 0;
  @State label: string = "Hello";

  build() {
    Column() {
      Text(this.label)  // Only re-renders when label changes
      Button(`${this.count}`)
        .onClick(() => { this.count++; })
    }
  }
}
```

---

## 4. Navigation & Routing

**Impact: HIGH | Category: navigation | Tags:** router, navigation, deep-links, page-stack

### Why This Matters
Router is deprecated since API 9. Using Navigation component ensures forward compatibility and provides better page stack management.

### 4.1 Router (Deprecated) → Navigation Migration

#### ❌ Incorrect

```typescript
import router from "@ohos.router";

@Entry
@Component
struct MyPage {
  build() {
    Column() {
      Button("Go to Detail")
        .onClick(() => {
          router.pushUrl({ url: "pages/DetailPage" });  // Deprecated
        })
    }
  }
}
```

#### ✅ Correct

```typescript
import { Navigation } from "@ohos.arkui";

@Entry
@Component
struct MyPage {
  build() {
    Navigation() {
      Column() {
        Button("Go to Detail")
          .onClick(() => {
            // Navigation-based routing
          })
      }
    }
    .title("My App")
  }
}
```

### 4.2 Deep Link Configuration

In `module.json5`:

```json
{
  "module": {
    "uriOtions": {
      "domains": [
        {
          "scheme": "myapp",
          "host": "detail",
          "path": "/page"
        }
      ]
    }
  }
}
```

---

## 5. Performance Optimization

**Impact: HIGH | Category: performance | Tags:** lazyforeach, track, immutable, list

### Why This Matters
Unoptimized lists cause jank on scroll. Wrong state patterns trigger unnecessary re-renders.

### 5.1 LazyForEach vs ForEach

#### ❌ Incorrect

```typescript
@Entry
@Component
struct MyPage {
  @State items: string[] = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);

  build() {
    List() {
      ForEach(this.items, (item: string) => {
        ListItem() {
          Text(item)
        }
      })
    }
  }
  // BAD: ForEach renders ALL 1000 items at once
}
```

#### ✅ Correct

```typescript
@Entry
@Component
struct MyPage {
  @State items: string[] = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);

  build() {
    List() {
      LazyForEach(this.items, (item: string, index: number) => {
        ListItem() {
          Text(item)
        }
        .key(`item-${index}`)
      })
    }
  }
  // GOOD: LazyForEach only renders visible items
}
```

### 5.2 @Trace for Property-Level Updates

#### ❌ Incorrect

```typescript
@ObservedV2
class Product {
  @Trace name: string = "";
  @Trace price: number = 0;
  @Trace stock: number = 0;
}

@Component
struct ProductCard {
  @Local product: Product = new Product();

  build() {
    Column() {
      Text(this.product.name)    // Updates when ANY property changes
      Text(`$${this.product.price}`)
    }
  }
}
```

#### ✅ Correct

```typescript
@ObservedV2
class Product {
  @Trace name: string = "";
  @Trace price: number = 0;
  @Trace stock: number = 0;
}

@Component
struct ProductCard {
  @Local product: Product = new Product();

  build() {
    Column() {
      Text(this.product.name)    // Only updates when name changes
      Text(`$${this.product.price}`)  // Only updates when price changes
    }
  }
}
```

---

## 6. Side Effects & Lifecycle

**Impact: HIGH | Category: side-effects | Tags:** timers, cleanup, memory-leaks

### Why This Matters
Uncleaned timers and subscriptions cause memory leaks and background battery drain.

### 6.1 Timer Cleanup

#### ❌ Incorrect

```typescript
@Entry
@Component
struct MyPage {
  aboutToAppear() {
    setInterval(() => {
      console.log("tick");
    }, 1000);  // Never cleared — memory leak
  }

  build() {
    Column() {
      Text("Timer running")
    }
  }
}
```

#### ✅ Correct

```typescript
@Entry
@Component
struct MyPage {
  private timerId: number = -1;

  aboutToAppear() {
    this.timerId = setInterval(() => {
      console.log("tick");
    }, 1000);
  }

  aboutToDisappear() {
    if (this.timerId !== -1) {
      clearInterval(this.timerId);  // Cleaned up
    }
  }

  build() {
    Column() {
      Text("Timer running")
    }
  }
}
```

---

## 7. Android → HarmonyOS Migration

**Impact: HIGH | Category: android-migration | Tags:** concept-mapping, api-translation, native-module

### Why This Matters
Developers migrating from Android often copy-paste Android patterns that don't exist in HarmonyOS. This section maps common Android concepts to their HarmonyOS equivalents.

### 7.1 Concept Mapping

| Android | HarmonyOS | Notes |
|---------|-----------|-------|
| `java.io.File` | `@ohos.file.fs` | No global `File` type in ArkTS |
| `FOREGROUND_SERVICE` | `BackgroundMode.LONG_TASK` | Different enum values |
| `SharedPreferences` | `@ohos.data.preferences` | API structure differs |
| `Intent` | `Want` | Different parameter passing |
| `Activity` | `UIAbility` | Lifecycle methods differ |
| `Fragment` | ArkTS Component | No direct equivalent |
| XML Layout | ArkTS Declarative | No XML layouts |
| `RecyclerView` | `List`/`Grid` + `LazyForEach` | Different API |
| `Socket.remoteInfo` | `@ohos.net.socket` | Different structure |

### 7.2 Native Module Declaration Chain

Using `.so` files in ArkTS requires a complete chain:

```
1. NAPI Implementation (C/C++)
   ↓
2. Compile to .so
   ↓
3. Create .d.ts type declarations
   ↓
4. Register in module.json5 nativeLibs
   ↓
5. Import in ArkTS: import native from 'libxxx.so'
```

#### ❌ Incorrect

```typescript
// Missing .d.ts declaration
import native from 'libnearshare_native.so';  // ERROR: no type declarations
```

#### ✅ Correct

```typescript
// 1. Create src/main/ets/libxxx.d.ts
declare module 'libnearshare_native.so' {
  export function initialize(): void;
  export function transfer(data: ArrayBuffer): number;
}

// 2. Register in module.json5
// "nativeLibs": { "libnearshare_native.so": { "armor": "arm64-v8a" } }

// 3. Import with types
import { initialize, transfer } from 'libnearshare_native.so';
```

---

## 8. Code Style & Organization

**Impact: MEDIUM | Category: style | Tags:** naming, structure, comments

### 8.1 Naming Conventions

#### ❌ Incorrect

```typescript
class userAccount {
  id: string = "";
  getname() { return this.id; }
}
```

#### ✅ Correct

```typescript
class UserAccount {  // PascalCase for classes
  private id: string = "";  // camelCase for properties

  getId(): string {  // camelCase for methods
    return this.id;
  }
}
```

### 8.2 Project Structure

```
entry/src/main/
├── ets/
│   ├── entryability/
│   │   └── EntryAbility.ets       # UIAbility entry
│   ├── pages/
│   │   ├── Index.ets              # Main page
│   │   └── Detail.ets             # Detail page
│   ├── components/
│   │   └── HeaderComponent.ets    # Reusable components
│   ├── model/
│   │   └── UserData.ets           # Data models
│   ├── utils/
│   │   └── Logger.ets             # Utilities
│   └── common/
│       └── Constants.ets          # Constants
├── resources/                      # Resources
└── module.json5                   # Module config
```

---

## Code Review Report Format

```markdown
## Summary
[Brief overview of the code and main issues found]

## Critical Issues 🔴

### 1. [Issue Title]
**File:** `path/to/file.ets:42`
**Rule:** [arkts-no-any-unknown / state-management / etc.]
**Issue:** [Description of the problem]
**Impact:** [Why this matters]
**Fix:**
```arkts
// Corrected code
```

## High Priority 🟠

### 1. [Issue Title]
...

## Medium Priority 🟡
...

## Android Migration Notes
[If applicable: concept mapping table]

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
| **CRITICAL** | Syntax violation, state bug | any/unknown, missing @State, wrong decorator | Fix immediately |
| **HIGH** | Performance, memory leak | Missing LazyForEach, timer leak, deprecated router | Fix before merge |
| **MEDIUM** | Style, naming | Missing return type, inconsistent naming | Fix or accept |

### References

- [HarmonyOS Developer Docs](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/)
- [ArkTS Language Specification](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-get-started)
- [ArkUI Component Reference](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkui/ts-basic-components)
- [State Management V1](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-state-management)
- [State Management V2](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-state-management-v2)
