# Service-Layer & Structural Audit（服务层/结构性问题审查）

> 针对"语法正确但行为不正确"的结构性问题——这类问题 lint 工具天然不可见，
> 需要三个代码之外的外部参照系：**兄弟方法、平台运行时、上游契约**。
> 本文件所有平台断言均对照 HarmonyOS 官方文档（API 26 快照）核验。

## 触发条件（全部满足才启用本流程）

- 被审对象是**封装类/服务类/工具类**（非 UI 组件：HttpClient、Repository、Storage、XxxClient 等）
- 含 **≥2 个职责相近的方法**（get/post/put/delete、读/写、open/save…）
- **前提：语法级检查已通过**——本流程是第二遍，不做 any/unknown、throw 限制等第一遍工作

## 依赖输入（缺一则对应步骤降级为"无法评估"，禁止臆断）

| 输入 | 缺失时 |
|---|---|
| 平台运行时知识（异常体系、网络 API 行为） | §参照系②整体降级 |
| 上游 API 契约知识（目标服务 REST 语义） | §参照系③整体降级 |
| 该类全部方法的完整代码（禁止只审单个方法） | 触发条件不成立，拒绝审查 |

---

## 第 0 步：文件角色判定

| 角色 | 典型问题 | 核心检查面 |
|---|---|---|
| UI 组件（@Component/@Entry） | 状态不刷新、生命周期泄漏 | 状态管理 V1/V2、异步回调安全（走 AGENTS.md §2/§3/§6） |
| 服务类（HttpClient/Storage） | 行为分叉、错误透传、关注点缺口 | **本文件**（参照系①②③） |
| 工具类（utils） | 依赖方向倒置、被业务层反向 import | 参照系④ |
| Worker/@Sendable 并发类 | 跨线程共享异常、共享堆对象逃逸 | 参照系②并发清单 |

> 跳过角色判定直接套规则，会把 UI 检查规则错用到服务类上（例如给服务类报告"状态管理 V1+V2 混用"）。

---

## 参照系①：代码 vs 兄弟方法（横向一致性）

**操作**：关注点 × 方法矩阵，逐格打勾。

横切关注点表头：`鉴权 / 限流 / 错误分类 / 超时 / 重试 / 资源释放 / 状态码判定 / body 解析`

- 同一关注点在**部分方法覆盖、其余缺失** → 🟠 HIGH
- 兄弟方法间**行为不一致**（兜底文案、超时值、错误码映射不同）→ 🟠 HIGH（分叉比重复更严重）
- **平台落点**：API 12+ 网络库提供**官方拦截器链（interceptor）**（重复类型实例报错码 2300802）——鉴权/日志/错误分类等横切关注点应**下沉到拦截器**，而非每个方法重复一套。
  证据：`@ohos.net.http (数据请求).md:2894-2922`

## 参照系②：代码 vs 平台运行时（ArkTS 校准清单）

| 平台事实（官方证据） | 结构问题形态 / 检查方式 |
|---|---|
| 官方错误对象为 `BusinessError`（含 code/message）；官方 API 示例统一 `(err as BusinessError).code/message`（api 全库 3000+ 处） | catch 内**直接 as 取 code 并对照模块错误码表**（如 http 2300xxx）；`instanceof` 缩窄不是官方形态，不要作为要求 |
| `arkts-limited-throw`：只允许 throw Error 及子类（错误码 10605032） | catch 中 e **必为 Error 子类**："非 Error 兜底分支"恒不可达 = 死代码/隐藏 bug |
| `@ohos.net.http` **无连接池、无内建重试** | "连接池/单例连接/自动重试"建议 = **平台概念泄漏**，禁止建议（重试需自实现） |
| http 请求用完必须 `destroy()`（官方："务必调用 destroy 方法释放资源，避免出现内存泄漏"，`@ohos.net.http.md:135,160`） | 每个 createHttp() 检查是否有 `finally + destroy()` |
| http 错误码 = **2300000 + curl 错误码**（2300028 超时 / 2300007 连接失败 / 2300094 认证错误…，`:213-249`）；responseCode 用 `http.ResponseCode` 多值判定 | REST 状态码（2xx 语义）与网络层错误（2300xxx）**两层错误模型**，分开判定 |
| 官方**支持**标准单例：`private constructor + static getInstance`（官方示例：PipManager、PreferencesUtil、NodePool、SelectionModel 等 8+ 处） | 单例写法合法；要审的是**单例状态的生命周期与线程安全**，而非"能不能写" |
| 对象 spread **不支持**；数组 spread **受限支持**（仅复制数组/剩余参数/数组字面量，10605099） | 对象合并用逐字段/构造器，禁止 `{...obj}` |
| utility types 仅 **Partial/Required/Readonly/Record**（10605138） | Pick/Omit 等不可用 |
| `@Sendable` 类成员变量必须是 **Sendable 支持的数据类型**（`Sendable使用规则与约束.md:120`）；@Sendable 类只能继承 @Sendable | Worker 传参类型链追踪；共享堆对象逃逸检查 |
| `@Reusable`(V1) 与 `@ComponentV2` 混用**渲染异常**（官方反例）；V2 复用用 `@ReusableV2`（API 18+） | 组件复用方案选型：V1 组件用 @Reusable，V2 组件用 @ReusableV2 |
| `@Builder` 默认按值传参；按引用仅限单参数对象字面量；函数内**禁改入参**（MutableBinding 除外） | 见 references/ui-components.md |

## 参照系③：代码 vs 上游契约（API 文档）

1. **硬编码假设表**：把代码中写死的状态码（204/200/201）、动词假设、Header 假设、限流范围逐条列出
2. 逐条对照上游 API 文档：**以文档为准，代码可能错**
   - 写请求禁止只断言单一成功码（如"PUT 返回 200+JSON，写死 204 会把成功当失败"）
   - 枚举动词覆盖率（编辑类接口常用 **PATCH**，封装类缺 PATCH = 覆盖不全）
   - 限流适用于全部动词，不只 GET
3. 无契约文档 → 标注"无法评估"，不得臆断

## 参照系④：模块依赖方向

```
entry (UI壳)
  ↓
feature (业务模块, HAP/HSP)
  ↓
common / infra (公共能力, HAR)
```

- 检查：依赖图（DevEco Studio 依赖视图）或人工画箭头，找 A→B→A 环
- **common 绝不能依赖 feature**（编译能过但边界破坏）；**传输层不能 import 业务服务**
- HSP 间依赖必须单向；HAR 被 HAP 引用无方向限制
- ⚠️ 工具注意：`hvigor --analyze` 现行语义是**构建耗时分析**（Build Analyzer），不是模块依赖分析；模块依赖请用 IDE 依赖视图

## 参照系⑤：V1/V2 状态管理混用（非 UI 类场景）

- 服务类中一般不涉及；但**持有 UI 引用的服务类/单例**要做：同一组件树内 V1（@State/@Prop/@Link）与 V2（@Local/@Param/@Monitor/@Computed）装饰器混用
- @ComponentV2 树内引用 @Component 子组件时的传参限制——API 19 前受官方严格校验（见《状态管理V1和V2混用指导》）
- @Builder 内修改入参（严格禁止）；按引用传参的"单参数+对象字面量"约束

---

## 执行流程（8 步，可重复执行）

```
1. 角色判定（UI/服务/工具/Worker）→ 决定检查面
2. 收集同层兄弟文件/方法          → 参照系①准备
3. 读取外部契约                  → API 文档 + 平台运行时限制（缺则降级标注）
4. 横向对比                      → 关注点 × 方法矩阵，找行为分叉
5. 纵向追踪依赖方向              → 循环依赖、common→feature 倒置
6. 异常路径可达性分析            → catch 真值表，找恒真/恒假分支
7. ArkTS 平台清单逐项核对        → 参照系②表格
8. 反模式清单扫描                → 见下
```

> 步骤 2 和 3 是 lint 缺失的两个外部输入——没有它们，结构性检查形同虚设。

## 服务层反模式清单

- 结构化数据 → 字符串 → 正则反解析（状态码被 parse 回来）
- catch 内 rethrow 导致原始异常透传给用户
- 非 Error 兜底用 JSON.stringify（应 as BusinessError 取 code）
- 通用命名 + 平台特化内容混居（XxxClient 写死某 API 细节）
- 依赖方向倒置：传输层 import 业务服务（循环依赖风险）
- 资源型 API（http/fs/socket）缺少 finally + destroy/close

---

## 验证门（防误报，MANDATORY）

任何性能/架构建议，**必须先核实目标平台是否提供对应能力**：
- 跨平台习惯用法（连接池、单例连接、缓存模式）在目标平台无对应 API → **禁止建议**，标记为"平台概念泄漏"
- 本地无法核实的平台断言 → 标注"待官方文档确认"，不得当作事实输出

## 结论校准（MANDATORY）

- 严重度按"**用户可感知的功能影响**"定级，不引用语法规则名
- 参照系①/②/③任一命中 → **禁止输出"可安全使用 / 0 Critical"**
- 报告出现模板指令原文（如 MUST INCLUDE AT TOP）→ 报告降级