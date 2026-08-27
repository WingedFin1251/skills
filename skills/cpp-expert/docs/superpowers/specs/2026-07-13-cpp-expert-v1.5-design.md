# cpp-expert v1.5 Design Document — Plug the Final Blind Spots

**Date:** 2026-07-13
**Based on:** v1.4 test results (F1=0.86, P=100%, R=76.2%, 5 missed defects)

## Root Cause Analysis

The 5 missed defects in v1.4 break into two categories:

| Category | Count | Defects | Root Cause | Solution |
|----------|-------|---------|------------|----------|
| **Rule blind spots** | 2 | B18 (magic numbers), B15 (global i/j/k) | AGENTS.md lacks explicit rules | Rule route: add to §5.7, §6.1 |
| **Script blind spots** | 2 | B16 (qsort sentinel), B17 (EXTI file) | No tool to detect pattern | Script route: style_audit.js |
| **Genuine aggregation** | 1 | Other minor style issues | Report compression | Acceptable at 🟡 level |

## Approach: Two Parallel Routes

### Route A: AGENTS.md Rule Updates (no code change)

**§5.7 Basic C Semantics — add item 6:**
```markdown
6. **Magic number detection** (v1.5 — MEDIUM)
   Scan for bare numeric literals. Every value except 0, 1, -1 must be named
   via `#define` or `const`. This catches: `if (adc > 4095)`, `delay_ms(1000)`,
   `pwm = 5000`. Flag as 🟡 MEDIUM per occurrence.
```

**§6.1 Naming Conventions — add item:**
```markdown
**File-scope static enforcement** (v1.5 — HIGH)
   Every non-static global variable in a .c file must be justified. Especially
   flag single-letter names (i, j, k) and generic names (cnt, temp, buf) at
   file scope as 🟠 HIGH — they pollute the global namespace and risk linker
   conflicts.
```

### Route B: New style_audit.js Script

**File:** `scripts/style_audit.js`

**Detections:**

| ID | Pattern | Regex / Logic | Severity |
|----|---------|---------------|----------|
| B16 | Sentinel assignment | `\w+\[0\]\s*=\s*\w+\[\w+\]` in sort/search context | 🟡 MEDIUM |
| B17 | EXTI wrong file | EXTI init code found outside `bsp_*`, `exti*`, `gpio*` files | 🟡 MEDIUM |
| B15-2 | Global i/j/k | `^(?!static)\s*(int|char|float)\s+(i|j|k)\s*[=;]` at file scope | 🟠 HIGH |

**Output:** Extends `unified-audit-report.json` with new `style_issues[]` field.

## JSON Schema Extension

```json
{
  "style_issues": [
    {
      "id": "B16",
      "pattern": "sentinel_assignment",
      "severity": "MEDIUM",
      "file": "Src/utils.c",
      "line": 42,
      "detail": "s[0] = s[start] — potential sentinel misuse"
    },
    {
      "id": "B17",
      "pattern": "exti_wrong_file",
      "severity": "MEDIUM",
      "file": "Src/main.c",
      "line": 105,
      "detail": "EXTI config in main.c, expected in bsp_exti.c"
    }
  ]
}
```

## SKILL.md Updates

- Pre-stage command remains unchanged: `node scripts/run-preaudit.js`
- Bundled Resources: add `scripts/style_audit.js`
- Quick Reference: no changes needed (operates within existing 13 steps)

## AGENTS.md Updates

- §5.7: add item 6 (magic numbers)
- §6.1: add file-scope static enforcement

## Performance Target

| Metric | v1.4 | v1.5 Target | Method |
|--------|------|-------------|--------|
| Precision | 100% | 100% | Rule route (no new false positives) |
| Recall | 76.2% | **>85%** | Script route (B16/B17) + Rule route (B18/B15) |
| F1 Score | 0.86 | **>0.92** | Above |
| Missed | 5 | **<3** | Coverage of all 21 baseline defects |

## Out of Scope

- Deep algorithm analysis (SOGI-PLL discretization, ADC timing)
- Hardware manual cross-referencing
- CI/CD integration (separate project)
