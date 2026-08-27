# Performance Optimization Deep Reference

## LazyForEach vs ForEach

| Feature | ForEach | LazyForEach |
|---------|---------|-------------|
| Rendering | All items at once | Visible items only |
| Memory | High (full list in memory) | Low (only visible items) |
| Scroll Performance | Poor for large lists | Smooth |
| Use Case | Small lists (<50 items) | Large lists (50+ items) |

### ForEach (Small Lists)
```typescript
ForEach(this.items, (item: string, index: number) => {
  Text(item).key(`item-${index}`)
})
```

### LazyForEach (Large Lists)
```typescript
LazyForEach(this.dataSource, (item: string, index: number) => {
  ListItem() {
    Text(item).key(`item-${index}`)
  }
})
```

## @Trace for Property-Level Updates

### Problem: Whole Object Re-render
```typescript
@ObservedV2
class Product {
  @Trace name: string = "";
  @Trace price: number = 0;
  @Trace stock: number = 0;
}

// When price changes, ALL Text components re-render
```

### Solution: @Trace Decorator
```typescript
@ObservedV2
class Product {
  @Trace name: string = "";    // Only updates name Text
  @Trace price: number = 0;   // Only updates price Text
  @Trace stock: number = 0;   // Only updates stock Text
}
```

## Immutable State Patterns

### Problem: Mutating State
```typescript
@State items: string[] = ["a", "b", "c"];

// ❌ Mutation doesn't trigger UI update
this.items.push("d");
```

### Solution: Create New Reference
```typescript
@State items: string[] = ["a", "b", "c"];

// ✅ New reference triggers UI update
this.items = [...this.items, "d"];
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

### Grid with Staggered Layout
```typescript
Grid() {
  ForEach(this.items, (item: string) => {
    GridItem() {
      Text(item)
    }
    .span(1)  // Grid span
  })
}
.columnsTemplate("1fr 1fr 1fr")
```

## Bundle Size Optimization

### Tree Shaking
- Import only what you need: `import { Button } from '@ohos.arkui'`
- Avoid importing entire modules

### Lazy Loading
```typescript
// Lazy load heavy components
@Builder
LazyComponent() {
  // Only loaded when needed
}
```

## Common Anti-Patterns

### 1. Anonymous Functions in List
```typescript
// ❌ Creates new function reference on every render
ForEach(this.items, (item: string) => {
  Text(item)
})

// ✅ Use @Builder for stable references
@Builder ItemBuilder(item: string) {
  Text(item)
}
```

### 2. Missing Key in ForEach
```typescript
// ❌ List diffing disabled
ForEach(this.items, (item: string) => {
  Text(item)
})

// ✅ Key enables efficient diffing
ForEach(this.items, (item: string) => {
  Text(item).key(item.id)
})
```

### 3. Excessive Re-renders
```typescript
// ❌ Unnecessary state
@State count: number = 0;
@State label: string = "Hello";
@State unused: string = "World";  // Never used in build

// ✅ Remove unused state
@State count: number = 0;
@State label: string = "Hello";
```
