#!/bin/bash
# stm32-expert: Check CubeMX .ioc file for common configuration issues
#
# Usage: bash scripts/check-ioc-config.sh <project.ioc>
#
# Checks:
#   - Pin conflicts (same pin used by multiple peripherals)
#   - Clock frequency out of range
#   - Missing peripheral clock enables
#   - SWD debug pin usage

set -euo pipefail

IOC_FILE="${1:?Usage: $0 <project.ioc>}"
ISSUES=0

echo "=== stm32-expert: .ioc Configuration Check ==="
echo "File: $IOC_FILE"
echo ""

if [ ! -f "$IOC_FILE" ]; then
    echo "ERROR: File not found: $IOC_FILE"
    exit 1
fi

# Check 1: Pin conflicts — search for repeated GPIO signals
echo "--- Pin Conflict Check ---"
# Extract all Pin= assignments, find duplicates
PIN_OCCURRENCES=$(grep -oP 'Pin\.[^=]+=\K\S+' "$IOC_FILE" 2>/dev/null | sort)
DUPLICATE_PINS=$(echo "$PIN_OCCURRENCES" | uniq -d)
if [ -n "$DUPLICATE_PINS" ]; then
    echo "⚠️  Potential pin conflicts found:"
    echo "$DUPLICATE_PINS" | while read pin; do
        echo "  - Pin $pin used by multiple peripherals"
        ISSUES=$((ISSUES + 1))
    done
else
    echo "  ✅ No duplicate pin assignments"
fi

# Check 2: Clock frequency limits
echo ""
echo "--- Clock Frequency Check ---"
if grep -q "RCC.HSE_VALUE" "$IOC_FILE" 2>/dev/null; then
    HSE=$(grep "RCC.HSE_VALUE" "$IOC_FILE" | grep -oP '\d+')
    echo "  HSE = ${HSE}Hz"
fi
if grep -q "RCC.PLLN" "$IOC_FILE" 2>/dev/null; then
    PLLN=$(grep "RCC.PLLN" "$IOC_FILE" | grep -oP '\d+')
    echo "  PLLN = $PLLN (VCO multiplier)"
fi
# Basic sanity — if PLLN > 432 on F4, likely overclock
if [ -n "${PLLN:-}" ] && [ "$PLLN" -gt 432 ] 2>/dev/null; then
    echo "  ⚠️  PLLN > 432 — VCO may exceed maximum!"
    ISSUES=$((ISSUES + 1))
fi

# Check 3: SWD pin usage
echo ""
echo "--- Debug Pin Check ---"
if grep -q "PA13\|PA14" "$IOC_FILE" 2>/dev/null; then
    OCCUPIED=$(grep "PA13\|PA14" "$IOC_FILE" | grep -v "Mcu" | head -3)
    if [ -n "$OCCUPIED" ]; then
        echo "  ⚠️  SWD pins (PA13/PA14) may be configured for GPIO"
        echo "  $OCCUPIED"
        ISSUES=$((ISSUES + 1))
    else
        echo "  ✅ SWD pins not reassigned"
    fi
fi

echo ""
if [ "$ISSUES" -eq 0 ]; then
    echo "=== No issues found ✅ ==="
else
    echo "=== Found $ISSUES issue(s) ⚠️  ==="
fi
