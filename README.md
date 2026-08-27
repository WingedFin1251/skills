# Skills Collection

**A collection of Claude Code skills for C/C++, ArkTS/HarmonyOS, and STM32 embedded development.**

## Available Skills

| Skill | Description | Version |
|-------|-------------|---------|
| **cpp-expert** | C/C++ 代码审查：内存安全、UB、并发、风格 | v1.6.1 |
| **arkts-expert** | ArkTS/HarmonyOS 代码审查：状态管理、UI、导航 | v1.0.0 |
| **stm32-expert** | STM32 嵌入式固件审查：时钟、外设、DMA | v1.0.0 |

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
- 10 pre-audit scripts (pin audit, control chain, stack depth, etc.)
- clang-tidy / cppcheck / AddressSanitizer integration

### arkts-expert

ArkTS/HarmonyOS expert skill for application development.

**Features:**
- 8-dimension rule system (syntax, state management, UI, navigation, performance)
- Two-stage pipeline (micro logic → macro architecture)
- Android → HarmonyOS migration mapping
- V1/V2 state management decorator guidance

### stm32-expert

STM32 embedded systems expert skill.

**Features:**
- 8-dimension rule system (clock, peripherals, interrupts, DMA, FreeRTOS)
- HAL/LL library usage guidance
- Pin conflict detection
- Low-power mode optimization

## Structure

```
skills/
├── cpp-expert/
│   ├── SKILL.md              # Skill entry point
│   ├── AGENTS.md             # Full rule reference
│   ├── references/           # Deep reference docs
│   └── scripts/              # Automation scripts
├── arkts-expert/
│   ├── SKILL.md
│   ├── AGENTS.md
│   ├── references/
│   └── scripts/
└── stm32-expert/
    ├── SKILL.md
    ├── AGENTS.md
    ├── references/
    └── scripts/
```

## License

MIT
