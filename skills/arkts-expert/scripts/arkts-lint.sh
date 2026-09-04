#!/bin/bash
# ArkTS static analysis wrapper
# Usage: bash arkts-lint.sh <source-file>
#
# 说明：启发式初筛脚本（grep 规则），不是官方 Code Linter。
# 规则名对应官方 ArkTS 规范约束（arkts-no-any-unknown / arkts-limited-throw / ...），
# 命中结果仅供提示，需人工复核，避免误报/漏报。

FILE="$1"
if [ -z "$FILE" ]; then
    echo "Usage: bash arkts-lint.sh <source-file>"
    exit 1
fi

if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE"
    exit 1
fi

echo "=== ArkTS Lint: $FILE ==="
echo ""

# Check for any/unknown
echo "--- Checking arkts-no-any-unknown ---"
if grep -n ': any\|: unknown\|as any\|as unknown' "$FILE"; then
    echo "❌ Found any/unknown usage"
else
    echo "✅ No any/unknown found"
fi
echo ""

# Check for non-Error throws
echo "--- Checking arkts-limited-throw ---"
if grep -n 'throw "' "$FILE" || grep -n "throw '" "$FILE" || grep -n 'throw [0-9]' "$FILE"; then
    echo "❌ Found non-Error throw"
else
    echo "✅ No non-Error throws found"
fi
echo ""

# Check Promise constructor type parameters
# 官方规则 10605034：可从参数推断时允许省略（如 Promise.resolve(42) 合法）；
# 只有 new Promise( 无法从参数推断 T，必须显式 new Promise<T>()。
echo "--- Checking arkts-no-inferred-generic-params (bare new Promise() ---"
if grep -nE 'new Promise\(' "$FILE" | grep -v '^[[:space:]]*//'; then
    echo "❌ Found new Promise( without type parameter (need new Promise<T>())"
else
    echo "✅ No bare new Promise( constructors found"
fi
echo ""

# Check for missing return types（风格项，非编译规则——见 AGENTS.md §1.4；
# 官方无 arkts-no-implicit-return-types 规则，强制的是 10605999 严格类型检查）
echo "--- Checking explicit return types (style) ---"
if grep -nE 'function [A-Za-z_][A-Za-z0-9_]*\([^)]*\) *\{' "$FILE" | grep -v '^[[:space:]]*//' | head -5; then
    echo "⚠️  Possible missing return types (style item, manual review needed)"
else
    echo "✅ Return types appear to be explicit"
fi
echo ""

# Check for not-recommended router usage（@ohos.router 官方标注"不推荐"，无版本化废弃）
echo "--- Checking for not-recommended router (@ohos.router) ---"
if grep -nE "from ['\"]@ohos\.router" "$FILE"; then
    echo "⚠️  Using not-recommended router — consider migrating to Navigation"
else
    echo "✅ No @ohos.router usage"
fi
echo ""

echo "=== Lint complete ==="
