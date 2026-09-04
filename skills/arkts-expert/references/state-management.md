# State Management Deep Reference

## V1 Decorators (API 7+; API 9 is the common baseline)

| Decorator | Scope | Direction | Use Case |
|-----------|-------|-----------|----------|
| `@State` | Component | Local (can be initialized from parent via named parameters) | Component-private reactive state |
| `@Prop` | Parent→Child | One-way | One-way sync from parent; local child changes do NOT propagate back |
| `@Link` | Parent↔Child | Two-way | Shared mutable state |
| `@Provide` | Ancestor↔Descendant | Two-way | Cross-level two-way sync (provider) |
| `@Consume` | Descendant↔Ancestor | Two-way | Cross-level two-way sync (consumer) |
| `@Observed` | Class | — | Enable nested object reactivity |
| `@ObjectLink` | Component | — | Reference @Observed object |
| `@Watch` | Any | — | Side effect on state change |

## V2 Decorators (API 12+)

| Decorator | Scope | Direction | Use Case |
|-----------|-------|-----------|----------|
| `@ObservedV2` | Class | — | V2 nested object reactivity |
| `@Trace` | Property | — | V2 property-level tracking |
| `@ComponentV2` | Component | — | V2 component model |
| `@Local` | Component | Local only | V2 local state |
| `@Param` | Parent→Child | One-way | V2 one-way binding |
| `@Once` | Parent→Child | One-time | V2 initial value only |
| `@Event` | Child→Parent | One-way | V2 callback for child→parent updates |
| `@Monitor` | Any | — | V2 watch on state change (V1 `@Watch` equivalent; API 12+) |
| `@Provider` | Ancestor↔Descendant | Two-way | V2 cross-level two-way sync |
| `@Consumer` | Descendant↔Ancestor | Two-way | V2 cross-level two-way sync |
| `@Computed` | Component | — | V2 derived value (no redundant state) |

## Decision Flowchart: V1 vs V2

```
New project (API 12+)?
├── Yes → Use V2 decorators
└── No → Existing project?
    ├── API 9-11 → Use V1 decorators
    └── API 12+ → Migrate to V2 for new code
```

## Common Mistakes

### 1. Missing @State for UI updates
```typescript
// ❌ UI won't update
count: number = 0;

// ✅ UI updates on change
@State count: number = 0;
```

### 2. Wrong decorator for parent-child binding
```typescript
// ❌ Child changes won't propagate to parent
@Prop value: number = 0;

// ✅ Two-way binding
@Link value: number;
```

### 3. Using @State for derived values
```typescript
// ❌ Redundant state
@State items: string[] = [];
@State count: number = 0;

// ✅ Derived value
@State items: string[] = [];
// count = this.items.length (computed in build)
// V2（API 12+）：使用 @Computed 声明派生属性
```

### 4. Deep nested object not reactive

```typescript
// ❌ Second-level change won't trigger UI update
@State user: UserProfile = new UserProfile();
// 注意：user.name 是第一层属性，@State 可以观察到（会刷新）；
// user.address.city 是第二层属性，@State 观察不到，UI 不刷新。

// ✅ Nested reactivity via @Observed/@ObjectLink (V1)
@Observed
class Address {
  city: string = "";
}

@Observed
class UserProfile {
  name: string = "";
  address: Address = new Address();
}

// 深层修改需要整体替换第一层属性（可被观察）：
// this.user.address = new Address();
// 深层属性级观测请用 V2 的 @ObservedV2 + @Trace（API 12+）
```
