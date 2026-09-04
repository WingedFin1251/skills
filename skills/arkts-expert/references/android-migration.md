# Android → HarmonyOS Migration Guide

## Concept Mapping Table

| Android | HarmonyOS | Notes |
|---------|-----------|-------|
| `java.io.File` | `@ohos.file.fs` | No global `File` type in ArkTS |
| `FOREGROUND_SERVICE` | `@ohos.resourceschedule.backgroundTaskManager` + 具体 `BackgroundMode`（`DATA_TRANSFER`/`AUDIO_PLAYBACK`/`TASK_KEEPING` 等） | `BackgroundMode.LONG_TASK` 不存在；旧 `@ohos.backgroundTaskManager` 自 API 9 起废弃 |
| `SharedPreferences` | `@ohos.data.preferences` | API structure differs |
| `Intent` | `Want` | Different parameter passing |
| `Activity` | `UIAbility` | Lifecycle methods differ |
| `Fragment` | ArkTS Component | No direct equivalent |
| XML Layout | ArkTS Declarative | No XML layouts |
| `RecyclerView` | `List`/`Grid` + `LazyForEach` | Different API |
| `Socket.remoteInfo` | `@ohos.net.socket` | Different structure |
| `ContentProvider` | `@ohos.data.dataShare` | Different API |
| `BroadcastReceiver` | `CommonEventManager` | Different registration |
| `Service` | `BackgroundTaskManager`（长时任务 `startBackgroundRunning`） | 受系统长时任务配额限制；轻量后台逻辑用 ExtensionAbility |
| `Notification` | `NotificationManager` | Different API |

## API Translation Examples

### File Operations

#### Android
```java
File file = new File(path);
if (file.exists()) {
    FileInputStream fis = new FileInputStream(file);
    // read file
}
```

#### HarmonyOS
```typescript
import fs from "@ohos.file.fs";

const file = fs.openSync(path, fs.OpenMode.READ_ONLY);
if (file) {
  const stat = fs.statSync(path);
  // read file using file.fd
  fs.closeSync(file);
}
```

### SharedPreferences → Preferences

#### Android
```java
SharedPreferences prefs = context.getSharedPreferences("my_prefs", MODE_PRIVATE);
String name = prefs.getString("name", "");
```

#### HarmonyOS
```typescript
import dataPreferences from "@ohos.data.preferences";

const prefs = await dataPreferences.getPreferences(context, "my_prefs");
const name = (await prefs.get("name", "")) as string;
```

### Intent → Want

#### Android
```java
Intent intent = new Intent(this, DetailActivity.class);
intent.putExtra("id", 123);
startActivity(intent);
```

#### HarmonyOS
```typescript
import { Want } from "@kit.AbilityKit";

const want: Want = {
  bundleName: "com.example.app",
  abilityName: "DetailAbility",
  parameters: {
    id: 123
  }
};
// startAbility 需要上下文（UIAbility 中为 this.context.startAbility(want)）
this.context.startAbility(want);
```

## Native Module Declaration Chain

Using `.so` files in ArkTS requires a complete chain:

```
1. NAPI Implementation (C/C++)
   ↓
2. CMake 编译为 .so（build-profile.json5 的 buildOption.externalNativeOptions 配置，输出至 libs/<abi>/）
   ↓
3. Create .d.ts type declarations
   ↓
4. Import in ArkTS: import native from 'libxxx.so'
```

### Example

#### 1. Create .d.ts
```typescript
// src/main/ets/libxxx.d.ts
declare module 'libxxx.so' {
  export function initialize(): void;
  export function processData(data: ArrayBuffer): number;
}
```

#### 2. Configure build in build-profile.json5
（module.json5 中不存在 nativeLibs 字段；.so 由 CMake 经 externalNativeOptions 编译输出）
```json
{
  "buildOption": {
    "externalNativeOptions": {
      "path": "./CMakeLists.txt",
      "arguments": "",
      "cppFlags": ""
    }
  }
}
```

#### 3. Import in ArkTS
```typescript
import { initialize, processData } from 'libxxx.so';

initialize();
const data = new ArrayBuffer(8);
const result = processData(data);
```

## Common Migration Mistakes

### 1. Using Android File Type
```typescript
// ❌ No global File type in ArkTS
const file: File = new File(path);

// ✅ Use @ohos.file.fs
import fs from "@ohos.file.fs";
const file = fs.openSync(path, fs.OpenMode.READ_ONLY);
```

### 2. Wrong Background Mode
```typescript
// ❌ Android enum value（ArkTS 中不存在 FOREGROUND_SERVICE）
BackgroundMode.FOREGROUND_SERVICE;

// ✅ 官方模块 @ohos.resourceschedule.backgroundTaskManager 的 BackgroundMode
//    （注意：BackgroundMode.LONG_TASK 也不存在！）
import { backgroundTaskManager } from '@kit.BackgroundTasksKit';

backgroundTaskManager.startBackgroundRunning(
  context,
  backgroundTaskManager.BackgroundMode.DATA_TRANSFER,  // 按场景选择：DATA_TRANSFER/
  wantAgent);                                          // AUDIO_PLAYBACK/LOCATION/TASK_KEEPING 等
// 旧模块 @ohos.backgroundTaskManager 自 API 9 起废弃
```

### 3. Missing Native Module Types
```typescript
// ❌ No type declarations
import native from 'libxxx.so';  // ERROR: no types

// ✅ Create .d.ts file
// declare module 'libxxx.so' { ... }
```

## References

- [HarmonyOS Migration Guide](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/android-migration)
- [NAPI Development](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/native-background-development)
- [File System API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-file)
- [Preferences API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-data-preferences)
