# arkts-expert 变更日志

## [1.0.1] — 2026-08-28

### 修复（对照 HarmonyOS 官方文档 API 26 快照逐条核验）
- **Rule 0 版本表重写**（SKILL.md / AGENTS.md）：V2 状态管理仅 API 12+（原"API 10+ V2 preview"错误）；Navigation 自 API 8 起支持（API 9 配 NavRouter、API 10+ 配 NavPathStack）；router 为"不推荐"而非"deprecated since API 9"；删除虚构术语 "Custom Component Model"；Stage 模型 + module.json5 为 API 9 起标准
- **AGENTS.md §1**：泛型类型实参可从参数推断时允许省略（arkts-no-inferred-generic-params）；移除不存在的规则名 arkts-no-implicit-return-types（显式返回类型降为风格项，严格类型检查为 10605999）；对象字面量在上下文类型明确时合法直接传参（arkts-no-untyped-obj-literals 仅限 4 类受限上下文）
- **AGENTS.md §2**：@ObjectLink 可观察 @Observed 类实例**第一层**属性（深层需整体替换第一层或改用 V2）；@Local/@Param/@Monitor 等 V2 装饰器仅限 @ComponentV2（@Component 中使用编译报错）
- **AGENTS.md §3/§5**：ForEach/LazyForEach 键值统一改为第三参数 keyGenerator（删除 `.key()` 错误用法）；LazyForEach 必须传入 IDataSource 数据源实例；@ComponentV2 + @Local/@Trace 示例修正；补 Repeat（API 12+）建议
- **AGENTS.md §4**：删除虚构导入 `import { Navigation } from "@ohos.arkui"`；深链配置改为 abilities[].skills[].uris（原 uriOptions/uriOtions 不存在）
- **references/navigation.md**：删除不存在的 `NavPathStack.register()`；GridItem 无 `.span()` 属性（跨行列用 rowStart/columnStart 或 GridLayoutOptions）；router 页面注册位置为 main_pages.json；onDidBuild 为 API 12+
- **references/state-management.md**：@Provide/@Consume 为**双向同步**（原标注 One-way 错误）；@State 可观察第一层属性（原"user.name 不刷新"错误示例改为第二层示例）；V2 表补齐 @Event/@Monitor/@Provider/@Consumer/@Computed；V1 表修正 @State/@Prop 语义
- **references/performance.md**：@State 数组支持 push/pop/splice 等原地 API 更新（原"不可变状态"前提错误，仅嵌套属性需整体替换）；`@kit.*` 具名导入示例替换 `@ohos.arkui` 假导入；懒加载机制更正为动态 import()/lazy import/分包（@Builder 无懒加载能力）；@Trace 语义修正（无 @Trace 的属性无法驱动刷新）
- **references/android-migration.md**：BackgroundMode.LONG_TASK 不存在（改为 @ohos.resourceschedule.backgroundTaskManager 真实枚举值）；删除不存在的 module.json5 nativeLibs/armor 配置（改用 build-profile.json5 的 buildOption.externalNativeOptions）；startAbility 补上下文
- **scripts/arkts-lint.sh / arkts-lint.ps1**：检出范围修正（仅裸 `new Promise()` 需显式泛型，不再误报 `Promise.resolve(42)` 等合法代码）；移除假规则名 arkts-no-implicit-return-types；"deprecated router"→"不推荐"措辞；头部补充"启发式脚本、需人工复核"说明
- **README.md**：同步修正规则清单（移除假规则名）、@Track（V1）/@Trace（V2）版本归属、脚本数量（2 个）等

## [1.0.0] — 2026-08-27

### 新增
- SKILL.md：技能入口，含 Rule 0 版本检测 + 9 步工作流
- AGENTS.md：8 维度 × 30+ 条规则的完整参考（🔴语法/状态/UI → 🟠导航/性能/迁移 → 🟡风格）
- references/state-management.md：V1/V2 装饰器深度参考
- references/ui-components.md：组件模式与反模式
- references/navigation.md：Navigation/Router 迁移指南
- references/performance.md：性能优化模式
- references/android-migration.md：Android ↔ HarmonyOS 概念映射表
- scripts/arkts-lint.sh / arkts-lint.ps1：ArkTS 静态分析包装器（Bash / PowerShell）
- README.md：双语文档
- CHANGELOG.md：变更日志
