# Common Compiler Errors Quick Reference

## Undefined Reference / Linker Errors

```
undefined reference to `foo::bar()'
```
Likely causes: missing implementation, not linking the object file, header-only declaration without inline/to define.

## Template Errors

```
error: 'type' is not a member of 'std::enable_if<false, void>'
```
Likely causes: SFINAE condition not met, missing `typename` keyword.

```
error: expected ';' at end of member declaration
```
Likely: forgot `;` after class/struct definition.

```
error: cannot declare variable 'x' to be of abstract type 'Base'
```
Likely: deriving from abstract class without implementing all pure virtuals.

## Segmentation Fault Investigation

1. **Accessing null pointer** → Check if pointer was initialized
2. **Stack overflow** → Excessive recursion or large stack allocation
3. **Buffer overflow** → Writing past array bounds (use vector with .at() for bounds check)
4. **Use-after-free** → Check object lifetime vs pointer/reference usage
