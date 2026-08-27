# cpp-expert 变更日志

## [1.6.1] — 2026-07-14

### 新增
- 项目类型检测扩展：支持 StdPeriph 库（FWLIB/CORE）、CMSIS core_cm4.h、Keil 经典结构
- 构建系统检测：CMake/Makefile/Keil/IAR 自动识别，输出到 report.meta.build_system
- 新增 `--project-type embedded|app` 手动覆盖参数
- 新增 `meta.skipped_modules` 动态数组，AI 可读取被跳过的审计模块
- 新增 `meta.build_info` 字段，包含构建系统详细信息
- `--exclude` 参数通过 `PREAUDIT_EXCLUDE_DIRS` 环境变量传递至子脚本
- SKILL.md/AGENTS.md：新增构建系统与审计范围报告区块
- AGENTS.md：新增 Skipped Module Rules（跳过不等于通过）

### 修复
- 修复 `build_audit` 日志显示跳过但实际仍执行的问题
- 修复 `skipped_modules` 硬编码为动态数组
- 修复 `--project-type` 参数吞噬下一个参数的问题
- 修复 FWLIB/CORE 目录大小写敏感（Linux/macOS 兼容）
- 修复 Keil/IAR 非 CMake 项目孤儿文件误报

### 改进
- 控制台日志：输出项目类型、构建系统、跳过的模块

## [1.6.0] — 2026-07-14

### 架构升级
- 项目类型自动路由（嵌入式 vs 应用层），run-preaudit.js 根据 Drivers/CMakeLists 自动切换脚本集
- 全场景覆盖：从"嵌入式专用"升级为"全场景 C/C++ 审计平台"

### 新增（3 个脚本）
- scripts/build_audit.js：CMake 构建系统审计（B30 孤儿文件检测），支持变量展开、list(APPEND)、aux_source_directory
- scripts/syscall_audit.js：POSIX 系统调用审计（B31-B33, B36-B37），涵盖 fwrite/putenv/fork/dlopen 等
- scripts/api_style_audit.js：跨文件 API 一致性审计（B34 宏参数不一致/b35 废弃 API）
- AGENTS.md：新增 build_orphans/syscall_issues/api_mismatches 消费规则表
- SKILL.md Bundled Resources：列出全部 8 个脚本

### 修复（27 轮审查，70+ Bug）
- 修复 collectFiles 递归参数失效导致子目录漏扫
- 修复 CMake 变量展开（嵌套 `${}`、list(APPEND)、跨文件继承）
- 修复 CMake 字符串内 `#` 和 `)` 干扰注释剥离
- 修复 aux_source_directory 变量展开和引号路径
- 修复 stripped 变量作用域崩溃（ReferenceError）
- 修复 B31 hasAssignment 括号配平回归，改用赋值正则
- 修复 B31 控制流上下文污染（if 块外误判）
- 修复 B32 WNOHANG 跨多行漏报
- 修复 B33 const_cast 独立分支误报非 putenv 场景
- 修复 B37 SIGCHLD 精确匹配 + sigaction + 批量收割豁免
- 修复 B34 宏定义行跳过（含空格 `#    define`、函数指针、跨行 `(*`）
- 修复 B35 废弃 API 排除 C++`.`/`->`/`::` 前缀和跨行宏定义
- 修复 Windows 路径大小写敏感（toLowerCase）
- 修复 run-preaudit.js 去重、arg 校验、状态硬编码
- 修复 api_style_audit.js 单引号正则结束符、空参宏、嵌套括号
- 27 轮审查累计修复 70+ 个逻辑漏洞

## [1.5.0] — 2026-07-13

### 新增
- 规则路线：AGENTS.md §5.7 魔数检测（B18）
- 规则路线：AGENTS.md §6.1.1 文件作用域 static 强制（B15）
- 脚本路线：scripts/style_audit.js（B16 哨兵赋值 / B17 EXTI 文件归属 / B15 全局变量）
- AGENTS.md JSON 使用规则：新增 style_issues 字段消费映射表
- AGENTS.md TOC：新增 6.1.1 和 Attention Budget Guide 条目

### 修复（style_audit.js 经 7 轮审查）
- 修复块注释跨行导致行号错位（保留换行符剥离）
- 修复 braceDepth 被字符串/宏干扰（改用剥离后计数）
- 修复 EXTI 正则误报 IRQHandler（精确匹配 Init 函数）
- 修复 EXTI 正则不支持 EXTI9_5_IRQn 和跨行调用
- 修复 NVIC 正则误报 SysTick（限定 EXTI*_IRQn）
- 修复 B16 哨兵缺上下文过滤（±10 行+sort 关键词）
- 修复 B15 检测使用 rawLine 导致注释误报（改用 cleanLine）
- 修复 B15 正则缺 `[` 导致数组漏报（char buf[256]）
- 修复 B15 正则缺 `*` 导致指针漏报（char* buf）
- 修复 B15 正则缺 const/volatile/unsigned 前缀
- 修复 B15 正则缺逗号导致 int i,j,k 漏报（多变量提取）
- 修复 B15 类型列表缺 u8/u16/u32/bool
- 修复 Windows 目录名大小写敏感（toLowerCase）

## [1.4.0] — 2026-07-13

### 新增
- 架构：三阶段流水线（Stage 0 预处理 → Stage 1 微观 → Stage 2 宏观）
- scripts/pin_audit.js：GPIO 引脚冲突矩阵扫描（支持 HAL `GPIO_PIN_X` 和 SPL `GPIO_Pin_X`）
- scripts/ctrl_chain_check.js：控制链调用图分析（支持 ISR + FreeRTOS xTaskCreate 入口检测，函数指针逃逸检测）
- scripts/stack_depth_audit.js：ISR 栈深度估算（支持 Cortex-M 嵌套中断乘数）
- scripts/run-preaudit.js：统一调度器，输出 unified-audit-report.json（93% Token 缩减）
- AGENTS.md §1.2：统一审计报告使用规则（JSON 字段→报告动作映射表）
- SKILL.md：降级模式（Node.js 不可用时自动转人工引导）
- AGENTS.md 目录：新增 Attention Budget Guide 和 §5.7 C Semantics 条目
- SKILL.md Bundled Resources：列出 4 个新 Node.js 脚本
- SKILL.md 触发词：追加 GPIO、ISR、RTOS、FreeRTOS、pre-audit 等关键词

### 修复
- 修复 pin_audit.js 端口提取顺序错误（结构体名→向下匹配 GPIO_Init 调用）
- 修复 pin_audit.js `GPIO_PIN_9` vs `GPIO_Pin_9` 大小写兼容
- 修复 pin_audit.js `.Pin` vs `.GPIO_Pin` 双字段名支持
- 修复 ctrl_chain_check.js RTOS 任务入口漏报（xTaskCreate 参数提取）
- 修复 ctrl_chain_check.js `(?:[\w\s\*]*?)` 允许零前缀函数修饰符
- 修复 ctrl_chain_check.js `==` 误判为函数指针赋值
- 修复 ctrl_chain_check.js 函数指针参数传递检测（`HAL_RegisterCallback(&fn)`）
- 修复 stack_depth_audit.js uint32_t 双重计数（合并 typeMap）
- 修复 stack_depth_audit.js `_IRQn` 枚举误匹配
- 修复 run-preaudit.js 多目录忽略（`--include-dir A --include-dir B`）
- 修复 run-preaudit.js `Promise.all`→顺序执行（设计一致性）
- 修复 run-preaudit.js execFile(process.execPath) 跨平台调用
- 修复三大脚本注释/字符串中 `}` 干扰大括号计数
- 修复 SKILL.md 重复编号 7.
- 修复 SKILL.md 降级模式硬编码 line 42
- 修复 AGENTS.md 目录缺失条目
- 修复 AGENTS.md 缺少 JSON 使用规则

## [1.3.0] — 2026-07-09

### 新增
- SKILL.md §0：双阶段审查工作流（Stage 1 微观逻辑扫描 → Stage 2 宏观架构扫描）
- AGENTS.md §5.7：基础 C 语义与编译器陷阱 — 传值/volatile/数组越界/变量遮蔽
- SKILL.md QuickRef 表：新增 Stage 列，每行标注所属阶段

### 修复
- 修复 §4.5 被错误插入到 §6 之后的问题（移至 §4.4 后正确位置）
- 修复 SKILL.md 引用 §5.4→§5.7（v1.3 改号）
- 修复 QuickRef 表 Stage/Priority 列错位

## [1.2.0] — 2026-07-09

### 新增
- SKILL.md §1.5：执行路径追踪 — 先扫描 main() 建立调用图，死代码降级为 🟡 MEDIUM
- AGENTS.md §2.7：控制算法连续性规则 — 三角函数分段边界误报预防
- AGENTS.md §4.5：架构原子性白名单 — Cortex-M3/M4/M7 32位对齐单拷贝原子说明
- AGENTS.md 报告模板：新增 Call path 字段 — 🔴/🟠 级问题必须注明调用路径

### 修复
- 修复潜伏代码被误报为 🔴 CRITICAL 的问题（未被调用的函数中的配置冲突）
- 修复 float 跨中断变量被误报为 🔴 CRITICAL 的问题（M4 硬件原子性）
- 修复 SVPWM 扇区边界被误报为 discontinuity 的问题（数学连续性验证）

## [1.1.0] — 2026-07-09

### 新增
- SKILL.md：补全触发词列表（valgrind, concept, rvalue, move semantics, C++23, 等 20+ 关键词）
- AGENTS.md §1.5：新增 Borrowed Lifetimes 子规则（检测返回裸指针的生命周期隐式绑定）
- AGENTS.md §2.6：新增 C ABI Contexts 子规则（检测非标准布局类型过 extern "C" 边界）
- references/cpp-modern.md：从 33 行扩展至 175 行，新增 5 个 C++20/23 深度审查章节
  - Concepts：requires 误用、约束满足性 SFINAE 交互
  - Ranges & Views：view dangling、惰性求值陷阱、borrowed range
  - Coroutines：promise 对象泄漏、co_await 生命周期
  - std::span：悬垂 span、size 不匹配
  - std::format：编译时类型安全格式化
- 增加 Review Checklist 章节

### 修复
- 修复 AGENTS.md §1.5 示例中 `data` 越域访问问题
- 修复 references/cpp-modern.md §std::format 示例放在全局作用域的编译错误

## [1.0.0] — 2026-07-09

### 新增
- SKILL.md：技能入口，含 Rule 0 语言识别元规则 + 10 步工作流
- AGENTS.md：6 维度 × 28 条规则的完整参考（🔴内存安全/UB → 🟠RAII/并发 → 🟡现代C++/风格）
- references/memory-safety.md：智能指针选择指南 + 泄漏/溢出/UAF 检查清单
- references/compiler-errors.md：常见编译错误速查 + 段错误排查流程
- references/cpp-modern.md：C++11/14/17/20 特性对照表 + C++98→C++17 迁移路径
- scripts/run-static-analysis.sh：clang-tidy + cppcheck 自动化（含 compile_commands.json 探测）
- scripts/run-sanitizers.sh：AddressSanitizer + UBSan 运行器（自动识别 C/C++）

### 修复（审查后）
- 修复 AGENTS.md §2.5 `cleanup()` 前向声明缺失导致的编译错误
- 修复 AGENTS.md §3.1 `size_t` 缺少 `<cstddef>` 头文件
- 修复 AGENTS.md §1.4 C 代码示例缺少 `#include <stdlib.h>`
- 修复 run-sanitizers.sh 编译失败时无友好提示（添加 `if ! ... exit 1`）
- 修复 SKILL.md 中 `gcc/g++` 命令歧义（分开描述）
- 修复 AGENTS.md §4.3 函数返回类型错误（`void` → `shared_ptr`）
- 修复 AGENTS.md §6.5 缺少 ❌/✅ 格式（改用代码块对比）
