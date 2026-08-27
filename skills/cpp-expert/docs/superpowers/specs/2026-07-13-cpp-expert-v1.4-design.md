# cpp-expert v1.4 Design Document — Tool-Assisted Dimensionality Reduction

**Date:** 2026-07-13
**Based on:** F1 analysis across 4 test rounds (best: P=100%, R=71%, F1=0.83)
**Core problem:** Attention zero-sum game between micro-logic depth and macro-architecture breadth in fixed context window

## Architecture: Three-Stage Pipeline

```
Stage 0 (0% AI budget):  run-preaudit.js
  ├─ pin_audit.js          → pin_conflicts[]
  ├─ ctrl_chain_check.js   → control_chain_breaks[]
  └─ stack_depth_audit.js  → stack_overflow_risks[]
  ↓
  unified-audit-report.json  (single source of truth)
  ↓
Stage 1 (70% AI budget):  Micro-logic scan (unchanged from v1.3)
  └─ function-level: pass-by-value, overflow, volatile, UB, array bounds
  ↓
Stage 2 (30% AI budget):  Macro-architecture verdict
  └─ read ONLY unified-audit-report.json + Stage 1 findings
  └─ DO NOT re-read raw GPIO/ISR/DMA init code
```

## JSON Schema

```json
{
  "meta": {
    "tool_version": "1.4.0",
    "scan_time_ms": 120,
    "excluded_dirs": ["Drivers/", "Middlewares/", ".git/", "node_modules/"]
  },
  "pin_conflicts": [
    {
      "pin": "PE9",
      "severity": "CRITICAL",
      "reason": "Multiple AF configurations",
      "occurrences": [
        {"file": "Src/pwm.c", "line": 42, "config": "AF1_TIM1_CH1"},
        {"file": "Src/fsmc.c", "line": 88, "config": "AF12_FSMC_A22"}
      ]
    }
  ],
  "control_chain_breaks": [
    {
      "function": "SOGI_PLL_Calc",
      "severity": "HIGH",
      "reason": "Defined but never called from any ISR or RTOS task",
      "definition": {"file": "Src/pll.c", "line": 45}
    }
  ],
  "stack_overflow_risks": [
    {
      "context": "TIM1_UP_IRQHandler (20kHz)",
      "severity": "HIGH",
      "estimated_depth_bytes": 512,
      "reason": "Contains arm_sin_f32 and large local arrays",
      "file": "Src/motor_control.c",
      "line": 120
    }
  ]
}
```

## File Structure Changes

```
scripts/
├── run-preaudit.js           # Scheduler: orchestrates all 3 modules
├── pin_audit.js              # GPIO pin conflict matrix
├── ctrl_chain_check.js       # Control chain call graph
└── stack_depth_audit.js      # ISR stack depth estimator
```

## Script Specifications

### `pin_audit.js`
- Regex: `GPIO_PinAFConfig\((\w+), (\w+), (\w+)\)` → port/pin/AF
- Regex: `GPIO_Init.*\.GPIO_Pin\s*=\s*([^;]+)` → pin macro combinations
- Logic: index by (Port, PinNumber), flag duplicate init or conflicting AF
- Platform: Node.js (Windows/Mac/Linux compatible)

### `ctrl_chain_check.js`
- Roots: `_IRQHandler\b`, `xTaskCreate\b` → ISR/RTOS entry points
- Consumers: `function\s+\w*(PLL|PID|Observer|FOC|Calc)\w*`
- Logic: search root function bodies for consumer names; flag unreachable
- Platform: Node.js

### `stack_depth_audit.js`
- For each `*_IRQHandler`: recursively collect called functions
- Estimate: `float var[N]` → N*4 bytes; `int` → 4 bytes; function call → 8 bytes (return addr + frame)
- Threshold: >512 bytes → HIGH, >256 bytes → MEDIUM
- Platform: Node.js
- **Function pointer escape detection**: If a consumer function (PLL/PID/etc.) is not called directly but appears on the RHS of an assignment (`ptr = SOGI_PLL_Calc`), downgrade from HIGH to WARNING

### `stack_depth_audit.js`
- For each `*_IRQHandler`: recursively collect called functions
- Estimate: `float var[N]` → N*4 bytes; `int` → 4 bytes; function call → 8 bytes (return addr + frame)
- Threshold: >512 bytes → HIGH, >256 bytes → MEDIUM
- **Nesting multiplier**: if ISR body contains `NVIC_SetPendingIRQ` or `__enable_irq()`, multiply estimated depth ×1.5 and annotate `[NESTING_RISK]`
- Platform: Node.js

### `run-preaudit.js`
- Invokes all 3 modules sequentially via `execFile(process.execPath, [scriptPath])`
- Uses `process.execPath` to locate Node.js binary (cross-platform, bypasses PATH)
- Uses `execFile` (no shell) to avoid `cmd`/`bash` parsing differences on Windows
- Excludes `Drivers/`, `Middlewares/`, `.git/`, `node_modules/`, `build/`, `Debug/`, `Release/`, `.vscode/` by default
- CLI: `--include-dir` for custom directories
- Writes `unified-audit-report.json` to project root
- `console.log` summary line: e.g. `[PREAUDIT] 3 conflicts, 2 chain breaks, 1 stack risk — 45ms`
- `.gitignore` entry: `unified-audit-report.json`

## SKILL.md Workflow Changes

### 0. Three-Stage Deep Review (v1.4 — MANDATORY)

### PRE-STAGE: Tool Preprocessing (0% AI budget)
```bash
node scripts/run-preaudit.js --include-dir Src/
# → writes unified-audit-report.json
```

### STAGE 1: Micro Logic Scan (70% AI budget)
Unchanged from v1.3 — strict single-function semantic checks.

### STAGE 2: Macro Architecture Verdict (30% AI budget)
- Check if `unified-audit-report.json` exists (via fs.access or user confirmation)
- **If exists**: Read as sole source for hardware conflicts. Do NOT re-read raw GPIO/ISR/DMA init code.
- **If not exists (degradation mode)**: Node.js not available? Guide the user manually:
  "Please check Src/pwm.c line 42 for PE9 AF configuration."
  This ensures zero-tool environments still get value — degraded from auto-verdict to smart-guided.
- Cross-reference pin_conflicts, control_chain_breaks, stack_overflow_risks against Stage 1 findings
- Generate structured report using the AGENTS.md template

## AGENTS.md Changes

New §1.2 Attention Budget Guide:

```markdown
### Attention Budget Guide
- **Pre-stage (0%)** — purely mechanical, handled by Node.js scripts
- **Stage 1 (70%)** — micro-logic: restrict to single-function scope; do NOT read the pre-audit JSON
- **Stage 2 (30%)** — macro-judgment: read ONLY unified-audit-report.json;
  do NOT re-read raw GPIO/ISR/DMA init code. The JSON is the single source of truth for HW conflicts.
```

## Performance Target

| Metric | v1.3 Baseline | v1.4 Target | Method |
|--------|--------------|-------------|--------|
| Precision | 100% | 100% | Maintain execution path tracing |
| Recall | 71% | **>90%** | Tool-assisted B4/B8/B10 coverage |
| F1 Score | 0.83 | **>0.94** | Above |
| Stage 2 token cost | ~8k (full code) | ~0.5k (JSON only) | 93% reduction |

## Out of Scope (v1.5+)

- clang-tidy integration for style checks (B15/B16/B17)
- RTOS-aware stack depth estimation with FreeRTOS task awareness
- CI pipeline integration scripts
