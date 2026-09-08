# arkts-expert 变更日志

## [2.1.1] — 2026-08-28

### 修复（fix-coordination 规范缺陷与同步问题）
- **交付模式澄清**（SKILL.md / AGENTS.md §11.2 / 报告格式）：诊断与规划默认**单稿内分区**输出（规划标注"待确认后实施"）；分两轮交付仅当用户明确要求或影响面大（≥5 修复/跨模块重构）——原"先发布阶段一、用户确认后再发布阶段二"的强制两轮与常态单轮审查冲突
- **证据引用自相矛盾修正**（AGENTS.md §11.2 / fix-planning.md 阶段一）：澄清"禁止代码块"= 禁止**修复性代码**；问题证据允许行内短引用（≤3 行原样代码）——原措辞"禁止任何代码块"与模板中 Evidence 代码引用要求互斥
- **DSL 补 Evidence 字段**（fix-planning.md 字段表）：Preconditions/Side_Effects/Conflicts_With 中提及具体模块/状态键的条目须附文件:行证据或标注"假设：待确认"，禁止编造引用（防幻觉）
- **Side_Effects 强制结构化枚举**（fix-planning.md）：Dependency ±边 / State ±键 / Behavior / Scope——使核验规则 4"交集为空"可由键集比较实现（原自由文本无法机械化）
- **补两条核验规则**：⑤ depends on 环检测（A→B→A 无拓扑序必须拆分/合并）；⑥ 同 Target 修复未声明 alternative to → 违规（重复方案漏检）
- **术语消歧**（fix-planning.md 头部）：诊断/规划 = 产出时序；与 SKILL Stage 1/Stage 2（审查深度）勿混用
- **验证门衔接**（fix-planning.md）：Resolution 选型受 service-layer.md 验证门约束（事件方案须落官方 emitter/AppStorage 机制）
- **README.md 同步 v2.1**：结构树补 fix-planning.md、工作流补两阶段说明、版本历史补 v2.1（此前遗漏，仅 SKILL/AGENTS/CHANGELOG 升级）

## [2.1.0] — 2026-08-28

### 新增（修复协调性 — 三层约束）
- **新增 references/fix-planning.md**：修复规划与协调规范——把隐性冲突变成显性规则：
  - **机制层**：Fix Dependency Graph（`depends on` / `conflicts with` / `alternative to` 三类边，文本或 Mermaid）
  - **流程层**：两阶段产出分离（阶段一问题诊断报告禁止修复代码 → 用户确认 → 阶段二修复规划报告）
  - **形式化层**：修复 DSL（Fix_ID/Target/Severity/Approach/Preconditions/Postconditions/Side_Effects/Conflicts_With/Resolution 必填字段）
  - 依赖拓扑分批（Batch 1 无前置依赖…）、冲突消解模式、自动核验规则、输出检查清单
- **AGENTS.md 新增 §11 Fix Coordination**：触发条件（≥3 修复或共享目标）、两阶段产出规范、DSL 强制字段与 5 条核验规则、冲突消解模式（依赖反转先行/事件方案/拦截器下沉）
- **AGENTS.md 报告格式重构**：Code Review Report Format 拆为"阶段一问题诊断报告"与"阶段二修复规划报告"两套模板，各带自检清单；轻度审查（<3 修复）合并为单报告但必须声明 Fix Dependency Graph 无冲突
- **SKILL.md 升级 v2.1**：Two-Stage Deep Review / Attention Budget / Skipped File Rules 版本号 v2.0→v2.1；报告输出格式同步两阶段；Quick Reference 新增 Fix Coordination 行；Bundled Resources 新增 fix-planning.md
- 修复协调规则不依赖 HarmonyOS 平台断言（纯方法论），但 DSL 示例（AuthService/HttpClient/AppStorage/UNAUTHORIZED_EVENT）与 §9/§10 服务层审查流对齐

## [2.0.0] — 2026-08-28

### 新增（维度升级 8 → 10）
- **新增 references/service-layer.md**：服务层/结构性问题审查流——文件角色判定（UI/服务/工具/Worker）+ 5 大参照系（兄弟方法横向矩阵、平台运行时清单、上游契约、模块依赖方向、V1/V2 混用）+ 8 步执行流程 + 反模式清单 + 验证门 + 结论校准
- **AGENTS.md 新增两章**：§9 服务层一致性（关注点矩阵、上游契约核对、PATCH 覆盖）；§10 平台运行时与结构安全（BusinessError 错误码、资源释放 destroy、平台能力验证门、@Sendable、模块依赖方向、@Reusable/@ComponentV2 选型）
- **SKILL.md 升级 v2.0**：Two-Stage Deep Review / Attention Budget / Skipped File Rules 版本号 v1.0→v2.0；Stage 2 增加**按文件角色分叉**（UI 组件走默认检查 5-8；封装类/服务类切换服务层审查流；Worker/@Sendable 走并发清单）；Quick Reference、When to Apply、Bundled Resources、报告模板同步（报告新增第 7 节 Service-Layer Notes）
- **README.md**：维度清单/结构树/规则表/版本历史同步 10 维度 + service-layer.md
- 新增内容全部对照 HarmonyOS 官方文档（API 26 快照）核验，修正了原参考方法论中的 4 处被证伪断言（单例模式、spread/utility types 支持范围、@Reusable 与 @ComponentV2 兼容性、hvigor analyze 语义）

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
