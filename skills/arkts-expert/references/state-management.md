# State Management Deep Reference

## V1 Decorators (API 9+)

| Decorator | Scope | Direction | Use Case |
|-----------|-------|-----------|----------|
| `@State` | Component | Local only | Component-private reactive state |
| `@Prop` | Parent→Child | One-way | Read-only data from parent |
| `@Link` | Parent↔Child | Two-way | Shared mutable state |
| `@Provide` | Ancestor→Descendant | One-way | Implicit prop drilling |
| `@Consume` | Descendant←Ancestor | One-way | Receive @Provide |
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
```

### 4. Nested object not reactive
```typescript
// ❌ Changes to user.name won't trigger UI update
@State user: UserProfile = new UserProfile();

// ✅ Nested reactivity enabled
@Observed
class UserProfile { name: string = ""; }

@ObjectLink user: UserProfile;
```
