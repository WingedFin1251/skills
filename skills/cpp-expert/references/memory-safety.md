# Memory Safety Deep Reference

## Smart Pointer Selection Guide

| Need | Use | Notes |
|------|-----|-------|
| Single ownership, no sharing | `std::unique_ptr` | Zero overhead, move-only |
| Shared ownership | `std::shared_ptr` | Reference-counted, use `make_shared` |
| Breaking circular refs, observing | `std::weak_ptr` | Lock to `shared_ptr` before use |
| Raw access, no ownership | Raw pointer `T*` or reference `T&` | Never `delete` |

## Memory Leak Checklist

- [ ] Every `new` has matching `delete` (or use unique_ptr)
- [ ] Every `new[]` has matching `delete[]` (or use vector/unique_ptr<T[]>)
- [ ] Every `malloc`/`calloc` has matching `free`
- [ ] Every `fopen` has matching `fclose`
- [ ] No raw `new`/`delete` in user code (wrap in RAII)
- [ ] Virtual destructor in any class with virtual functions

## Buffer Overflow Patterns

```cpp
// BAD: Fixed-size buffer, unchecked write
char buf[32];
strcpy(buf, user_input);  // Overflow if input > 31 chars

// GOOD: Bounds-checked
std::string safe(user_input);  // Automatic growth

// In C:
char buf[32];
strncpy(buf, user_input, sizeof(buf) - 1);
buf[sizeof(buf) - 1] = '\0';
```

## Use-After-Free Patterns

```cpp
// BAD: Holding raw pointer across vector mutation
int* p = &vec[0];
vec.push_back(42);     // May reallocate — p is now dangling!
*p = 10;               // Use-after-free

// GOOD: Use index instead of raw pointer
size_t idx = 0;
vec.push_back(42);
vec[idx] = 10;
```

---

