# ArkTS static analysis wrapper (PowerShell version)
# Usage: .\arkts-lint.ps1 <source-file>

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

# Check for missing generic params
Write-Host "--- Checking arkts-no-inferred-generic-params ---"
$promiseNoGeneric = Select-String -Path $File -Pattern 'Promise\(' | Where-Object { $_.Line -notmatch 'Promise<' }
if ($promiseNoGeneric) {
    $promiseNoGeneric | ForEach-Object { Write-Host "  $($_.LineNumber): $($_.Line.Trim())" }
    Write-Host "❌ Found Promise without type parameter" -ForegroundColor Red
} else {
    Write-Host "✅ All Promises have explicit type params" -ForegroundColor Green
}
Write-Host ""

# Check for deprecated router usage
Write-Host "--- Checking for deprecated router ---"
$routerMatch = Select-String -Path $File -Pattern 'import.*router.*from.*@ohos.router'
if ($routerMatch) {
    $routerMatch | ForEach-Object { Write-Host "  $($_.LineNumber): $($_.Line.Trim())" }
    Write-Host "⚠️  Using deprecated router — consider migrating to Navigation" -ForegroundColor Yellow
} else {
    Write-Host "✅ No deprecated router usage" -ForegroundColor Green
}
Write-Host ""

Write-Host "=== Lint complete ==="
