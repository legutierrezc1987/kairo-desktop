# verify-packaging.ps1 -Validate Kairo Desktop build artifacts
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/qa/verify-packaging.ps1
# Run from Kairo_Desktop/ directory.
#
# Checks:
# 1. setup.exe exists + size > 50MB
# 2. win-unpacked/kairo-desktop.exe exists + size > 100MB
# 3. Native .node files in app.asar.unpacked
# 4. SHA256 hashes recorded
# 5. electron-builder.yml has npmRebuild: false

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dist = Join-Path $root 'dist'
$pass = 0
$fail = 0
$results = @()

function Check($name, $condition, $detail) {
    if ($condition) {
        $script:pass++
        $script:results += "[PASS] $name -$detail"
        Write-Host "[PASS] $name -$detail" -ForegroundColor Green
    } else {
        $script:fail++
        $script:results += "[FAIL] $name -$detail"
        Write-Host "[FAIL] $name -$detail" -ForegroundColor Red
    }
}

Write-Host "=== Kairo Desktop Packaging Verification ===" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host "Dist: $dist"
Write-Host ""

# --- Check 1: Installer ---
$setupGlob = Get-ChildItem -Path $dist -Filter 'kairo-desktop-*-setup.exe' -ErrorAction SilentlyContinue
$setupExists = $null -ne $setupGlob -and $setupGlob.Count -gt 0
Check 'Installer exists' $setupExists $(if ($setupExists) { $setupGlob[0].Name } else { 'NOT FOUND in dist/' })

if ($setupExists) {
    $setupSize = $setupGlob[0].Length
    $setupMB = [math]::Round($setupSize / 1MB, 2)
    Check 'Installer size > 50 MB' ($setupSize -gt 50MB) "$setupMB MB"

    $hash = (Get-FileHash $setupGlob[0].FullName -Algorithm SHA256).Hash
    Check 'Installer SHA256 computed' ($hash.Length -eq 64) $hash
}

# --- Check 2: Unpacked exe ---
$unpackedExe = Join-Path (Join-Path $dist 'win-unpacked') 'kairo-desktop.exe'
$unpackedExists = Test-Path $unpackedExe
Check 'Unpacked exe exists' $unpackedExists $unpackedExe

if ($unpackedExists) {
    $unpackedSize = (Get-Item $unpackedExe).Length
    $unpackedMB = [math]::Round($unpackedSize / 1MB, 2)
    Check 'Unpacked exe size > 100 MB' ($unpackedSize -gt 100MB) "$unpackedMB MB"
}

# --- Check 3: Native .node files ---
$asarUnpacked = Join-Path (Join-Path (Join-Path $dist 'win-unpacked') 'resources') 'app.asar.unpacked'
$asarExists = Test-Path $asarUnpacked
Check 'app.asar.unpacked exists' $asarExists $asarUnpacked

if ($asarExists) {
    $nodeFiles = Get-ChildItem -Path $asarUnpacked -Recurse -Filter '*.node' -ErrorAction SilentlyContinue
    $nodeNames = if ($nodeFiles) { ($nodeFiles | ForEach-Object { $_.Name }) -join ', ' } else { 'NONE' }
    $nodeCount = if ($nodeFiles) { $nodeFiles.Count } else { 0 }

    Check 'Native .node files found' ($nodeCount -ge 2) "$nodeCount files: $nodeNames"

    $expectedNodes = @('better_sqlite3.node', 'pty.node', 'conpty.node', 'conpty_console_list.node')
    foreach ($expected in $expectedNodes) {
        $found = $nodeFiles | Where-Object { $_.Name -eq $expected }
        Check "Native: $expected" ($null -ne $found) $(if ($found) { "$([math]::Round($found.Length / 1KB, 1)) KB" } else { 'MISSING' })
    }
}

# --- Check 4: electron-builder.yml ---
$builderYml = Join-Path $root 'electron-builder.yml'
$ymlExists = Test-Path $builderYml
Check 'electron-builder.yml exists' $ymlExists $builderYml

if ($ymlExists) {
    $ymlContent = Get-Content $builderYml -Raw
    Check 'npmRebuild: false present' ($ymlContent -match 'npmRebuild:\s*false') 'Prevents runtime rebuild'
    Check 'asarUnpack configured' ($ymlContent -match 'asarUnpack') 'Native modules unpacked from ASAR'
}

# --- Summary ---
Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "PASS: $pass | FAIL: $fail" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "FAILED CHECKS:" -ForegroundColor Red
    $results | Where-Object { $_ -match '^\[FAIL\]' } | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    exit 1
}

exit 0
