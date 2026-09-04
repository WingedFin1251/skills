# UI Components Deep Reference

## Component Types

| Type | Keyword | Use Case |
|------|---------|----------|
| Entry Component | `@Entry @Component` | Page entry point |
| Custom Component | `@Component` | Reusable component |
| Builder Function | `@Builder` | UI fragment in build |
| Builder Param | `@BuilderParam` | Pass builder as component attribute |
| Local Builder | `@LocalBuilder` | Component-local builder (keeps state binding) |
| Styles | `@Styles` | Reusable style sets |
| Extend | `@Extend` | Extend built-in component styles |

## Component Lifecycle

```
aboutToAppear()  →  build()  →  onDidBuild()  →  onPageShow()  →  onPageHide()  →  aboutToDisappear()
     ↑                                  ↑                                           ↑
 Initialization                    API 12+                                   Visibility
（onDidBuild 只在首次渲染完成后回调一次；重新渲染不再回调）

@Entry-only lifecycle:
  onBackPress()  →  Called when back button pressed (return true to intercept)
```

### Lifecycle Methods Reference

| Method | When Called | Available In |
|--------|------------|--------------|
| `aboutToAppear()` | Before first build | All components |
| `build()` | UI rendering | All components |
| `onDidBuild()` | Called once after first-render build completes | API 12+ |
| `onPageShow()` | Page becomes visible | @Entry only |
| `onPageHide()` | Page becomes hidden | @Entry only |
| `onBackPress()` | Back button pressed | @Entry only |
| `aboutToDisappear()` | Before component destroyed | All components |

## @Builder Patterns

### Instance Builder
```typescript
@Builder MyBuilder() {
  Text("Hello")
}

build() {
  Column() {
    this.MyBuilder()  // Call with this.
  }
}
```

### Builder with Parameters
```typescript
@Builder
ItemBuilder(item: string) {
  Text(item)
}

build() {
  // ForEach 键值由第三参数 keyGenerator 生成（唯一、与数据相关，不要用 index）
  ForEach(this.items,
    (item: string) => {
      this.ItemBuilder(item)
    },
    (item: string) => item)
}

// 注意：@Builder 默认按值传参，状态变量的改变不会引起函数内 UI 刷新；
// 需要动态刷新时使用按引用传递（仅单参数对象字面量生效）或 @LocalBuilder / wrapBuilder（官方文档）。
```

## Re-render Optimization

### Problem: Non-Reactive Iteration in Build
```typescript
// ❌ 非响应式：this.items.forEach 不参与状态跟踪，items 变化不会触发 UI 刷新
build() {
  Column() {
    this.items.forEach((item: string) => {
      Text(item)
    })
  }
}
```

### Solution: @Builder + ForEach
```typescript
// ✅ 响应式渲染 + 键值复用
@Builder
ItemBuilder(item: string) {
  Text(item)
}

build() {
  Column() {
    ForEach(this.items,
      (item: string) => {
        this.ItemBuilder(item)
      },
      (item: string) => item)  // keyGenerator
  }
}
```

## Common Anti-Patterns

### 1. Missing Key Generator in ForEach
```typescript
// ❌ 无键值生成器：数据更新时无法精准复用/更新子组件（系统退化为按 index 键值）
ForEach(this.items, (item: string) => {
  Text(item)
})

// ✅ keyGenerator（ForEach 第三参数）启用最小化 diff 更新
// （.key() 不是 ForEach 的键值机制）
ForEach(this.items,
  (item: Item) => {
    Text(item.name)
  },
  (item: Item) => item.id)
```

### 2. Wrong State Granularity
```typescript
// ❌ 把频繁独立变化的字段塞进一个大对象：
//    任一属性变化都会触发所有依赖该对象的 UI 刷新
@State user: User = new User();  // { name, email, phone, address }

// ✅ 官方最佳实践：对复杂状态做精细化拆分，减少非必要渲染次数
@State name: string = "";
@State email: string = "";
@State phone: string = "";
@State address: string = "";

// 仅当多个属性总是同时变化时，才聚合成对象并配 @Observed 使用
@Observed
class User {
  name: string = "";
  avatar: string = "";
}
```

### 3. Side Effects in Build
```typescript
// ❌ Side effect in build (undefined behavior)
build() {
  console.log("rendering");  // May run multiple times
  Column() { Text("Hello") }
}

// ✅ Side effect in lifecycle（埋点等也可用 onDidBuild，API 12+，仅首次渲染后回调一次）
aboutToAppear() {
  console.log("component created");
}
```
