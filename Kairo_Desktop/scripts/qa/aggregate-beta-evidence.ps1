# aggregate-beta-evidence.ps1 - Consolidate beta evidence reports into dashboard
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/qa/aggregate-beta-evidence.ps1
# Run from Kairo_Desktop/ directory.
#
# Scans for beta-evidence-*.txt files and consolidates into docs/beta/BETA_DASHBOARD.md

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$repoRoot = Split-Path -Parent $root
$evidenceDir = $root
$dashboardDir = Join-Path (Join-Path $repoRoot 'docs') 'beta'
$dashboardPath = Join-Path $dashboardDir 'BETA_DASHBOARD.md'
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

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

Write-Host "=== Kairo Beta Evidence Aggregation ===" -ForegroundColor Cyan
Write-Host "Evidence dir: $evidenceDir"
Write-Host "Dashboard: $dashboardPath"
Write-Host ""

# --- Scan for evidence files ---

$evidenceFiles = Get-ChildItem -Path $evidenceDir -Filter 'beta-evidence-*.txt' -ErrorAction SilentlyContinue
$evidenceCount = if ($evidenceFiles) { $evidenceFiles.Count } else { 0 }

Check 'Evidence scan complete' ($true) "$evidenceCount reports found"

# --- Parse each evidence file ---

$machines = @()

foreach ($ef in $evidenceFiles) {
    $content = Get-Content $ef.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    $machine = @{
        File = $ef.Name
        Generated = ''
        MachineName = ''
        OS = ''
        NodeVersion = ''
        AppVersion = ''
        ElectronVersion = ''
        InstallerHash = ''
        InstallerSize = ''
        NativeModules = @()
        HasLogs = $false
    }

    if ($content -match 'Generated:\s*(.+)') { $machine.Generated = $Matches[1].Trim() }
    if ($content -match 'Machine:\s*(.+)') { $machine.MachineName = $Matches[1].Trim() }
    if ($content -match 'OS:\s*(.+)') { $machine.OS = $Matches[1].Trim() }
    if ($content -match 'Node\.js:\s*(.+)') { $machine.NodeVersion = $Matches[1].Trim() }
    if ($content -match 'Version:\s*(\d+\.\d+\.\d+)') { $machine.AppVersion = $Matches[1].Trim() }
    if ($content -match 'Electron:\s*(.+)') { $machine.ElectronVersion = $Matches[1].Trim() }
    if ($content -match 'SHA256:\s*([A-F0-9]{64})') { $machine.InstallerHash = $Matches[1].Trim() }
    if ($content -match 'Installer:\s*\S+\s*\((\d+[\.,]?\d*)\s*MB\)') { $machine.InstallerSize = $Matches[1].Trim() + ' MB' }
    if ($content -match '\.node\b') { $machine.NativeModules = @(([regex]::Matches($content, '(\w+\.node)') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)) }
    if ($content -match 'Log Tail') { $machine.HasLogs = $true }

    $machines += $machine
}

# --- Ensure dashboard directory exists ---

if (-not (Test-Path $dashboardDir)) {
    New-Item -ItemType Directory -Path $dashboardDir -Force | Out-Null
}

# --- Generate dashboard markdown ---

$md = @()
$md += "# KAIRO DESKTOP - Beta Dashboard"
$md += ""
$md += "Last Updated: $timestamp"
$md += "Evidence Reports: $evidenceCount"
$md += ""

if ($evidenceCount -eq 0) {
    $md += "> No evidence reports found. Run ``collect-beta-evidence.ps1`` on tester machines."
    $md += ""
    $md += "## How to Generate Evidence"
    $md += ""
    $md += '```powershell'
    $md += "powershell -ExecutionPolicy Bypass -File scripts/qa/collect-beta-evidence.ps1"
    $md += '```'
    $md += ""
    $md += "Share the resulting ``beta-evidence-*.txt`` file with the triage team."
} else {
    # Summary table
    $md += "## Machine Summary"
    $md += ""
    $md += "| Machine | OS | Node | App Version | Electron | Installer Hash (first 16) | Native Modules |"
    $md += "|---------|-----|------|-------------|----------|---------------------------|----------------|"

    foreach ($m in $machines) {
        $hashShort = if ($m.InstallerHash) { $m.InstallerHash.Substring(0, 16) + '...' } else { 'N/A' }
        $nativeMods = if ($m.NativeModules.Count -gt 0) { ($m.NativeModules -join ', ') } else { 'none' }
        $md += "| $($m.MachineName) | $($m.OS) | $($m.NodeVersion) | $($m.AppVersion) | $($m.ElectronVersion) | $hashShort | $nativeMods |"
    }

    $md += ""

    # Hash consistency check
    $uniqueHashes = @($machines | Where-Object { $_.InstallerHash } | ForEach-Object { $_.InstallerHash } | Select-Object -Unique)
    if ($uniqueHashes.Count -eq 1) {
        $md += "### Installer Hash Consistency: PASS"
        $md += ""
        $md += "All reports share the same SHA256: ``$($uniqueHashes[0])``"
    } elseif ($uniqueHashes.Count -gt 1) {
        $md += "### Installer Hash Consistency: FAIL"
        $md += ""
        $md += "WARNING: Multiple installer hashes detected! Testers may have different versions."
        foreach ($h in $uniqueHashes) {
            $hMachines = @($machines | Where-Object { $_.InstallerHash -eq $h } | ForEach-Object { $_.MachineName }) -join ', '
            $md += "- ``$h`` - $hMachines"
        }
    }

    $md += ""

    # Per-machine details
    $md += "## Detailed Reports"
    $md += ""

    foreach ($m in $machines) {
        $md += "### $($m.MachineName) ($($m.Generated))"
        $md += ""
        $md += "- **Source**: ``$($m.File)``"
        $md += "- **OS**: $($m.OS)"
        $md += "- **Node**: $($m.NodeVersion)"
        $md += "- **App Version**: $($m.AppVersion)"
        $md += "- **Electron**: $($m.ElectronVersion)"
        $md += "- **Installer Size**: $($m.InstallerSize)"
        $md += "- **Installer SHA256**: ``$($m.InstallerHash)``"
        $md += "- **Native Modules**: $(if ($m.NativeModules.Count -gt 0) { $m.NativeModules -join ', ' } else { 'none detected' })"
        $md += "- **Logs Present**: $(if ($m.HasLogs) { 'Yes' } else { 'No' })"
        $md += ""
    }
}

$md += ""
$md += "## Beta Health"
$md += ""
$md += "| Metric | Value |"
$md += "|--------|-------|"
$md += "| Evidence Reports | $evidenceCount |"
$md += "| Unique Machines | $(($machines | ForEach-Object { $_.MachineName } | Select-Object -Unique).Count) |"
$md += "| Open P0 Bugs | _fill manually_ |"
$md += "| Open P1 Bugs | _fill manually_ |"
$md += "| Beta Status | GREEN / AMBER / RED |"
$md += ""
$md += "---"
$md += ""
$md += "_Generated by ``aggregate-beta-evidence.ps1`` at $timestamp._"

# --- Write dashboard ---

($md -join "`n") | Out-File -FilePath $dashboardPath -Encoding UTF8

$dashboardExists = Test-Path $dashboardPath
Check 'Dashboard written' $dashboardExists $dashboardPath

if ($dashboardExists) {
    $dashboardSize = (Get-Item $dashboardPath).Length
    Check 'Dashboard non-empty' ($dashboardSize -gt 100) "$dashboardSize bytes"
}

# --- Summary ---

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "PASS: $pass | FAIL: $fail" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "Dashboard: $dashboardPath" -ForegroundColor Green
Write-Host "Evidence files processed: $evidenceCount" -ForegroundColor Green

if ($fail -gt 0) {
    exit 1
}

exit 0
