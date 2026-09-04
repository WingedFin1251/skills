# Navigation & Routing Deep Reference

## Router (Not Recommended) → Navigation Migration

### Router API (Not Recommended)

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
// Navigation / NavDestination / NavPathStack 均为 ArkUI 内置能力，无需 import
// （@kit.ArkUI 与 @ohos.arkui 均不导出这些组件/类，不存在此类导入语句）

@Entry
@Component
struct MainPage {
  private pageStack: NavPathStack = new NavPathStack();

  // 路由映射通过 Navigation 的 navDestination 属性注册
  // （NavPathStack 没有 register() 方法）
  @Builder
  PageMap(name: string) {
    if (name === "DetailPage") {
      DetailPage()
    }
  }

  build() {
    Navigation(this.pageStack) {
      Column() {
        Button("Go to Detail")
          .onClick(() => {
            // Navigation-based routing with NavPathStack (API 10+)
            this.pageStack.pushPathByName("DetailPage", { id: 123 });
          })
      }
    }
    .title("My App")
    .navDestination(this.PageMap)
  }
}

@Component
struct DetailPage {
  build() {
    NavDestination() {
      Column() {
        Text("Detail Page")
        Button("Go Back")
          .onClick(() => {
            // 通过 UIContext 获取 NavPathStack 并出栈
            this.getUIContext().getNavPathStack().pop();
          })
      }
    }
    .title("Detail")
  }
}

// 说明：
// - 跳转参数经 pushPathByName(name, param) 传入；取参需在 NavDestination 的
//   onReady 回调中或经 pathStack.getParamByIndex() 获取（返回值 unknown | undefined，需 as 转换）。
// - @Param 等 V2 装饰器只能用于 @ComponentV2，在 @Component 中使用会编译报错。
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
| `getParamByIndex()` | Get params by index (returns `unknown | undefined`, API 10+) | `this.pageStack.getParamByIndex(0)` |
| `moveToTop()` | Move page to top | `this.pageStack.moveToTop("Detail")` |
| `moveIndexToTop()` | Move index to top | `this.pageStack.moveIndexToTop(2)` |
| `removeByName()` | Remove page by name | `this.pageStack.removeByName("Detail")` |
| `removeIndex()` | Remove by index | `this.pageStack.removeIndex(1)` |
| `replacePath()` | Replace current page | `this.pageStack.replacePath({ name: "New" })` |
| `replacePathByName()` | Replace by name | `this.pageStack.replacePathByName("New", params)` |
| `getIndexByName()` | Get all indices by name (returns `Array<number>`, API 10+) | `this.pageStack.getIndexByName("Detail")` |

## Deep Link Configuration

URI 深链在 `module.json5` 的 **abilities[].skills[].uris** 数组中配置（官方示例；字段：scheme/host/port/path，其中 path 与 pathStartWith/pathRegex 三选一）：

```json
{
  "module": {
    "abilities": [
      {
        "skills": [
          {
            "actions": ["ohos.want.action.home"],
            "entities": ["entity.system.home"],
            "uris": [
              {
                "scheme": "myapp",
                "host": "detail",
                "path": "/page"
              }
            ]
          }
        ]
      }
    ]
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

### 1. Missing Page Declaration (Router)
```typescript
// ❌ 页面未在 main_pages.json（resources/base/profile）中声明
router.pushUrl({ url: "pages/UnregisteredPage" });  // 跳转失败

// ✅ 先在 main_pages.json 的 pages 数组中声明该页面再跳转
// （Navigation 无需页面清单：路由映射经 .navDestination(builder) 注册）
```

### 2. Wrong Param Passing
```typescript
// ❌ 索引访问非法：ArkTS 禁止 obj["field"]（arkts-no-props-by-index），
//    且 getParams() 返回 Object，既无类型检查也无法编译
// const id = router.getParams()["id"];

// ✅ 先声明类型，再用 as 转换后访问
interface DetailParams {
  id: number;
  name: string;
}
const params = router.getParams() as DetailParams;
const id = params.id;
```

### 3. Using Not-Recommended Router in New Code
```typescript
// ❌ 官方文档标注"不推荐"（无版本化废弃声明）
import router from "@ohos.router";

// ✅ Use Navigation component（Navigation 为内置组件，无需 import）
// @Entry @Component struct Page { private pathStack: NavPathStack = new NavPathStack(); ... }
```
