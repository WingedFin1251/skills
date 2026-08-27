# Modern C++ Feature Quick Reference

## Feature By Standard

| Feature | C++11 | C++14 | C++17 | C++20 |
|---------|-------|-------|-------|-------|
| auto | ✅ basic | ✅ return type | ✅ | ✅ |
| constexpr | ✅ functions | ✅ relaxed | ✅ if/ Lambda | ✅ virtual/trivial |
| unique_ptr/shared_ptr | ✅ | ✅ | ✅ | ✅ |
| nullptr | ✅ | ✅ | ✅ | ✅ |
| override/final | ✅ | ✅ | ✅ | ✅ |
| enum class | ✅ | ✅ | ✅ | ✅ |
| Range-based for | ✅ | ✅ | ✅ | ✅ init-stmt |
| move semantics | ✅ | ✅ | ✅ | ✅ |
| lambda | ✅ | ✅ generic | ✅ constexpr | ✅ template |
| std::optional | ❌ | ❌ | ✅ | ✅ |
| std::variant | ❌ | ❌ | ✅ | ✅ |
| std::any | ❌ | ❌ | ✅ | ✅ |
| [[nodiscard]] | ❌ | ❌ | ✅ | ✅ |
| concepts | ❌ | ❌ | ❌ | ✅ |
| ranges | ❌ | ❌ | ❌ | ✅ |
| std::span | ❌ | ❌ | ❌ | ✅ |

## Migration Path: C++98 → C++17

1. `NULL` → `nullptr`
2. Raw `new`/`delete` → `unique_ptr`/`make_unique`
3. `typedef` → `using`
4. `class` with manual dtor/copy → Rule of Five or `=default`
5. `throw()` → `noexcept`
6. `std::auto_ptr` → `std::unique_ptr`
7. Raw arrays → `std::array` or `std::vector`
8. C-style casts → `static_cast`/`dynamic_cast`/`const_cast`

## Concepts (C++20)

### `requires` Clause Misuse

```cpp
// ❌ Over-constraining — same_as is too strict
template<typename T>
    requires std::same_as<T, int>
void process(T val);

// ✅ Use convertible_to for input parameters
template<typename T>
    requires std::convertible_to<T, int>
void process(T val);
```

### Constraint Satisfaction & SFINAE

```cpp
// ❌ Constraints that don't SFINAE properly
template<typename T>
    requires sizeof(T) > 4
void process(T val);  // Ill-formed if sizeof(T) <= 4, no fallback

// ✅ Use requires clause with type trait
template<typename T>
    requires (sizeof(T) > 4)
void process(T val);

template<typename T>
void process(T val) { /* fallback */ }
```

## Ranges & Views (C++20)

### View Dangling

```cpp
// ❌ Dangling view — temporary range
auto get_evens(const std::vector<int>& v) {
    return v | std::views::filter([](int x) { return x % 2 == 0; });
}  // OK — v outlives the view

auto bad() {
    return std::vector{1,2,3,4} | std::views::filter([](int x) { return x % 2 == 0; });
}  // BUG: returns dangling view to temporary
```

### Lazy Evaluation Side Effects

```cpp
int side_effect_count = 0;
auto view = numbers | std::views::transform([](int x) {
    ++side_effect_count;
    return x * 2;
});
// Side effects NOT evaluated yet! They happen when view is consumed.
```

## Coroutines (C++20)

### Promise Object Leak

```cpp
// ❌ Coroutine frame never destroyed
auto leaky_task() {
    // If this coroutine is started but never co_await'ed,
    // the coroutine frame leaks
    co_return 42;
}

// ✅ RAII wrapper for coroutine handle
struct Task {
    struct promise_type { /* ... */ };
    std::coroutine_handle<promise_type> handle;
    ~Task() { if (handle) handle.destroy(); }
};
```

### `co_await` Lifetime

```cpp
// ❌ Awaiting a temporary
auto result = co_await some_task();  // OK — result is moved
auto& ref = co_await some_task();    // BUG: reference to temporary
```

## `std::span` (C++20)

### Dangling Span

```cpp
// ❌ Span to local array
std::span<int> bad() {
    int arr[] = {1, 2, 3};
    return arr;  // BUG: span points to stack that will be freed
}

// ✅ Return vector or pass ownership
std::vector<int> good() {
    return {1, 2, 3};
}
```

### Size Mismatch

```cpp
// ❌ Span from raw pointer — size is caller's responsibility
void process(std::span<int> s);
int arr[10];
process({arr, 100});  // BUG: claims size 100, only 10 elements

// ✅ Use the whole array
process(arr);  // Deduces correct size
```

## `std::format` (C++20)

Type-safe alternative to printf/sprintf with compile-time format checking.

```cpp
void test_format() {
    // ❌ sprintf — type-unsafe
    char buf[100];
    sprintf(buf, "value: %d", 42);  // Wrong format specifier → UB

    // ✅ std::format — compile-time checked
    auto s = std::format("value: {}", 42);     // OK — type deduced
    auto t = std::format("value: {:d}", 42);   // OK
    // auto u = std::format("value: {:s}", 42); // Compile error: int is not a string
}
```

## Review Checklist

When reviewing modern C++ code, check for:
- [ ] Coroutine frames destroyed (RAII wrapper)
- [ ] No dangling views or spans
- [ ] Concepts not over-constrained
- [ ] `std::format` preferred over sprintf
- [ ] `std::span` size matches actual buffer
