# Navigation & Routing Deep Reference

## Router (Deprecated) → Navigation Migration

### Router API (Deprecated)

```typescript
import router from "@ohos.router";

// Push page
router.pushUrl({ url: "pages/DetailPage" });

// Replace page
router.replaceUrl({ url: "pages/DetailPage" });

// Go back
router.back();

// Get params
const params = router.getParams() as MyParams;
```

### Navigation API (Recommended)

```typescript
import { Navigation, NavDestination, NavPathStack } from "@kit.ArkUI";

@Entry
@Component
struct MainPage {
  private pageStack: NavPathStack = new NavPathStack();

  aboutToAppear() {
    // Register route mapping
    this.pageStack.register("DetailPage", "DetailPage");
  }

  build() {
    Navigation(this.pageStack) {
      Column() {
        Button("Go to Detail")
          .onClick(() => {
            // Navigation-based routing with NavPathStack
            this.pageStack.pushPath({ name: "DetailPage", param: { id: 123 } });
          })
      }
    }
    .title("My App")
  }
}

@Builder
DetailPageBuilder() {
  DetailPage()
}

@Component
struct DetailPage {
  @Param id: number = 0;

  build() {
    Column() {
      Text(`Detail Page - ID: ${this.id}`)
      Button("Go Back")
        .onClick(() => {
          // Access NavPathStack via this.getUIContext()
          this.getUIContext().getNavPathStack().pop();
        })
    }
  }
}
```

## NavPathStack API Reference

| Method | Description | Example |
|--------|-------------|---------|
| `pushPath()` | Push page with params | `this.pageStack.pushPath({ name: "Detail", param: { id: 1 } })` |
| `pushPathByName()` | Push by route name | `this.pageStack.pushPathByName("Detail", { id: 1 })` |
| `pop()` | Go back | `this.pageStack.pop()` |
| `popToName()` | Pop to specific page | `this.pageStack.popToName("Main")` |
| `popToIndex()` | Pop to index | `this.pageStack.popToIndex(0)` |
| `clear()` | Clear entire stack | `this.pageStack.clear()` |
| `getAllPathName()` | Get all page names | `this.pageStack.getAllPathName()` |
| `getParamByIndex()` | Get params by index | `this.pageStack.getParamByIndex(0)` |
| `moveToTop()` | Move page to top | `this.pageStack.moveToTop("Detail")` |
| `moveIndexToTop()` | Move index to top | `this.pageStack.moveIndexToTop(2)` |
| `removeByName()` | Remove page by name | `this.pageStack.removeByName("Detail")` |
| `removeIndex()` | Remove by index | `this.pageStack.removeIndex(1)` |
| `replacePath()` | Replace current page | `this.pageStack.replacePath({ name: "New" })` |
| `replacePathByName()` | Replace by name | `this.pageStack.replacePathByName("New", params)` |
| `getIndexByName()` | Get index by name | `this.pageStack.getIndexByName("Detail")` |

## Deep Link Configuration

In `module.json5`:

```json
{
  "module": {
    "uriOptions": {
      "domains": [
        {
          "scheme": "myapp",
          "host": "detail",
          "path": "/page"
        }
      ]
    }
  }
}
```

## Page Stack Management

### Push with Params
```typescript
// Push with parameters
this.navPathStack.pushPath({ name: "DetailPage", param: { id: 123 } });
```

### Pop Page
```typescript
// Go back
this.navPathStack.pop();

// Pop to specific page
this.navPathStack.popToName("MainPage");
```

### Replace Page
```typescript
// Replace current page
this.navPathStack.replacePath({ name: "NewPage" });
```

## Common Mistakes

### 1. Missing Route Configuration
```typescript
// ❌ Page not registered in module.json5
router.pushUrl({ url: "pages/UnregisteredPage" });

// ✅ Ensure page is in module.json5 routes
```

### 2. Wrong Param Passing
```typescript
// ❌ Type-unsafe params
const id = router.getParams()["id"];  // No type checking

// ✅ Typed params
interface DetailParams {
  id: number;
  name: string;
}
const params = router.getParams() as DetailParams;
```

### 3. Using Deprecated Router in New Code
```typescript
// ❌ Deprecated since API 9
import router from "@ohos.router";

// ✅ Use Navigation component
import { Navigation, NavPathStack } from "@kit.ArkUI";
```
