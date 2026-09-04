# Performance Optimization Deep Reference

## LazyForEach vs ForEach

| Feature | ForEach | LazyForEach |
|---------|---------|-------------|
| Rendering | All items at once | Visible items only |
| Memory | High (full list in memory) | Low (only visible items) |
| Scroll Performance | Poor for large lists | Smooth |
| Use Case | Small lists (within one screen) | Large lists (beyond one screen / frequent scrolling) |

> 注：官方没有"50 条"硬性阈值；数据量是否超过一屏、是否频繁滚动是选择依据。API 12+ 新代码可优先考虑官方更推荐的 `Repeat`。

### ForEach (Small Lists)
```typescript
ForEach(this.items,
  (item: string, index: number) => {
    Text(item)
  },
  (item: string) => item)  // keyGenerator（ForEach 第三参数，不要用 .key()）
```

### LazyForEach (Large Lists)
```typescript
// 第一个参数必须是实现 IDataSource 的数据源实例（不能是普通数组）；
// 键值经第三参数 keyGenerator 生成
LazyForEach(this.dataSource,
  (item: string, index: number) => {
    ListItem() {
      Text(item)
    }
  },
  (item: string) => item)
```

## @Trace for Property-Level Updates (V2, API 12+)

### Problem: Unobserved Properties
```typescript
// ❌ 属性未加 @Trace：@ObservedV2 类的属性变化无法被观察，无法驱动 UI 刷新
@ObservedV2
class Product {
  name: string = "";    // 无 @Trace
  price: number = 0;
}
```

### Solution: @Trace Decorator
```typescript
// ✅ @Trace 实现属性级观测：price 变化只刷新使用 price 的节点
@ObservedV2
class Product {
  @Trace name: string = "";    // name 变化 → 仅 name 相关节点刷新
  @Trace price: number = 0;    // price 变化 → 仅 price 相关节点刷新
  @Trace stock: number = 0;
}
// 注意：@Trace/@Local 等 V2 装饰器只能用于 @ComponentV2 组件；@Component 中使用会编译报错。
```

## V1 Array Mutation（官方支持原地更新）

### ✅ @State 数组支持原地 API 更新
```typescript
@State items: string[] = ["a", "b", "c"];

// ✅ 官方明确可观察（原文："可以通过调用Array的接口push, pop, shift,
//    unshift, splice, copyWithin, fill, reverse, sort更新Array中的数据"）
this.items.push("d");   // 触发 UI 刷新
```

### ⚠️ 需要"整体替换新引用"的场景
```typescript
// 1) 数组项中嵌套的属性赋值（V1 观察不到，官方原文："数组项中嵌套的属性赋值无法观察"）：
//    this.items[0].name = "x";  // 不刷新
this.items[0] = new Item("x");   // 整体替换数组项 → 刷新（深层观测可用 @Observed/@ObjectLink 或 V2）

// 2) 需要整体重建/替换时（与 push 等价，push 已可观察）
this.items = [...this.items, "e"];
```

## List/Grid Optimization

### List with Fixed Height
```typescript
List() {
  LazyForEach(this.dataSource, (item: string) => {
    ListItem() {
      Text(item)
        .height(50)  // Fixed height enables scrolling optimization
    }
  })
}
.width("100%")
.height("100%")
```

### Grid Layout
```typescript
Grid() {
  ForEach(this.items, (item: string) => {
    GridItem() {
      Text(item)
    }
  })
}
.columnsTemplate("1fr 1fr 1fr")
// 注：跨行跨列使用 GridItem 的 rowStart/columnStart 等属性或 Grid 的
// GridLayoutOptions 配置；GridItem 没有 .span() 属性
```

## Bundle Size Optimization

### Tree Shaking
- 使用 Kit 的**具名导入**，避免整包/命名空间导入：`import { http } from '@kit.NetworkKit'`
- Button 等 ArkUI 内置组件无需（也不能）导入——不存在 `import { Button } from '@ohos.arkui'` 这样的语句
- 避免 `import * as` 形式的全量导入

### Lazy Loading
官方机制：动态 `import()`（运行时按需加载）、`lazy import`（API 12+ 延迟加载）、按需分包（HSP/HAR/动态共享包）：
```typescript
// 动态加载：需要时再加载模块（@Builder 本身不具备"懒加载"能力）
async function loadHeavyModule() {
  const mod = await import('./heavy');
  mod.init();
}
```

## Common Anti-Patterns

### 1. Heavy Work in Item Generator
```typescript
// ❌ 项生成函数在每次渲染时都会执行：在其中做重活/创建昂贵对象会拖慢渲染
ForEach(this.items, (item: string) => {
  Text(item)  // 简单内容直接写是可以的
})

// ✅ 复杂 item 拆为 @Builder 或子组件，保持生成函数轻量
@Builder ItemBuilder(item: string) {
  Text(item)
}
```

### 2. Missing Key in ForEach
```typescript
// ❌ 无键值生成器：数据更新时无法精准复用/更新子组件（系统退化为按 index 键值）
ForEach(this.items, (item: string) => {
  Text(item)
})

// ✅ keyGenerator（ForEach 第三参数）启用高效 diff（.key() 不是键值机制）
ForEach(this.items,
  (item: Item) => {
    Text(item.name)
  },
  (item: Item) => item.id)
```

### 3. Unused State Variables
```typescript
// ❌ 未被 UI 使用的状态变量：其修改仍会触发所在组件 build() 重新执行（V1 语义，无谓开销）
@State count: number = 0;
@State label: string = "Hello";
@State unused: string = "World";  // 未在 build 中使用

// ✅ 状态变量只保留与 UI 相关的数据（官方最佳实践）
@State count: number = 0;
@State label: string = "Hello";
```
