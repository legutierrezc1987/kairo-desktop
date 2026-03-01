# create-beta-zip.ps1 - Package beta distribution bundle
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/qa/create-beta-zip.ps1
# Run from Kairo_Desktop/ directory.
#
# Creates a ZIP containing:
# - setup.exe (installer)
# - docs: onboarding, release checklist, bug template, beta execution plan
# - SHA256 hash file
# - README for testers

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$desktopRoot = $root
$repoRoot = Split-Path -Parent $root
$dist = Join-Path $desktopRoot 'dist'
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$zipName = "kairo-beta-v0.1.0-$timestamp.zip"
$zipPath = Join-Path $dist $zipName
$staging = Join-Path $dist 'beta-staging'

$pass = 0
$fail = 0

function Check($name, $condition, $detail) {
    if ($condition) {
        $script:pass++
        Write-Host "[PASS] $name - $detail" -ForegroundColor Green
    } else {
        $script:fail++
        Write-Host "[FAIL] $name - $detail" -ForegroundColor Red
    }
}

Write-Host "=== Kairo Beta Distribution Bundle ===" -ForegroundColor Cyan
Write-Host "Desktop Root: $desktopRoot"
Write-Host "Repo Root: $repoRoot"
Write-Host "Dist: $dist"
Write-Host ""

# --- Pre-flight checks ---

$setupGlob = Get-ChildItem -Path $dist -Filter 'kairo-desktop-*-setup.exe' -ErrorAction SilentlyContinue
$setupExists = $null -ne $setupGlob -and $setupGlob.Count -gt 0
Check 'Installer found' $setupExists $(if ($setupExists) { $setupGlob[0].Name } else { 'NOT FOUND - run npm run build:win first' })

if (-not $setupExists) {
    Write-Host ""
    Write-Host "ABORT: No installer found. Run 'npm run build:win' first." -ForegroundColor Red
    exit 1
}

$setupFile = $setupGlob[0]
$setupHash = (Get-FileHash $setupFile.FullName -Algorithm SHA256).Hash

$docsRoot = Join-Path $repoRoot 'docs'
$requiredDocs = @(
    @{ Name = '09_KAIRO_ONBOARDING_BETA.md'; Src = Join-Path $docsRoot '09_KAIRO_ONBOARDING_BETA.md' },
    @{ Name = '10_KAIRO_RELEASE_CHECKLIST.md'; Src = Join-Path $docsRoot '10_KAIRO_RELEASE_CHECKLIST.md' },
    @{ Name = '11_KAIRO_BETA_EXECUTION_PLAN.md'; Src = Join-Path $docsRoot '11_KAIRO_BETA_EXECUTION_PLAN.md' },
    @{ Name = '12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md'; Src = Join-Path $docsRoot '12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md' }
)

foreach ($doc in $requiredDocs) {
    $exists = Test-Path $doc.Src
    Check "Doc: $($doc.Name)" $exists $(if ($exists) { 'found' } else { 'MISSING' })
    if (-not $exists) {
        Write-Host "ABORT: Required doc missing: $($doc.Name)" -ForegroundColor Red
        exit 1
    }
}

# --- Create staging directory ---

Write-Host ""
Write-Host "Creating staging directory..." -ForegroundColor Cyan

if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

$docsStaging = Join-Path $staging 'docs'
New-Item -ItemType Directory -Path $docsStaging -Force | Out-Null

# --- Copy files ---

Write-Host "Copying installer..."
Copy-Item $setupFile.FullName (Join-Path $staging $setupFile.Name)

Write-Host "Copying docs..."
foreach ($doc in $requiredDocs) {
    Copy-Item $doc.Src (Join-Path $docsStaging $doc.Name)
}

# --- Generate SHA256 file ---

Write-Host "Generating SHA256 checksums..."
$hashFile = Join-Path $staging 'SHA256SUMS.txt'
$hashContent = @()
$hashContent += "$setupHash  $($setupFile.Name)"

foreach ($doc in $requiredDocs) {
    $docHash = (Get-FileHash $doc.Src -Algorithm SHA256).Hash
    $hashContent += "$docHash  docs/$($doc.Name)"
}

$hashContent -join "`n" | Out-File -FilePath $hashFile -Encoding UTF8 -NoNewline

# --- Generate README for testers ---

Write-Host "Generating README..."
$readmePath = Join-Path $staging 'README-BETA.txt'
$readmeContent = @"
KAIRO DESKTOP v0.1.0 - CLOSED BETA
===================================

Thank you for participating in the Kairo Desktop closed beta!

QUICK START
-----------
1. Verify the installer hash:
   SHA256: $setupHash
   File:   $($setupFile.Name)

2. Install: double-click the setup.exe file.
   - Windows SmartScreen will warn about an unsigned app.
   - Click "More info" then "Run anyway".

3. Read docs/09_KAIRO_ONBOARDING_BETA.md for the full quickstart guide (15 min).

4. Run through the smoke checklist in the onboarding doc.

REPORTING BUGS
--------------
Use docs/12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md as your bug report template.
Include: steps to reproduce, expected vs actual behavior, screenshots/logs.

CONTENTS OF THIS PACKAGE
-------------------------
- $($setupFile.Name)              Installer (Windows x64, NSIS)
- docs/09_KAIRO_ONBOARDING_BETA.md       Quickstart guide
- docs/10_KAIRO_RELEASE_CHECKLIST.md     Release checklist
- docs/11_KAIRO_BETA_EXECUTION_PLAN.md   Beta plan (for reference)
- docs/12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md  Bug report template
- SHA256SUMS.txt                          File checksums
- README-BETA.txt                         This file

KNOWN LIMITATIONS
-----------------
- Installer is unsigned (SmartScreen warning expected).
- Gemini free-tier may have zero quota - paid API key recommended.
- MCP external provider not available - local memory fallback active.
- No auto-update - manual reinstall required for new versions.

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

$readmeContent | Out-File -FilePath $readmePath -Encoding UTF8

# --- Create ZIP ---

Write-Host ""
Write-Host "Creating ZIP archive..." -ForegroundColor Cyan

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -CompressionLevel Optimal

$zipExists = Test-Path $zipPath
Check 'ZIP created' $zipExists $zipPath

if ($zipExists) {
    $zipSize = (Get-Item $zipPath).Length
    $zipMB = [math]::Round($zipSize / 1MB, 2)
    Check 'ZIP size > 50 MB' ($zipSize -gt 50MB) "$zipMB MB"

    $zipHash = (Get-FileHash $zipPath -Algorithm SHA256).Hash
    Check 'ZIP SHA256 computed' ($zipHash.Length -eq 64) $zipHash
}

# --- Cleanup staging ---

Write-Host ""
Write-Host "Cleaning up staging..." -ForegroundColor Cyan
Remove-Item $staging -Recurse -Force

# --- Summary ---

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "PASS: $pass | FAIL: $fail" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })

if ($zipExists) {
    Write-Host ""
    Write-Host "Beta ZIP: $zipPath" -ForegroundColor Green
    Write-Host "ZIP SHA256: $zipHash" -ForegroundColor Green
    Write-Host "Installer SHA256: $setupHash" -ForegroundColor Green
}

if ($fail -gt 0) {
    exit 1
}

exit 0
