# arkts-expert

**ArkTS/HarmonyOS 代码审查技能：10 维度优先级规则 + Android 迁移映射 + 严格语法检测。覆盖状态管理（V1/V2）、UI 组件、导航路由、性能优化、生命周期管理、服务层一致性、平台运行时安全。**

**Deterministic ArkTS/HarmonyOS code review: 10 priority-ranked rule dimensions + Android migration mapping + strict syntax detection. Covers state management (V1/V2), UI components, navigation, performance, lifecycle, service-layer consistency, and platform runtime safety.**

> 灵感来自 [cpp-expert](https://skills.sh/)。不同于纯知识注入型技能，arkts-expert 专注于 ArkTS 的严格语法约束和 Android → HarmonyOS 迁移陷阱——这些是开发者从 Android 迁移到 HarmonyOS 时最常遇到的三类错误。
>
> Inspired by [cpp-expert](https://skills.sh/). Unlike pure knowledge-injection skills, arkts-expert focuses on ArkTS's strict syntax constraints and Android → HarmonyOS migration pitfalls — the three most common error categories developers encounter.

---

## 目录 / Table of Contents
- [快速开始 / Quick Start](#快速开始--quick-start)
- [技能结构 / Skill Structure](#技能结构--skill-structure)
- [规则体系 / Rule System](#规则体系--rule-system)
- [工作流程 / Workflow](#工作流程--workflow)
- [工具脚本 / Tool Scripts](#工具脚本--tool-scripts)
- [代码审查输出格式 / Review Output Format](#代码审查输出格式--review-output-format)
- [参考链接 / References](#参考链接--references)
- [许可 / License](#许可--license)

---

## 快速开始 / Quick Start

### 安装 / Installation
```bash
# 方式一：通过 skills CLI（推荐）
# Option 1: Via skills CLI (recommended)
npx skills add WingedFin1251/arkts-expert

# 方式二：手动复制到项目
# Option 2: Manually copy into your project
cp -r arkts-expert <your-project>/.agents/skills/
```

### 使用 / Usage
在 Claude Code 中，当你的问题涉及 ArkTS/HarmonyOS 代码时，技能会自动触发。你也可以直接要求：

In Claude Code, the skill triggers automatically when your question involves ArkTS/HarmonyOS code. You can also explicitly ask:

```
审查这段 ArkTS 代码的状态管理
Review this ArkTS code for state management
帮我检查有没有 any/unknown 类型
Check if there's any any/unknown type
运行 lint 脚本检查这个文件
Run the lint script on this file
```

---

## 技能结构 / Skill Structure

```
arkts-expert/
├── SKILL.md                    # 入口：触发条件 + Rule 0 + 9 步工作流
│                               # Entry: triggers + Rule 0 + 9-step workflow
├── AGENTS.md                   # 完整规则参考：10 维度 × ❌/✅ 示例
│                               # Full rule reference: 10 dimensions × ❌/✅ examples
├── references/
│   ├── state-management.md     # V1/V2 装饰器深度参考
│   │                           # V1/V2 decorator deep reference
│   ├── ui-components.md        # 组件模式与反模式
│   │                           # Component patterns and anti-patterns
│   ├── navigation.md           # Navigation/Router 迁移指南
│   │                           # Navigation/Router migration guide
│   ├── performance.md          # 性能优化模式
│   │                           # Optimization patterns
│   ├── android-migration.md    # Android ↔ HarmonyOS 概念映射表
│   │                           # Android ↔ HarmonyOS concept mapping
│   ├── service-layer.md        # 服务层/结构性问题审查流（非 UI 类）
│   │                           # Service-layer / structural audit flow
│   └── fix-planning.md         # 修复规划与协调（Fix Dependency Graph / DSL / 两阶段）
│                               # Fix planning & coordination (dependency graph / DSL / two-phase)
└── scripts/
    ├── arkts-lint.sh           # ArkTS 静态分析包装器 (Bash)
    │                           # ArkTS static analysis wrapper (Bash)
    └── arkts-lint.ps1          # ArkTS 静态分析包装器 (PowerShell)
                                # ArkTS static analysis wrapper (PowerShell)
```

---

## 规则体系 / Rule System

10 个检查维度按优先级排列 / Ten review dimensions ordered by priority:

| 优先级 / Priority | 维度 / Dimension | 关键检查项 / Key Checks |
| :---------------- | :--------------- | :---------------------- |
| 🔴 **CRITICAL** | ArkTS 语法 / ArkTS Syntax | no-any-unknown, limited-throw, inferred-generics（显式返回类型为风格项，非编译规则） |
| 🔴 **CRITICAL** | 状态管理 / State Management | V1/V2 装饰器正确性、状态重复、更新触发 / V1/V2 decorator correctness, state duplication, update triggers |
| 🔴 **CRITICAL** | UI 组件 / UI Components | 组件生命周期、重渲染优化、@Builder / Component lifecycle, re-render optimization, @Builder |
| 🟠 **HIGH** | 导航路由 / Navigation | Router vs Navigation、深度链接、页面栈 / Router vs Navigation, deep links, page stack |
| 🟠 **HIGH** | 性能优化 / Performance | LazyForEach/Repeat、@Track（V1 属性级更新）/@Trace（V2 属性级观测）、不可变状态（V1 语义） / LazyForEach/Repeat, @Track (V1 property-level update) / @Trace (V2 property-level observation), immutable state (V1 semantics) |
| 🟠 **HIGH** | 副作用 / Side Effects | 定时器清理、内存泄漏、aboutToAppear/Disappear / Timer cleanup, memory leaks, lifecycle |
| 🟠 **HIGH** | Android 迁移 / Android Migration | 概念映射、API 翻译、原生模块链 / Concept mapping, API translation, native module chain |
| 🟠 **HIGH** | 服务层一致性 / Service-Layer Consistency | 关注点矩阵（鉴权/限流/超时/重试/资源释放）、上游契约核对、PATCH 覆盖 / Cross-method matrix, upstream contract, verb coverage |
| 🟠 **HIGH** | 平台运行时与结构安全 / Platform Runtime & Structural Safety | BusinessError 错误码、资源释放（destroy）、@Sendable、模块依赖方向、平台概念泄漏验证门 / BusinessError code, destroy, @Sendable, dependency direction, platform-leak check |
| 🟡 **MEDIUM** | 代码风格 / Code Style | 命名规范、项目结构、注释 / Naming conventions, project structure, comments |

### Rule 0：版本检测（元规则） / Rule 0: Version Detection (Meta-Rule)
自动识别目标 API 版本（API 9 / 10-11 / 12+），根据版本调整状态管理策略（V1/V2，V2 仅 API 12+）和导航方式（router 不推荐 / Navigation）。

Automatically identifies target API version (API 9 / 10-11 / 12+) and adjusts state management strategy (V1/V2, V2 is API 12+ only) and navigation approach (router not recommended / Navigation) accordingly.

---

## 工作流程 / Workflow

当技能触发时，AI 依次执行 9 步工作流；**Stage 2 按文件角色分叉**：被审对象为封装类/服务类/Worker 类时，导航/性能/迁移检查（Step 5-8）替换为服务层审查流（维度 9/10，见 references/service-layer.md）。**报告两阶段产出（v2.1）**：诊断（问题清单，无修复代码）→ 规划（修复 DSL + 依赖图 + 分批）；≥3 个修复或共享目标时启用修复协调（references/fix-planning.md）。

When the skill triggers, the AI executes a 9-step workflow; **Stage 2 branches by file role**: for wrapper/service/Worker classes, checks 5-8 are replaced by the Service-Layer Audit flow (dimensions 9-10, see references/service-layer.md). **Two-phase reporting (v2.1)**: Diagnosis (issues only) → Planning (fix DSL + dependency graph + batches); fix coordination activates at ≥3 fixes or shared targets (references/fix-planning.md).

```
╔═══════════════════════════════════════════╗
║  Step 1: 版本检测 / Version Detection     ║  MANDATORY
║  检查 build-profile.json5 / module.json5  ║
╚═══════════════════════════════════════════╝
                      ↓
╔═══════════════════════════════════════════╗
║  Step 2: ArkTS 语法审查 / Syntax Review  ║  🔴 CRITICAL
║  no-any-unknown, limited-throw, etc.     ║
╚═══════════════════════════════════════════╝
                      ↓
╔═══════════════════════════════════════════╗
║  Step 3: 状态管理审查 / State Review      ║  🔴 CRITICAL
║  V1/V2 装饰器正确性、状态重复             ║
╚═══════════════════════════════════════════╝
                      ↓
╔═══════════════════════════════════════════╗
║  Step 4: UI 组件审查 / UI Review         ║  🔴 CRITICAL
║  生命周期、@Builder、重渲染               ║
╚═══════════════════════════════════════════╝
                      ↓
╔═══════════════════════════════════════════╗
║  Step 5-8: 资源与性能 / Resource & Perf   ║  🟠 HIGH
║  导航、性能、副作用、迁移                 ║
╚═══════════════════════════════════════════╝
                      ↓
╔═══════════════════════════════════════════╗
║  Step 9: 代码风格 + 生成报告              ║  🟡 MEDIUM
║  命名、结构、报告模板                     ║
╚═══════════════════════════════════════════╝
```

---

## 工具脚本 / Tool Scripts

### `arkts-lint.sh`
对指定 ArkTS 源文件运行静态分析 / Runs static analysis on the specified ArkTS source file.

```bash
bash scripts/arkts-lint.sh src/main/ets/pages/Index.ets
```

自动检测：any/unknown 使用、非 Error throw、裸 new Promise()（缺泛型）、缺失返回类型（风格项）、不推荐 router 使用。

Automatically detects: any/unknown usage, non-Error throws, bare new Promise() (missing generic), missing return types (style), not-recommended router usage.

---

## 代码审查输出格式 / Review Output Format

审查结果按优先级分三区，附 Android 迁移说明 / Results are organized into three priority tiers with Android migration notes:

```
## Summary
- 代码总体评价 / Overall assessment

## Critical Issues 🔴
- ArkTS 语法 / 状态管理 / UI 组件问题
- ArkTS syntax / state management / UI component issues

## High Priority 🟠
- 导航 / 性能 / 副作用 / 迁移问题
- Navigation / performance / lifecycle / migration issues

## Medium Priority 🟡
- 代码风格建议
- Code style suggestions

## Android Migration Notes
- 概念映射表（如适用）
- Concept mapping table (if applicable)

## Service-Layer / Structural Notes（封装类/服务类/Worker 才输出）
- 关注点矩阵结论、异常可达性（死分支）、平台能力验证门结论
- Cross-method matrix, exception reachability, platform-capability checks

## Issue Count + Recommendation
```

---

## 参考链接 / References
- [HarmonyOS Developer Docs](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/)
- [ArkTS Language Specification](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-get-started)
- [ArkUI Component Reference](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/arkui/ts-basic-components)
- [State Management V1](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-state-management)
- [State Management V2](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-state-management-v2)
- [Claude Code Skills 文档 / Claude Code Skills Docs](https://docs.anthropic.com/en/docs/claude-code/skills)

---

### 版本历史 / Version History
- **v2.1** — 修复协调三层约束：Fix Dependency Graph + 诊断/规划分离 + 修复 DSL；新增 references/fix-planning.md；AGENTS.md §11；报告两阶段产出 / Fix coordination: dependency graph + diagnosis/planning split + fix DSL; new references/fix-planning.md; AGENTS.md §11; two-phase reports
- **v2.0** — 维度升级：8 → 10（新增服务层一致性、平台运行时与结构安全）；Stage 2 角色分叉审查流；新增 references/service-layer.md；Two-Stage 流程 v2.0 / Dimension upgrade 8 → 10 (service-layer consistency, platform runtime & structural safety); Stage 2 role-based branching; new references/service-layer.md
- **v1.0** — 初始版本：8 维度规则体系、5 参考文件、2 工具脚本、Android 迁移映射 / Initial release: 8-dimension rule system, 5 reference files, 2 tool scripts, Android migration mapping

---

## 许可 / License

MIT
