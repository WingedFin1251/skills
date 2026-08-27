#!/bin/bash
# cpp-expert: Run clang-tidy + cppcheck on a source file or directory
#
# Usage: bash scripts/run-static-analysis.sh <file-or-dir>
#
# Compilation database probe:
#   - Detects compile_commands.json in current or parent directory
#   - If found: uses -p for precise header resolution
#   - If missing: falls back with warning

set -euo pipefail

TARGET="${1:?Usage: $0 <file-or-dir>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== cpp-expert: Static Analysis Report ==="
echo "Target: $TARGET"
echo ""

# --- Probe for compile_commands.json ---
COMP_DB=""
TARGET_DIR="$(dirname "$(realpath "$TARGET" 2>/dev/null || echo "$TARGET")")"
while [ "$TARGET_DIR" != "/" ] && [ -z "$COMP_DB" ]; do
    if [ -f "$TARGET_DIR/compile_commands.json" ]; then
        COMP_DB="-p $TARGET_DIR"
    fi
    TARGET_DIR="$(dirname "$TARGET_DIR")"
done

# --- clang-tidy ---
echo "--- clang-tidy ---"
if command -v clang-tidy &> /dev/null; then
    if [ -n "$COMP_DB" ]; then
        clang-tidy "$TARGET" "$COMP_DB" || true
    else
        echo "⚠️  Warning: No compile_commands.json found."
        echo "   Header resolution may be inaccurate."
        echo "   For best results, run cmake with -DCMAKE_EXPORT_COMPILE_COMMANDS=ON"
        echo ""
        clang-tidy "$TARGET" -- -std=c++20 -I./include 2>/dev/null || true
    fi
else
    echo "clang-tidy not found. Install it via your package manager."
fi

echo ""
echo "--- cppcheck ---"
if command -v cppcheck &> /dev/null; then
    cppcheck --enable=all --suppress=missingIncludeSystem --std=c++20 "$TARGET" 2>&1 || true
else
    echo "cppcheck not found. Install it via your package manager."
fi

echo ""
echo "=== Analysis complete ==="
