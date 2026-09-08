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

### Architecture & Cross-Cutting — **HIGH**
9. [Service-Layer Consistency](#9-service-layer-consistency)
10. [Platform Runtime & Structural Safety](#10-platform-runtime--structural-safety)

### Fix Coordination — **MANDATORY (≥3 fixes or shared targets)**
11. [Fix Coordination (v2.1)](#11-fix-coordination修复协调--v21)

### Style — **MEDIUM**
8. [Code Style & Organization](#8-code-style--organization)

### Review Process — **MANDATORY**
12. [Attention Budget Guide](#attention-budget-guide-v20--mandatory)

---

## Attention Budget Guide (v2.0 — MANDATORY)

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

**Skipped File Rules (v2.0 — MANDATORY):**
- **Skipped != Passed**: If a file was not scanned due to size or context limits,
  you MUST NOT conclude the code is safe in that file. You had a blind spot.
- **Contextual Awareness**:
  - If `.ets` files skipped: "Some ETS files were not scanned due to context limits. Manual review recommended."
  - If `.ts` files skipped: "TypeScript utility files were not scanned. Verify type definitions manually."

---

## 0. HarmonyOS Version Detection

**Impact: MANDATORY | Category: meta | Tags:** harmonyos-version, api-detection

Before applying any rules, determine the target API version from `build-profile.json5` or `module.json5`:

| Heuristic | API 9 | API 10-11 | API 12+ |
|-----------|-------|-----------|---------|
| Core | ArkTS V1 only | ArkTS V1 only — V2 does NOT exist below API 12 (V1 于 API 7 推出、V2 于 API 12 推出) | V1 + V2 (official guidance: prefer V2 for new code) |
| State Mgmt | @State/@Prop/@Link/@Observed/@ObjectLink/@Provide/@Consume/@Watch | Same as API 9 — @ObservedV2/@Trace/@Local etc. are API 12+ | @ComponentV2/@Local/@Param/@Once/@Event/@Monitor/@ObservedV2/@Trace/@Computed |
| Navigation | Navigation (API 8+) + NavRouter; router = "not recommended" | Navigation + NavPathStack (preferred); avoid router | Navigation + NavPathStack + NavDestination |
| Component | @Component + struct | @Component + struct | @ComponentV2 + struct (or @Component) |
| Module | Stage model + module.json5 (standard since API 9) | Stage model + module.json5 | Stage model + module.json5 |

**If API 9-11:** Apply V1 state management only. V2 decorators must NOT be used (API 12+ only).
**All versions:** Prefer Navigation over router. Router is "not recommended" in official docs (no version-based deprecation).
**If API 12+:** Recommend V2 state management for new code. Migration guide for V1.

---

## 1. ArkTS Syntax Rules

**Impact: CRITICAL | Category: arkts-syntax | Tags:** no-any-unknown, limited-throw, inferred-generics, explicit-return-types

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

### 1.3 arkts-no-inferred-generic-params（错误码 10605034）

**可以从参数推断类型实参时，省略类型实参是合法用法；仅当无法从参数推断、或禁止仅依据返回类型推断时才报错。**

#### ❌ Incorrect

```typescript
// 假定存在泛型函数 choose<T>(x: T, y: T): T
function greet<T>(): T {     // ERROR: T 无法从参数推断
  return 'Hello' as T;
}

const z = greet();           // ERROR: 禁止仅基于返回类型推断泛型参数，须写 greet<string>()
const y = choose('10', 20);  // ERROR: 参数类型不一致，无法推断出一致的类型实参
```

#### ✅ Correct

```typescript
function choose<T>(x: T, y: T): T {
  return Math.random() < 0.5 ? x : y;
}

const x = choose(10, 20);   // OK: 可从参数推断 choose<number>，省略类型实参合法
const z = greet<string>();  // OK: 显式标注类型实参
```

### 1.4 Explicit Return Types (Style — not a compile rule)

ArkTS 没有名为 `arkts-no-implicit-return-types` 的编译规则（该规则名不存在）。ArkTS 强制的是**严格类型检查**（错误码 10605999：noImplicitReturns / strictNullChecks / strictFunctionTypes / strictPropertyInitialization）。显式标注返回类型属于官方编码风格与 Code Linter 建议（warn 级），审查时应按 🟡 MEDIUM 风格项标注，**不要**标记为编译错误（🔴）。

#### ❌ Incorrect (real compile errors)

```typescript
function fetchData(s: string): string {  // ERROR: noImplicitReturns
  if (s !== "") {
    return s.toUpperCase();
  }
  // 缺少 return —— 并非所有代码路径都有返回值
}

let n: number = null;  // ERROR: strictNullChecks
```

#### ✅ Correct

```typescript
function fetchData(s: string): string {
  if (s !== "") {
    return s.toUpperCase();
  }
  return "";
}
```

### 1.5 arkts-no-untyped-obj-literals（错误码 10605038）

**上下文类型明确时，对象字面量可以直接作为参数传递——编译器可根据上下文推断字面量类型，属于合法用法**（官方示例：`getPoint({x: 5, y: 10})` 合法）。该规则仅在以下上下文报错：
- 初始化 any / Object / object 类型目标
- 初始化带方法的类或接口
- 初始化含自定义带参构造函数的类
- 初始化带 readonly 字段的类

#### ❌ Incorrect (real compile errors)

```typescript
interface Config {
  url: string;
  timeout: number;
  init(): void;   // 带方法的接口 → 字面量无法初始化
}

// ERROR: Object 类型目标不允许字面量初始化
let o: Object = { url: "https://example.com" };

// ERROR: 带方法的接口不能用字面量初始化
const cfg: Config = { url: "https://example.com", timeout: 5000 };
```

#### ✅ Correct

```typescript
interface Config {
  url: string;
  timeout: number;
}

function fetchWithConfig(config: Config) { /* ... */ }

// OK: 上下文类型明确（参数类型为 Config），字面量类型由上下文推断——直接传参合法
fetchWithConfig({ url: "https://example.com", timeout: 5000 });

// 独立声明的字面量需显式标注类型（或先用变量声明）
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

`@ObjectLink` 能观察 `@Observed` 类实例的**第一层**属性变化；**深层嵌套**（第二层及更深）的属性修改无法被观察到，需要整体替换第一层属性（或在 API 12+ 改用 V2 的 @ObservedV2/@Trace 实现属性级深度观测）。

#### ❌ Incorrect

```typescript
@Observed
class Address {
  city: string = "";
}

@Observed
class UserProfile {
  name: string = "";
  address: Address = new Address();
}

@Entry
@Component
struct ParentPage {
  @State profile: UserProfile = new UserProfile();

  build() {
    Column() {
      ProfileCard({ profile: this.profile })
    }
  }
}

@Component
struct ProfileCard {
  @ObjectLink profile: UserProfile;

  build() {
    Column() {
      Text(this.profile.name)          // 会更新：第一层属性
      Text(this.profile.address.city)  // 不会更新：第二层属性，@ObjectLink 观察不到
    }
  }
}
```

#### ✅ Correct

```typescript
// 深层修改 → 整体替换第一层属性（address 是第一层属性，重新赋值可被观察到）
this.profile.address = new Address();   // 触发刷新
// 修改第一层简单属性同样触发刷新
this.profile.name = "New Name";         // 触发刷新
// V2（API 12+）替代方案：@ObservedV2 + @Trace 支持任意深度的属性级观测
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
      // 非响应式：this.items.forEach 不参与状态跟踪，items 变化不会触发 UI 刷新；
      // 且无键值生成器，列表无法做最小化复用更新
      this.items.forEach((item: string) => {
        Text(item)
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
  ItemBuilder(item: string) {
    Text(item)
  }

  build() {
    Column() {
      // ForEach 键值由第三个参数 keyGenerator 生成（唯一、与数据相关）；
      // 官方不建议使用 index 作为键值
      ForEach(this.items,
        (item: string) => {
          this.ItemBuilder(item)
        },
        (item: string) => item)
    }
  }
}
```

### 3.3 Re-render Optimization

V1 中 @State 变化会触发所在组件 `build()` 重新执行（框架按最小粒度更新 UI 节点）。把互不相关的状态拆到子组件，可缩小 build 重执行的范围（官方最佳实践：合理划分状态、减少不必要的刷新范围）。

#### ❌ Incorrect

```typescript
@Entry
@Component
struct MyPage {
  @State count: number = 0;
  @State label: string = "Hello";

  build() {
    Column() {
      Text(this.label)           // 与 count 无关，但 count 变化会重执行本组件 build()
      Button(`${this.count}`)
        .onClick(() => { this.count++; })
    }
  }
}
```

#### ✅ Correct

```typescript
// label 拆到子组件：count 变化时 LabelText 的 @Prop 未变，不随父组件重新渲染
@Entry
@Component
struct MyPage {
  @State count: number = 0;
  @State label: string = "Hello";

  build() {
    Column() {
      LabelText({ label: this.label })
      Button(`${this.count}`)
        .onClick(() => { this.count++; })
    }
  }
}

@Component
struct LabelText {
  @Prop label: string = "";

  build() {
    Text(this.label)
  }
}
```

---

## 4. Navigation & Routing

**Impact: HIGH | Category: navigation | Tags:** router, navigation, deep-links, page-stack

### Why This Matters
Router is "not recommended" in official docs (no version-based deprecation). Using the Navigation component (available since API 8) is the recommended routing framework and provides better page stack management.

### 4.1 Router (不推荐) → Navigation Migration

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
          router.pushUrl({ url: "pages/DetailPage" });  // 不推荐：官方建议使用 Navigation
        })
    }
  }
}
```

#### ✅ Correct

```typescript
// Navigation 是 ArkUI 内置组件，无需 import（不存在 import { Navigation } from "@ohos.arkui"）；
// API 10+ 使用 NavPathStack 管理页面栈，页面由 NavDestination 承载；
// API 9 需配合 NavRouter 组件实现页面路由。
@Entry
@Component
struct MyPage {
  pathStack: NavPathStack = new NavPathStack();

  @Builder
  PageMap(name: string) {
    if (name === "DetailPage") {
      DetailPage()
    }
  }

  build() {
    Navigation(this.pathStack) {
      Column() {
        Button("Go to Detail")
          .onClick(() => {
            this.pathStack.pushPathByName("DetailPage", { id: 1 });
          })
      }
    }
    .title("My App")
    .navDestination(this.PageMap)
  }
}

@Component
struct DetailPage {
  build() {
    NavDestination() {
      Text("Detail")
    }
    .title("Detail")
  }
}
```

### 4.2 Deep Link Configuration

URI 深链在 `module.json5` 的 **abilities[].skills[].uris** 数组中配置（官方示例；字段：scheme/host/port/path，其中 path 与 pathStartWith/pathRegex 三选一）：

```json
{
  "module": {
    "abilities": [
      {
        "skills": [
          {
            "actions": ["ohos.want.action.home"],
            "entities": ["entity.system.home"],
            "uris": [
              {
                "scheme": "myapp",
                "host": "detail",
                "path": "/page"
              }
            ]
          }
        ]
      }
    ]
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
// LazyForEach 第一个参数必须是实现 IDataSource 接口的数据源实例（不能直接传普通数组）；
// 键值通过第三个参数 keyGenerator 生成（唯一、与数据相关，不要用 index）
class ItemDataSource implements IDataSource {
  private listeners: DataChangeListener[] = [];
  private dataArray: string[] = [];

  totalCount(): number {
    return this.dataArray.length;
  }

  getData(index: number): string {
    return this.dataArray[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const pos = this.listeners.indexOf(listener);
    if (pos >= 0) {
      this.listeners.splice(pos, 1);
    }
  }

  pushData(data: string): void {
    this.dataArray.push(data);
    this.listeners.forEach((listener: DataChangeListener) => {
      listener.onDataAdd(this.dataArray.length - 1);
    });
  }
}

@Entry
@Component
struct MyPage {
  private data: ItemDataSource = new ItemDataSource();

  aboutToAppear() {
    for (let i = 0; i <= 999; i++) {
      this.data.pushData(`Item ${i}`);
    }
  }

  build() {
    List() {
      LazyForEach(this.data,
        (item: string) => {
          ListItem() {
            Text(item)
          }
        },
        (item: string) => item)
    }
  }
  // GOOD: LazyForEach renders only visible items; data updates via DataChangeListener
}
```

**Note:** On API 12+, `Repeat`（官方推荐，键值作为参数传入）是替代 ForEach/LazyForEach 的更优选择。

### 5.2 @Trace for Property-Level Updates

`@Trace` 是状态管理 V2 装饰器（API 12+），在 `@ObservedV2` 类中标记需要**属性级观测**的字段。注意：`@Local`/`@Trace` 等 V2 装饰器**只能用于 @ComponentV2 组件**，在 @Component 中使用会编译报错。

#### ❌ Incorrect

```typescript
@ObservedV2
class Product {
  name: string = "";   // 缺少 @Trace——属性变化无法被观察
  price: number = 0;
}

@ComponentV2
struct ProductCard {
  @Local product: Product = new Product();

  build() {
    Column() {
      Text(this.product.name)   // 修改 name 不会刷新
    }
  }
}
```

#### ✅ Correct

```typescript
@ObservedV2
class Product {
  @Trace name: string = "";    // @Trace：属性级观测，name 变化只刷新使用 name 的节点
  @Trace price: number = 0;
}

@ComponentV2
struct ProductCard {
  @Local product: Product = new Product();

  build() {
    Column() {
      Text(this.product.name)        // 仅 name 变化时刷新
      Text(`$${this.product.price}`) // 仅 price 变化时刷新
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
| `FOREGROUND_SERVICE` | `@ohos.resourceschedule.backgroundTaskManager` + 具体 `BackgroundMode`（`DATA_TRANSFER`/`AUDIO_PLAYBACK`/`TASK_KEEPING` 等） | `LONG_TASK` 枚举不存在；旧 `@ohos.backgroundTaskManager` 自 API 9 起废弃 |
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
2. CMake 编译为 .so（build-profile.json5 的 buildOption.externalNativeOptions 配置，输出至 libs/<abi>/）
   ↓
3. Create .d.ts type declarations
   ↓
4. Import in ArkTS: import native from 'libxxx.so'
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

// 2. 编译配置位于 build-profile.json5（不是 module.json5，module.json5 无 nativeLibs 字段）：
//    "buildOption": { "externalNativeOptions": { "path": "./CMakeLists.txt", "cppFlags": "", "arguments": "" } }

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

## 9. Service-Layer Consistency（服务层一致性）

**Impact: HIGH | Category: service-layer | Tags:** cross-method, contract, 关注点矩阵

**触发**：封装类/服务类/工具类（非 UI 组件）+ ≥2 个职责相近方法（HttpClient、Repository、Storage 等）。
**前提**：语法级检查已通过——本维度只做第二遍，不做 any/unknown 等第一遍工作。
**依赖输入**：平台运行时知识、上游 API 契约、该类全部方法完整代码（缺则降级为"无法评估"，禁止只审单个方法）。
详细流程见 `references/service-layer.md`。

### 9.1 关注点矩阵（横向对比 v2.0）
表头 = 横切关注点：鉴权/限流/错误分类/超时/重试/资源释放/状态码判定/body 解析；行 = 同类方法（get/post/put/delete…），逐格打勾：

- 同一关注点在**部分方法覆盖、其余缺失** → 🟠 HIGH
- 兄弟方法间**行为不一致**（兜底文案、超时值、错误码映射差异）→ 🟠 HIGH（行为分叉比重复更严重）
- 平台落点：API 12+ 网络库提供官方拦截器链（interceptor），鉴权/日志/错误分类等横切关注点应**下沉拦截器**而非逐方法重复

### 9.2 上游契约核对（参照系③）
- 写请求**禁止只断言单一成功状态码**：对照 API 文档列出全部成功码（如 200/201/204）
- 枚举动词覆盖率（编辑类接口尤其要查 **PATCH**）
- 硬编码假设（状态码/Header/限流范围）逐条列成表核对；**以文档为准**
- 无契约文档 → 标注"无法评估"，不得臆断

## 10. Platform Runtime & Structural Safety（平台运行时与结构安全）

**Impact: HIGH | Category: platform-runtime | Tags:** busineserror, sendable, destroy, 依赖方向

### 10.1 异常路径真值表（参照系②）
- catch 内 e 用 `(e as BusinessError).code` 对照模块错误码表（http 为 2300000+curl 体系：2300028 超时/2300007 连接失败/2300094 认证错误）；`instanceof` 缩窄**不是**官方形态（官方全库示例统一 `as BusinessError`）
- `arkts-limited-throw` 保证 catch 中 e 必为 Error 子类 → "非 Error 兜底分支"恒不可达 = 死代码（如 `if (e instanceof Error) throw e; throw new Error(...)` 后半段）
- 检查 catch 内 rethrow 是否把原始异常透传给用户

### 10.2 资源释放
- 每个资源型 API（createHttp/文件/套接字）必须有 `finally + destroy()/close()`（官方强制，`@ohos.net.http`："务必调用 destroy 方法释放资源，避免出现内存泄漏"）

### 10.3 平台能力验证门（防误报）
- **无连接池/无内建重试 API**：连接池、单例连接、自动重试建议 = 平台概念泄漏 → 禁止建议
- 单例写法**合法**（官方标准：private constructor + static getInstance，官方示例 8+ 处）；要审的是生命周期与线程安全
- 对象 spread 不支持、Pick/Omit 不可用（Partial/Required/Readonly/Record 可用）

### 10.4 并发与共享状态
- `@Sendable` 类成员变量必须属于 Sendable 支持类型；@Sendable 类只能继承 @Sendable；Worker 传参追踪类型链
- `@Reusable`(V1) 与 `@ComponentV2` 混用**渲染异常**（官方反例）；V2 复用用 `@ReusableV2`（API 18+）

### 10.5 模块依赖方向（参照系④）
- `entry → feature(HAP/HSP) → common(HAR)` 单向；**common 绝不能依赖 feature**
- 传输层不得 import 业务服务（循环依赖风险）
- `hvigor --analyze` 现行语义为构建耗时分析；模块依赖用 DevEco Studio 依赖视图核对

## 11. Fix Coordination（修复协调 — v2.1）

**Impact: MANDATORY (≥3 fixes or shared targets) | Category: fix-coordination | Tags:** dependency-graph, preconditions, side-effects, batching

### Why This Matters
发现问题只是第一半。多个修复建议若触及同一模块/同一状态却彼此不知情，会出现"修复互相拆台"——例如 Fix_H6 要求 HttpClient 直接调用 AuthService.logout()，而 Fix_H4 的目标恰恰是移除 HttpClient→AuthService 依赖边。协调性必须从"靠模型自觉"变成"靠流程和结构强制"。

### 11.1 触发条件（MANDATORY 判定）
满足任一 → 必须启用 `references/fix-planning.md` 完整流程：
- 报告含 **≥3 个修复建议**
- 两个修复触及**同一模块/文件/状态**（同一服务类、同一 AppStorage 键、同一依赖边）
- 一个修复"新增依赖"，另一个"消除依赖"（方向相反的边）
- 一个修复要求调用某模块，另一个要求该模块重构/下线

### 11.2 两阶段产出（Diagnosis → Planning 分离）

**阶段一：问题诊断报告**
- 内容：仅问题清单（Critical/High/Medium）+ 证据（文件:行）+ 影响分析
- **禁止**：输出任何代码块或修复方案
- 目的：获得稳定全局问题视图，方案不干扰发现

**阶段二：修复规划报告**（以确认后的阶段一清单为唯一输入）
- 每条修复填写 DSL（Fix_ID/Target/Severity/Approach/Preconditions/Postconditions/Side_Effects/Conflicts_With/Resolution）
- 构建 Fix Dependency Graph（三种边：`depends on` / `conflicts with` / `alternative to`）
- 按依赖拓扑分批（Batch 1 无前置依赖 → Batch 2 依赖 Batch 1…）
- 每条冲突边必须给 Resolution（改 Approach / 调顺序 / 声明互斥交用户决策）
- **禁止**：在阶段二引入阶段一清单之外的新问题

### 11.3 DSL 强制字段与核验规则
每个修复必填：Approach、Preconditions、Postconditions、Side_Effects（无副作用也写 "None"）。
核验（强模型或脚本）：
1. X.Side_Effects 破坏未解决修复 Y 的 Preconditions/Target → 必须出现冲突边 X↔Y + Resolution
2. Y.Preconditions 依赖某模块，X.Side_Effects 声明移除/重构该模块 → 同上
3. 批次顺序 = 依赖拓扑序（`depends on` 在前）
4. "无冲突声明" ≠ "无冲突"——所有 Side_Effects 交集为空才算真无冲突
5. Approach 被 Resolution 变更时，保留旧 Approach 并标注"已否决"

### 11.4 冲突消解模式（服务层常见）
- **依赖反转先行**：冲突源于"直接调用具体服务"——先落地接口抽取（依赖反转修复），后续修复依赖新接口而非具体类
- **事件/回调方案**：跨模块行为用全局事件（如 'UNAUTHORIZED_EVENT'）替代直接调用，Side_Effects 归零
- **拦截器下沉**：鉴权/日志/错误分类等横切关注点下沉官方拦截器链，逐方法修补的多个修复合并为单一拦截器修复

详细规范（DSL 模板/图格式/分批示例/检查清单）见 `references/fix-planning.md`。

## Code Review Report Format

**报告采用两阶段产出（v2.1 — MANDATORY）**：阶段一诊断与阶段二规划**分开发布**，用户确认问题清单后才产出规划。

### 阶段一：问题诊断报告（禁止代码修复方案）

```markdown
## Summary
[Brief overview of the code and main issues found — 仅描述，不含修复建议]

## Critical Issues 🔴

### 1. [Issue Title]
**File:** `path/to/file.ets:42`
**Rule:** [arkts-no-any-unknown / state-management / etc.]
**Evidence:** [关键代码片段引用（原样引用，不改写）]
**Impact:** [Why this matters — 用户可感知的功能后果]

## High Priority 🟠
### 1. [Issue Title] ...（同上格式）

## Medium Priority 🟡
...

## Android Migration Notes
[If applicable: concept mapping table]

## Issue Count
- 🔴 CRITICAL: N
- 🟠 HIGH: N
- 🟡 MEDIUM: N

## Checklist（诊断阶段自检）
- [ ] 未输出任何代码修复块（Fix 内容属于阶段二）
- [ ] 每条问题有文件:行号证据与影响分析
- [ ] 问题按"用户可感知影响"定级，未引用语法规则名作定级依据
```

### 阶段二：修复规划报告（以确认的问题清单为输入）

```markdown
## Planning Input
[阶段一问题清单版本/日期；声明本报告不引入清单之外的新问题]

## Fix DSL Entries
### Fix_H4: [一句话标题]
Target: [对应问题 ID + 目标]
Severity: HIGH
Approach: [具体方案；被否决时保留并标注"已否决"]
Preconditions:
  - Module: ...
Postconditions:
  - State: ...
Side_Effects:
  - Dependency: ...
Conflicts_With:
  - Fix_H6: [原因]
Resolution: [改 Approach / 调顺序 / 互斥交决策]

（每个修复一个 DSL 条目）

## Fix Dependency Graph
[文本或 Mermaid：depends on / conflicts with / alternative to 边]

## Batches（依赖拓扑序）
| Batch | Fix IDs | 理由 |
|-------|---------|------|
| 1 | Fix_H9, Fix_M2 | 无前置依赖 |
| 2 | Fix_H4 | 依赖 H9 接口产出 |
| 3 | Fix_H6 | 冲突已消解，依赖新接口/事件 |

## Checklist（规划阶段自检）
- [ ] 所有修复填写了 DSL（Approach/Preconditions/Postconditions/Side_Effects）
- [ ] Side_Effects 与未解决修复的 Target/Postconditions 冲突均已显式列出 + Resolution
- [ ] 批次顺序符合依赖拓扑（depends on 在前）
- [ ] 未引入问题清单之外的新问题

**Recommendation:** [总体建议：先合并/先重审项，批次的合并顺序与验收标准]
```

> **轻度审查（<3 修复且互不触及同一目标）**：可合并为单报告，但报告末尾仍需 Fix Dependency Graph 一节声明"无冲突"（所有 Side_Effects 无交集），并保留两阶段的自检清单。

## Quick Reference

### Priority Matrix

| Level | Description | Examples | Action |
|-------|-------------|----------|--------|
| **CRITICAL** | Syntax violation, state bug | any/unknown, missing @State, wrong decorator | Fix immediately |
| **HIGH** | Performance, memory leak | Missing LazyForEach, timer leak, not-recommended router | Fix before merge |
| **HIGH** | Service-layer inconsistency, platform leakage | Missing cross-method concern, dead catch branch, connection-pool suggestion | Fix before merge |
| **MEDIUM** | Style, naming | Missing explicit return type (style), inconsistent naming | Fix or accept |

### References

- [HarmonyOS Developer Docs](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/)
- [ArkTS Language Specification](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-get-started)
- [ArkUI Component Reference](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkui/ts-basic-components)
- [State Management V1](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-state-management)
- [State Management V2](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-state-management-v2)
