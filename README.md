# Skills Collection

**A collection of Claude Code skills for C/C++, ArkTS/HarmonyOS, and STM32 embedded development.**

## Available Skills

| Skill | Description | Version |
|-------|-------------|---------|
| **cpp-expert** | C/C++ 代码审查：内存安全、UB、并发、风格 | v1.6.1 |
| **arkts-expert** | ArkTS/HarmonyOS 代码审查：状态管理、UI、导航、服务层 | v2.0.0 |
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
- Role-based Stage 2 branching (UI component / service class / Worker concurrency)
- Service-layer audit flow (cross-method consistency matrix, upstream API contract verification)
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
│   ├── references/           # 6 deep reference docs
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

- **arkts-expert v2.0.0** — 维度升级 8→10：新增服务层一致性（§9）与平台运行时/结构安全（§10）；Stage 2 按文件角色分叉；新增 `references/service-layer.md` 服务层审查流
- **arkts-expert v1.0.1** — 对照 HarmonyOS 官方文档 API 26 快照逐条核验：V2 状态管理仅 API 12+；删除虚构规则名/API（arkts-no-implicit-return-types、@ohos.arkui 导入、uriOptions、nativeLibs 等）；修正装饰器语义与生命周期

### 2026-08-27

- **skills 仓库创建** — cpp-expert v1.6.1、arkts-expert v1.0.0、stm32-expert v1.1.0

## License

MIT