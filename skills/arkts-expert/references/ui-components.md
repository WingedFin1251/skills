# UI Components Deep Reference

## Component Types

| Type | Keyword | Use Case |
|------|---------|----------|
| Entry Component | `@Entry @Component` | Page entry point |
| Custom Component | `@Component` | Reusable component |
| Builder Function | `@Builder` | UI fragment in build |
| Styles | `@Styles` | Reusable style sets |
| Extend | `@Extend` | Extend built-in component styles |

## Component Lifecycle

```
aboutToAppear()  →  build()  →  onDidBuild()  →  onPageShow()  →  onPageHide()  →  aboutToDisappear()
     ↑                                  ↑                                           ↑
 Initialization                    API 10+                                    Visibility

@Entry-only lifecycle:
  onBackPress()  →  Called when back button pressed (return true to intercept)
```

### Lifecycle Methods Reference

| Method | When Called | Available In |
|--------|------------|--------------|
| `aboutToAppear()` | Before first build | All components |
| `build()` | UI rendering | All components |
| `onDidBuild()` | After build completes | API 10+ |
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
ItemBuilder(item: string, index: number) {
  Text(item)
    .key(`item-${index}`)
}

build() {
  ForEach(this.items, (item: string, index: number) => {
    this.ItemBuilder(item, index)
  })
}
```

## Re-render Optimization

### Problem: Anonymous Functions in Build
```typescript
// ❌ Causes full re-render on every state change
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
// ✅ Only re-renders affected items
@Builder
ItemBuilder(item: string) {
  Text(item)
}

build() {
  Column() {
    ForEach(this.items, (item: string) => {
      this.ItemBuilder(item)
    })
  }
}
```

## Common Anti-Patterns

### 1. Missing Key in ForEach
```typescript
// ❌ List optimization disabled
ForEach(this.items, (item: string) => {
  Text(item)
})

// ✅ Key enables diffing optimization
ForEach(this.items, (item: string) => {
  Text(item).key(item.id)
})
```

### 2. Excessive State Variables
```typescript
// ❌ Too many state variables
@State name: string = "";
@State email: string = "";
@State phone: string = "";
@State address: string = "";

// ✅ Group related state
@State user: User = new User();
```

### 3. Side Effects in Build
```typescript
// ❌ Side effect in build (undefined behavior)
build() {
  console.log("rendering");  // May run multiple times
  Column() { Text("Hello") }
}

// ✅ Side effect in lifecycle
aboutToAppear() {
  console.log("component created");
}
```
