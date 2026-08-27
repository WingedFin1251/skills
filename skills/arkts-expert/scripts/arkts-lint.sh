#!/bin/bash
# ArkTS static analysis wrapper
# Usage: bash arkts-lint.sh <source-file>

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

# Check for missing generic params
echo "--- Checking arkts-no-inferred-generic-params ---"
if grep -n 'Promise(' "$FILE" | grep -v 'Promise<'; then
    echo "❌ Found Promise without type parameter"
else
    echo "✅ All Promises have explicit type params"
fi
echo ""

# Check for missing return types (basic check)
echo "--- Checking arkts-no-implicit-return-types ---"
if grep -n 'function.*).*{' "$FILE" | grep -v ':' | grep -v '//' | head -5; then
    echo "⚠️  Possible missing return types (manual review needed)"
else
    echo "✅ Return types appear to be explicit"
fi
echo ""

# Check for deprecated router usage
echo "--- Checking for deprecated router ---"
if grep -n 'import.*router.*from.*@ohos.router' "$FILE"; then
    echo "⚠️  Using deprecated router — consider migrating to Navigation"
else
    echo "✅ No deprecated router usage"
fi
echo ""

echo "=== Lint complete ==="
