# Skills Collection

**A collection of Claude Code skills for C/C++, ArkTS/HarmonyOS, and STM32 embedded development.**

## Available Skills

| Skill | Description | Version |
|-------|-------------|---------|
| **cpp-expert** | C/C++ 代码审查：内存安全、UB、并发、风格 | v1.6.1 |
| **arkts-expert** | ArkTS/HarmonyOS 代码审查：状态管理、UI、导航、服务层 | v2.2.0 |
| **stm32-expert** | STM32 嵌入式固件审查：时钟、外设、DMA | v1.1.0 |

## Installation

```bash
# Install all skills
npx skills add WingedFin1251/skills

# Install specific skill
npx skills add WingedFin1251/skills --skill cpp-expert
npx skills add WingedFin1251/skills --skill arkts-expert
npx skills add WingedFin1251/skills --skill stm32-expert
```

## Skills Overview

### cpp-expert

C/C++ expert skill for code review, debugging, and optimization.

**Features:**
- 8-dimension rule system (memory safety, UB, RAII, concurrency, modern C++, style)
- Three-stage pipeline (pre-audit → micro logic → macro architecture)
- 8 Node.js pre-audit scripts (pin audit, control chain, stack depth, build audit, syscall audit, etc.)
- clang-tidy / cppcheck / AddressSanitizer integration
- Unified audit report JSON bus (unified-audit-report.json) as single source of truth
- Degradation mode when tools unavailable

### arkts-expert

ArkTS/HarmonyOS expert skill for application development.

**Features:**
- 10-dimension rule system (syntax, state management, UI, navigation, performance, side effects, migration, style, service layer, runtime structure)
- Two-stage pipeline (micro logic → macro architecture) with attention budget guide
- Two-phase reporting (diagnosis → planning) with single-doc default delivery
- Mandatory official-source verification gate before any report (platform claims cross-checked against the local harmonyos-docs snapshot or developer.huawei.com; unverified claims flagged "待官方确认")
- Role-based Stage 2 branching (UI component / service class / Worker concurrency)
- Service-layer audit flow (cross-method consistency matrix, upstream API contract verification)
- Fix coordination (v2.1): fix DSL (Preconditions/Postconditions/Side_Effects), Fix Dependency Graph (`depends on` / `conflicts with` / `alternative to`), dependency-topology batching, conflict resolution patterns
- Android → HarmonyOS migration mapping
- V1/V2 state management decorator guidance
- All content verified against official HarmonyOS docs (API 26 snapshot)
- Bash + PowerShell static analysis scripts

### stm32-expert

STM32 embedded systems expert skill.

**Features:**
- 8-dimension rule system (clock, peripherals, interrupts, DMA, FreeRTOS)
- HAL/LL library usage guidance
- Pin conflict detection
- Low-power mode optimization
- USB / CAN / HRTIM peripheral references (cross-validated against ST official training docs)

## Structure

```
skills/
├── cpp-expert/
│   ├── SKILL.md              # Skill entry point
│   ├── AGENTS.md             # Full rule reference
│   ├── references/           # Deep reference docs
│   ├── scripts/              # 10 automation scripts (JS + SH)
│   └── docs/                 # Design docs & version plans
├── arkts-expert/
│   ├── SKILL.md              # Skill entry point
│   ├── AGENTS.md             # 10-dimension rule reference
│   ├── references/           # 7 deep reference docs
│   └── scripts/              # Bash + PowerShell linters
└── stm32-expert/
    ├── SKILL.md              # Skill entry point
    ├── AGENTS.md             # 8-dimension rule reference
    ├── references/           # 6 peripheral reference docs
    ├── scripts/              # .ioc config checker
    └── docs/                 # STM32 training PDFs & datasheets
```

## Release Notes

### 2026-08-28

- **arkts-expert v2.2.0** — 官方来源核验门：任何报告产出前强制将全部平台断言与官方来源比对（本地 harmonyos-docs 快照优先）；未核验项标注"待官方确认"，与官方冲突项必须改正/撤回；新增否定断言检索证据纪律与用户前提核验（SKILL 第 9 步 + AGENTS.md §12 + 报告 `## Source Verification` 段）
- **arkts-expert v2.1.1** — 修复协调规范缺陷修正：诊断/规划默认单稿内分区交付（分两轮仅限用户要求或影响面大）；澄清"禁止代码块"= 禁止修复性代码（证据引用合法）；DSL 补 Evidence 字段；Side_Effects 强制结构化枚举；新增 depends-on 环检测与同 Target 重复方案核验规则
- **arkts-expert v2.1.0** — 修复协调三层约束：Fix Dependency Graph + 诊断/规划分离 + 修复 DSL；新增 `references/fix-planning.md`；AGENTS.md §11；报告改为两阶段产出
- **arkts-expert v2.0.0** — 维度升级 8→10：新增服务层一致性（§9）与平台运行时/结构安全（§10）；Stage 2 按文件角色分叉；新增 `references/service-layer.md` 服务层审查流
- **arkts-expert v1.0.1** — 对照 HarmonyOS 官方文档 API 26 快照逐条核验：V2 状态管理仅 API 12+；删除虚构规则名/API（arkts-no-implicit-return-types、@ohos.arkui 导入、uriOptions、nativeLibs 等）；修正装饰器语义与生命周期

### 2026-08-27

- **skills 仓库创建** — cpp-expert v1.6.1、arkts-expert v1.0.0、stm32-expert v1.1.0

## License

MIT