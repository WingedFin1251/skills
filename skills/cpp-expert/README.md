# cpp-expert

**可验证、可复现的 C/C++ 代码审查：精确率 100%，召回率 ≥85%（STM32 21 基准缺陷实测）。三阶段流水线（预审计脚本 → 微观逻辑扫描 → 宏观架构裁决）+ 8 维度优先级规则 + 工具辅助降维实现。集成 clang-tidy / cppcheck / AddressSanitizer / 8 个 Node.js 预扫描脚本。**

**Deterministic, verifiable C/C++ defect detection: 100% precision, ≥85% recall (21-bug STM32 benchmark). Three-stage pipeline (pre-audit scripts → micro-logic scan → macro-architecture verdict) + 8 priority-ranked rule dimensions + tool-assisted dimensionality reduction. Integrating clang-tidy / cppcheck / AddressSanitizer / 8 Node.js pre-audit scripts.**

> 灵感来自 [python-expert](https://skills.sh/)。不同于纯知识注入型技能，cpp-expert 通过确定性脚本产生可复现的审查结果——同一份代码每次运行输出一致，不依赖 AI 注意力的随机波动。
>
> Inspired by [python-expert](https://skills.sh/). Unlike pure knowledge-injection skills, cpp-expert produces reproducible results via deterministic pre-audit scripts — same code, same output every run, independent of AI attention variance.

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
npx skills add WingedFin1251/cpp-expert

# 方式二：手动复制到项目
# Option 2: Manually copy into your project
cp -r cpp-expert <your-project>/.agents/skills/
```

### 使用 / Usage
在 Claude Code 中，当你的问题涉及 C/C++ 代码时，技能会自动触发。你也可以直接要求：

In Claude Code, the skill triggers automatically when your question involves C/C++ code. You can also explicitly ask:

```
审查这段 C++ 代码的内存安全性
Review this C++ code for memory safety
帮我检查有没有未定义行为
Check if there's any undefined behavior
运行静态分析脚本检查这个文件
Run the static analysis script on this file
```

---

## 技能结构 / Skill Structure

```
cpp-expert/
├── SKILL.md                    # 入口：触发条件 + Rule 0 + 10步工作流
│                               # Entry: triggers + Rule 0 + 10-step workflow
├── AGENTS.md                   # 完整规则参考：8维度(含v1.1新增) × ❌/✅ 示例
│                               # Full rule reference: 8 dimensions (incl. v1.1) × ❌/✅ examples
├── references/
│   ├── memory-safety.md        # 智能指针指南 + 泄漏/溢出/UAF 检查清单
│   │                           # Smart pointer guide + leak/overflow/UAF checklists
│   ├── compiler-errors.md      # 常见编译错误速查 + 段错误排查
│   │                           # Common compile errors quick ref + segfault debugging
│   └── cpp-modern.md           # C++11→C++23 特性对照表 + Concepts/Ranges/Coroutines/span/format 深度审查
│                               # C++11→C++23 feature matrix + deep-dive: Concepts, Ranges, Coroutines, span, format
└── scripts/
    ├── run-static-analysis.sh  # clang-tidy + cppcheck 自动化
    │                           # clang-tidy + cppcheck automation
    ├── run-sanitizers.sh       # AddressSanitizer + UBSan 运行
    │                           # AddressSanitizer + UBSan runner
    ├── run-preaudit.js         # v1.4 预扫描调度器 (引脚/控制链/栈深度)
    │                           # v1.4 pre-audit orchestrator
    ├── pin_audit.js            # GPIO 引脚冲突矩阵扫描
    │                           # GPIO pin conflict scanner
    ├── ctrl_chain_check.js     # 控制链调用图分析 (支持 RTOS)
    │                           # Control chain call graph (RTOS-aware)
    ├── stack_depth_audit.js    # ISR 栈深度估算 (Cortex-M aware)
    │                           # ISR stack depth estimator
    └── style_audit.js          # v1.5 风格审计 (哨兵/EXTI 文件/全局变量)
                                # v1.5 style auditor (sentinel/EXTI/globals)
```

---

## 规则体系 / Rule System

8 个检查维度按优先级排列 / Eight review dimensions ordered by priority:

| 优先级 / Priority | 维度 / Dimension | 关键检查项 / Key Checks |
| :---------------- | :--------------- | :---------------------- |
| 🔴 **CRITICAL** | 内存安全 / Memory Safety | 智能指针 vs 裸指针、悬空引用、缓冲区溢出、内存泄漏、UAF / Smart vs raw pointers, dangling refs, buffer overflow, leaks, UAF |
| 🔴 **CRITICAL** | UB & 编译 / UB & Compilation | 整数溢出、未初始化变量、strict aliasing、虚析构、ODR / Integer overflow, uninit vars, strict aliasing, virtual dtor, ODR |
| 🔴 **CRITICAL** | 借用生命周期 / Borrowed Lifetimes (v1.1) | 返回内部指针的隐式生命周期绑定、std::span 替代裸指针 / Implicit lifetime contracts, std::span over raw ptrs |
| 🔴 **CRITICAL** | C ABI 边界 / C ABI Contexts (v1.1) | 非标准布局类型过 extern "C"、is_standard_layout 检查 / Non-standard-layout across extern "C" |
| 🟠 **HIGH** | RAII & 资源 / RAII & Resources | Rule of Five、异常安全、vector vs 数组、OS 资源封装 / Rule of Five, exception safety, vector vs arrays, OS resource wrappers |
| 🟠 **HIGH** | 并发安全 / Concurrency Safety | 数据竞争、锁顺序、死锁、atomic、条件变量 / Data races, lock ordering, deadlock, atomic, condition variables |
| 🟡 **MEDIUM** | 现代 C++ / Modern C++ | `auto`、`constexpr`、`nullptr`、`override`、`enum class`、`[[nodiscard]]` |
| 🟡 **MEDIUM** | 代码风格 / Code Style | 命名规范、头文件组织、include 顺序、const 正确性 / Naming, header organization, include order, const correctness |

### Rule 0：语言识别（元规则） / Rule 0: Language Identification (Meta-Rule)
自动识别 C 还是 C++ 代码，根据扩展名、关键语法和标准库。如果是纯 C 代码，跳过"现代 C++"维度并调整内存安全建议。

Automatically identifies whether the code is C or C++ based on file extension, key syntax constructs, and standard libraries. For pure C code, the "Modern C++" dimension is skipped and memory safety advice is adjusted accordingly.

---

## 工作流程 / Workflow

当技能触发时，AI 依次执行三阶段流水线 / When the skill triggers, the AI executes in a three-stage pipeline:

```
╔═══════════════════════════════════════════╗
║  Stage 0: 工具预处理 / Tool Preprocessing ║  0% AI 预算
║  node scripts/run-preaudit.js             ║  → unified-audit-report.json
╚═══════════════════════════════════════════╝
                      ↓
╔═══════════════════════════════════════════╗
║  Stage 1: 微观逻辑扫描 / Micro Logic Scan ║  70% AI 预算
║  1. 语言检测 → 2. C 语义陷阱              ║
║  3. 编译验证 → 4. 内存安全 → 5. UB/编译   ║
╚═══════════════════════════════════════════╝
                      ↓
╔═══════════════════════════════════════════╗
║  Stage 2: 宏观架构裁决 / Architecture Verdict  ║  30% AI 预算
║  读取 unified-audit-report.json            ║
║  6. 预审计报告 → 7. 路径追踪               ║
║  8. RAII → 9. 并发 → 10. 现代 C++         ║
║  11. 风格 → 12. 工具 → 13. 生成报告        ║
╚═══════════════════════════════════════════╝
```

---

## 工具脚本 / Tool Scripts

### `run-static-analysis.sh`
对指定 C/C++ 源文件运行 clang-tidy + cppcheck / Runs clang-tidy + cppcheck on the specified C/C++ source file.

```bash
bash scripts/run-static-analysis.sh src/main.cpp
```

自动探测 `compile_commands.json`（CMake 生成的编译数据库），缺失时降级运行并给出警告。

Automatically probes for `compile_commands.json` (the compilation database generated by CMake), falling back to a degraded run with a warning when it's missing.

### `run-sanitizers.sh`
使用 AddressSanitizer + UndefinedBehaviorSanitizer 编译并运行 / Compiles and runs with AddressSanitizer + UndefinedBehaviorSanitizer.

```bash
bash scripts/run-sanitizers.sh src/main.cpp
```

自动识别 C 还是 C++（根据扩展名），自动切换 `gcc`/`g++` 和对应的 `-std=` 标准。

Automatically detects C vs C++ (by file extension) and switches between `gcc`/`g++` and the corresponding `-std=` standard.

> ⚠️ **安全警告 / Security Warning**：该脚本会编译并执行用户提供的代码。请在沙盒或容器中运行不可信的代码。
>
> This script compiles and executes user-provided code. Run untrusted code in a sandbox or container.

---

## 代码审查输出格式 / Review Output Format

审查结果按优先级分三区，附工具输出 / Results are organized into three priority tiers with tool output appended:

```
## Summary
- 代码总体评价 / Overall assessment of the code

## Critical Issues 🔴
- 内存安全 / UB 问题（需立即修复）
- Memory safety / UB issues (fix immediately)

## High Priority 🟠
- RAII / 并发问题（需合并前修复）
- RAII / concurrency issues (fix before merge)

## Medium Priority 🟡
- 现代 C++ / 风格建议（可选修复）
- Modern C++ / style suggestions (optional fix)

## Tool Results
- Syntax Check (g++ -fsyntax-only)
- Static Analysis (clang-tidy + cppcheck)
- Sanitizer (ASan/UBSan) — if run

## Issue Count + Recommendation
```


## 参考链接 / References
- [cppreference.com](https://en.cppreference.com/) 
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/) 
- [SEI CERT C++ Coding Standard](https://wiki.sei.cmu.edu/confluence/pages/viewpage.action?pageId=88046682) 
- [Clang-Tidy Docs](https://clang.llvm.org/extra/clang-tidy/) 
- [Cppcheck Manual](https://cppcheck.sourceforge.io/manual.pdf) 
- [AddressSanitizer](https://clang.llvm.org/docs/AddressSanitizer.html) 
- [Claude Code Skills 文档 / Claude Code Skills Docs](https://docs.anthropic.com/en/docs/claude-code/skills) 
- [skills.sh 技能市场 / skills.sh Marketplace](https://skills.sh/) 

### `run-preaudit.js` (v1.4)
一键运行全部三个预扫描模块，输出统一审计报告 / Runs all three pre-audit modules, outputs a unified JSON report.

```bash
node scripts/run-preaudit.js --include-dir Src/
# → writes unified-audit-report.json
```

**Degradation mode:** 无 Node.js 环境时 AI 降级为人工引导模式。

**JSON 报告字段：**
| 字段 | 来源 | 用途 |
|------|------|------|
| `pin_conflicts` | pin_audit.js | GPIO 引脚冲突 → 🔴 CRITICAL |
| `control_chain_breaks` | ctrl_chain_check.js | 控制链开环 → 🟠 HIGH |
| `stack_overflow_risks` | stack_depth_audit.js | ISR 栈深度 → 🟠 HIGH/🟡 MEDIUM |

### 版本历史 / Version History
- **v1.6.1** — StdPeriph/CMSIS 检测、构建系统识别、`--project-type` 覆盖、`--exclude` 环境变量传递 / StdPeriph/CMSIS detection, build system ID, `--project-type` override, `--exclude` env-passing
- **v1.6** — 全场景 C/C++ 审计平台：项目类型自动路由 + 3 新脚本（build/syscall/api_style），27 轮审查 70+ Bug 修复 / Full-scope C/C++ audit platform: project type routing + 3 new scripts, 27 review rounds, 70+ bug fixes
- **v1.5** — 魔数规则 + static 强制 + style_audit.js（哨兵/EXTI 文件/全局变量），7 轮审查零漏报打靶 / Magic number rule + static enforcement + style_audit.js, 7 review rounds, zero false positives
- **v1.4** — 工具辅助降维：4 Node.js 预扫描脚本（引脚冲突/控制链/栈深度）、三阶段流水线、JSON 总线报告 / Tool-assisted dimensionality reduction: 4 pre-audit scripts, three-stage pipeline, JSON bus report
- **v1.3** — 双阶段审查工作流、C 语义陷阱规则（传值/volatile/数组越界）、修复 §4.5 位置 / Two-stage review workflow, C semantics trap rules, fix §4.5 position
- **v1.2** — 执行路径追踪（死代码降级）、架构原子性白名单（Cortex-M4 32位对齐）、控制算法连续性审查、报告模板要求 Call Path / Execution path tracing, Cortex-M atomicity whitelist, control algorithm continuity, call-path in reports
- **v1.1** — 新增 Borrowed Lifetimes 和 C ABI 规则、C++20/23 深度参考（Concepts/Ranges/Coroutines/span/format）、触发词扩展、Review Checklist / Added borrowed lifetimes & C ABI rules, C++20/23 deep reference, trigger expansion, review checklist
- **v1.0** — 初始版本：8维度规则体系、3 参考文件、2 工具脚本 / Initial release: 8-dimension rule system, 3 reference files, 2 tool scripts

---

## 许可 / License

MIT

---
