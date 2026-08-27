# stm32-expert

**STM32 嵌入式开发审查技能 — 基于 8 维度优先级规则的 STM32 HAL/LL 代码与配置审查，集成 CubeMX .ioc 检查工具，覆盖 USB/CAN/HRTIM 外设。**

**An STM32 embedded development review skill — automated quality checks based on 8 priority-ranked rule dimensions for STM32 HAL/LL code, configuration, USB/CAN/HRTIM peripherals, integrating CubeMX .ioc validation.**

> 仿照 [cpp-expert](https://github.com/WingedFin1251/cpp-expert) 的 8 维模型设计，专为 STM32 微控制器的时钟配置、外设驱动、中断/NVIC、DMA、FreeRTOS、引脚冲突、低功耗模式和项目结构审查而构建。
>
> Modeled after [cpp-expert](https://github.com/WingedFin1251/cpp-expert)'s 8-dimension model, purpose-built for STM32 microcontroller clock config, peripheral drivers (GPIO/UART/SPI/I2C/ADC/TIM), interrupt/NVIC, DMA, FreeRTOS, pin conflicts, low-power modes, and project structure review.

---

## 目录 / Table of Contents
- [快速开始 / Quick Start](#快速开始--quick-start)
- [技能结构 / Skill Structure](#技能结构--skill-structure)
- [规则体系 / Rule System](#规则体系--rule-system)
- [工作流程 / Workflow](#工作流程--workflow)
- [工具脚本 / Tool Scripts](#工具脚本--tool-scripts)
- [芯片支持 / Supported Series](#芯片支持--supported-series)
- [参考链接 / References](#参考链接--references)
- [许可 / License](#许可--license)

---

## 快速开始 / Quick Start

### 安装 / Installation
```bash
# 手动复制到项目
# Manually copy into your project
cp -r stm32-expert <your-project>/.agents/skills/
```

### 使用 / Usage
在 Claude Code 中，当代码涉及 STM32 嵌入式开发时，技能会自动触发。你也可以直接要求：

In Claude Code, the skill triggers automatically when working with STM32 embedded code. You can also explicitly ask:

```
审查这个 STM32 项目的时钟配置
Review the clock configuration of this STM32 project
检查 USART 初始化是否有遗漏
Check if the USART initialization is missing anything
帮我检查 FreeRTOS 任务同步是否正确
Verify the FreeRTOS task synchronization
运行 .ioc 配置冲突检查
Run the .ioc configuration conflict check
```

---

## 技能结构 / Skill Structure

```
stm32-expert/
├── SKILL.md                    # 入口：触发条件 + Rule 0 + 10步工作流
│                               # Entry: triggers + Rule 0 + 10-step workflow
├── AGENTS.md                   # 完整规则参考：8维度 × ❌/✅ 示例 + 审查报告模板
│                               # Full rule reference: 8 dimensions × ❌/✅ examples + review template
├── references/
│   ├── clock-config.md         # PLL 参数计算表、各系列最大频率、等待周期、RCC 序列
│   │                           # PLL calculation tables, max frequencies, wait states, RCC sequence
│   ├── peripheral-common.md    # GPIO/UART/SPI/I2C/ADC/TIM HAL 函数速查 + 常见错误
│   │                           # HAL quick reference + common mistakes for GPIO/UART/SPI/I2C/ADC/TIM
│   ├── usb.md                  # USB 设备外设参考：事务模型、挂起/唤醒、HAL 序列
│   │                           # USB device reference: transaction model, suspend/resume, HAL sequence
│   ├── can.md                  # CAN 2.0 A/B 参考：位时序公式、滤波器配置、模式
│   │                           # CAN 2.0 A/B reference: bit timing formula, filter config, modes
│   ├── hrtim.md                # 高精度定时器 (HRTIM)：校准、周期计算、输出配置
│   │                           # High-resolution timer: DLL calibration, period calculation, output config
│   └── freertos.md             # FreeRTOS 配置表、ISR 安全 API 列表、任务栈评估
│                               # FreeRTOS config table, ISR-safe API list, stack estimation
└── scripts/
    └── check-ioc-config.sh     # CubeMX .ioc 引脚冲突 / 时钟超限 / 调试引脚检查
                                # Pin conflict, clock over-limit, and SWD debug pin checker
```

---

## 规则体系 / Rule System

8 个检查维度按优先级排列 / Eight review dimensions ordered by priority:

| 优先级 / Priority | 维度 / Dimension | 关键检查项 / Key Checks |
| :---------------- | :--------------- | :---------------------- |
| 🔴 **CRITICAL** | 时钟与系统配置 / Clock & System | PLL 倍频计算、Flash 等待周期、RCC 顺序、HSI/HSE |
| 🔴 **CRITICAL** | 外设初始化 / Peripheral Init | GPIO/UART/SPI/I2C/ADC/TIM、USB/CAN/HRTIM 配置 |
| 🟠 **HIGH** | 中断与 NVIC / Interrupt & NVIC | 优先级分组、IRQ 处理函数命名、临界区保护 |
| 🟠 **HIGH** | DMA 配置 / DMA Config | 方向/数据宽度一致、循环模式、中断触发、多路优先级 |
| 🟠 **HIGH** | FreeRTOS 同步 / FreeRTOS Sync | 任务栈评估、FromISR API、互斥量 vs 信号量 |
| 🟠 **HIGH** | 引脚冲突与复用 / Pin Conflicts | AF 编号映射、SWD 调试引脚占用、封装验证 |
| 🟡 **MEDIUM** | 低功耗模式 / Low-Power | Sleep/Stop/Standby、唤醒源、退出后时钟恢复 |
| 🟡 **MEDIUM** | 代码规范 / Code Style | CubeMX 项目结构、Error_Handler 实现、HAL_Delay 代替裸循环 |

### Rule 0：芯片系列识别（元规则） / Rule 0: Series Identification (Meta-Rule)
自动识别 STM32 系列（F1/F4 vs G0/G4 vs H7），根据 HAL 头文件和启动文件。不同系列适配不同检查规则。

Automatically identifies the STM32 series (F1/F4 vs G0/G4 vs H7) based on HAL headers and startup files, adapting review rules per series.

---

## 工作流程 / Workflow

当技能触发时，AI 依次执行 / When the skill triggers, the AI executes in sequence:

```
1.  芯片系列识别 / Series Detection (Rule 0)
     → 2. 时钟系统审查 / Clock Review (🔴)
3.  外设初始化审查 / Peripheral Init Review (🔴)
     → 4. 中断/NVIC 审查 / Interrupt & NVIC Review (🟠)
5.  DMA 配置审查 / DMA Config Review (🟠)
     → 6. FreeRTOS 同步审查 / FreeRTOS Sync Review (🟠)
7.  引脚冲突审查 / Pin Conflict Review (🟠)
     → 8. 低功耗审查 / Low-Power Review (🟡)
9.  代码规范审查 / Code Style Review (🟡)
     → 10. 运行脚本 + 生成报告 / Run scripts + generate report
```

---

## 工具脚本 / Tool Scripts

### `check-ioc-config.sh`
检查 CubeMX `.ioc` 配置文件的常见问题 / Checks CubeMX `.ioc` config files for common issues.

```bash
bash scripts/check-ioc-config.sh project.ioc
```

检查项 / Checks for:
- **引脚冲突** — 同一引脚被多个外设使用 / Pin used by multiple peripherals
- **时钟超限** — PLL 输出超过芯片最大频率 / PLL output exceeds maximum frequency
- **调试引脚占用** — PA13/PA14 被配置为 GPIO / SWD debug pins reassigned to GPIO

---

## 芯片支持 / Supported Series

| 系列 | 内核 | HAL 头文件 | 最大频率 | 特殊关注点 |
|------|------|-----------|---------|-----------|
| STM32F1 | Cortex-M3 | `stm32f1xx_hal.h` | 72 MHz | SPL 共存、标准外设库混用 |
| STM32F4 | Cortex-M4F | `stm32f4xx_hal.h` | 168 MHz | 单精度 FPU、VCO 上限 432MHz |
| STM32G0 | Cortex-M0+ | `stm32g0xx_hal.h` | 64 MHz | 低功耗、无 FPU |
| STM32G4 | Cortex-M4F | `stm32g4xx_hal.h` | 170 MHz | HRTIM、运放、USB PD |
| STM32H7 | Cortex-M7 | `stm32h7xx_hal.h` | 480 MHz | 双精度 FPU、Cache/MPU、VCO 800MHz |

---

## 代码审查输出格式 / Review Output Format

审查结果按优先级分三区，附工具输出 / Results are organized into three priority tiers with tool output appended:

```
## Summary
- 综合评估 / Overall assessment

## Critical Issues 🔴
- 时钟/外设配置错误（需立即修复）
- Clock/peripheral config errors (fix immediately)

## High Priority 🟠
- 中断/DMA/FreeRTOS/引脚问题（需合并前修复）
- Interrupt/DMA/FreeRTOS/pin issues (fix before merge)

## Medium Priority 🟡
- 低功耗/代码规范建议（可选修复）
- Low-power/style suggestions (optional fix)

## Tool Results
- .ioc Config Check (check-ioc-config.sh)

## Issue Count + Recommendation
```

### 版本历史 / Version History
- **v1.1** — 新增 USB/CAN/HRTIM 外设参考（基于 ST 官方培训文档交叉验证） / Added USB/CAN/HRTIM peripheral references (cross-validated against ST official training docs)
- **v1.0** — 初始版本：8 维度规则体系、3 参考文件、1 脚本 / Initial release: 8-dimension rule system, 3 reference files, 1 script

---

## 参考链接 / References
- [STM32Cube HAL Documentation](https://www.st.com/en/embedded-software/stm32cube-mcu-packages.html)
- [STM32 Reference Manuals](https://www.st.com/en/microcontrollers-microprocessors/stm32f4-series.html#documentation)
- [FreeRTOS Coding Standard](https://www.freertos.org/FreeRTOS-coding-standard.html)
- [cpp-expert (sister skill)](https://github.com/WingedFin1251/cpp-expert)

---

## 许可 / License

MIT
