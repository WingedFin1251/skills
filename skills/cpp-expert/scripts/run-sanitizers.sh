#!/bin/bash
# cpp-expert: Compile and run with AddressSanitizer + UndefinedBehaviorSanitizer
#
# Usage: bash scripts/run-sanitizers.sh <file.cpp>
#
# SECURITY WARNING:
#   This script compiles and executes the provided C/C++ source file.
#   If the code contains malicious logic (e.g., system("rm -rf /")),
#   it will be executed on your machine.
#
#   RECOMMENDED: Run inside a sandbox/container (Docker, firejail, etc.)
#   The user assumes all risk from executing compiled binaries.

set -euo pipefail

SOURCE="${1:?Usage: $0 <source-file.cpp>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Determine compiler and standard based on extension
case "$SOURCE" in
    *.c)
        COMPILER="gcc"
        STD="-std=c11"
        ;;
    *.cpp|*.cc|*.cxx)
        COMPILER="g++"
        STD="-std=c++20"
        ;;
    *)
        echo "Unknown extension: $SOURCE"
        exit 1
        ;;
esac

OUTPUT="${SOURCE%.*}_sanitized"

echo "=== cpp-expert: Sanitizer Build & Run ==="
echo "Source: $SOURCE"
echo "Compiler: $COMPILER"
echo ""
echo "SECURITY: Executing compiled binary from untrusted source!"
echo "   Run in sandbox if code origin is unknown."
echo ""

# Compile with sanitizers
echo "--- Compiling with AddressSanitizer + UBSan ---"
if ! $COMPILER -fsanitize=address,undefined -g -O1 "$STD" "$SOURCE" -o "$OUTPUT"; then
    echo "ERROR: Compilation failed. Fix syntax errors and try again."
    exit 1
fi

echo ""
echo "--- Running ---"
"./$OUTPUT" || EXIT_CODE=$?

echo ""
echo "=== Sanitizer run complete (exit code: ${EXIT_CODE:-0}) ==="
