# ArkTS static analysis wrapper (PowerShell version)
# Usage: .\arkts-lint.ps1 <source-file>
#
# 说明：启发式初筛脚本（Select-String 规则），不是官方 Code Linter。
# 规则名对应官方 ArkTS 规范约束，命中结果仅供提示，需人工复核，避免误报/漏报。

param(
    [Parameter(Mandatory=$true)]
    [string]$File
)

if (-not (Test-Path $File)) {
    Write-Error "Error: File not found: $File"
    exit 1
}

Write-Host "=== ArkTS Lint: $File ==="
Write-Host ""

# Check for any/unknown
Write-Host "--- Checking arkts-no-any-unknown ---"
$anyMatches = Select-String -Path $File -Pattern ': any|: unknown|as any|as unknown'
if ($anyMatches) {
    $anyMatches | ForEach-Object { Write-Host "  $($_.LineNumber): $($_.Line.Trim())" }
    Write-Host "❌ Found any/unknown usage" -ForegroundColor Red
} else {
    Write-Host "✅ No any/unknown found" -ForegroundColor Green
}
Write-Host ""

# Check for non-Error throws
Write-Host "--- Checking arkts-limited-throw ---"
$throwMatches = Select-String -Path $File -Pattern 'throw\s+"|throw\s+''|throw\s+\d+'
if ($throwMatches) {
    $throwMatches | ForEach-Object { Write-Host "  $($_.LineNumber): $($_.Line.Trim())" }
    Write-Host "❌ Found non-Error throw" -ForegroundColor Red
} else {
    Write-Host "✅ No non-Error throws found" -ForegroundColor Green
}
Write-Host ""

# Check Promise constructor type parameters
# 官方规则 10605034：可从参数推断时允许省略（如 Promise.resolve(42) 合法）；
# 只有 new Promise( 无法从参数推断 T，必须显式 new Promise<T>()。
Write-Host "--- Checking arkts-no-inferred-generic-params (bare new Promise() ---"
$promiseNoGeneric = Select-String -Path $File -Pattern 'new Promise\(' |
    Where-Object { $_.Line -notmatch '^\s*//' }
if ($promiseNoGeneric) {
    $promiseNoGeneric | ForEach-Object { Write-Host "  $($_.LineNumber): $($_.Line.Trim())" }
    Write-Host "❌ Found new Promise( without type parameter (need new Promise<T>())" -ForegroundColor Red
} else {
    Write-Host "✅ No bare new Promise( constructors found" -ForegroundColor Green
}
Write-Host ""

# Check for not-recommended router usage（@ohos.router 官方标注"不推荐"，无版本化废弃）
Write-Host "--- Checking for not-recommended router (@ohos.router) ---"
$routerMatch = Select-String -Path $File -Pattern "from\s*['""]@ohos\.router"
if ($routerMatch) {
    $routerMatch | ForEach-Object { Write-Host "  $($_.LineNumber): $($_.Line.Trim())" }
    Write-Host "⚠️  Using not-recommended router — consider migrating to Navigation" -ForegroundColor Yellow
} else {
    Write-Host "✅ No @ohos.router usage" -ForegroundColor Green
}
Write-Host ""

Write-Host "=== Lint complete ==="
