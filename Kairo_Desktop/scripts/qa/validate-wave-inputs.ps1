# validate-wave-inputs.ps1 - Verify minimum beta wave inputs before exit criteria evaluation
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/qa/validate-wave-inputs.ps1
# Run from Kairo_Desktop/ directory.
#
# Checks:
# 1. >= 3 evidence files present
# 2. >= 2 unique machine names
# 3. >= 2 evidence files with installer hash (proxy for API readiness / real install)

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$evidenceDir = $root
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

Write-Host "=== Kairo Beta Wave Input Validation ===" -ForegroundColor Cyan
Write-Host "Evidence dir: $evidenceDir"
Write-Host "Timestamp: $timestamp"
Write-Host ""

# --- Check 1: Evidence file count ---

Write-Host "--- Check 1: Evidence File Count ---" -ForegroundColor Cyan

$evidenceFiles = Get-ChildItem -Path $evidenceDir -Filter 'beta-evidence-*.txt' -ErrorAction SilentlyContinue
$evidenceCount = if ($evidenceFiles) { $evidenceFiles.Count } else { 0 }

Check 'Evidence files found' ($evidenceCount -gt 0) "$evidenceCount file(s)"
Check 'Minimum 3 evidence files' ($evidenceCount -ge 3) "$evidenceCount / 3 required"

Write-Host ""

# --- Check 2: Unique machine names ---

Write-Host "--- Check 2: Unique Machine Names ---" -ForegroundColor Cyan

$machineNames = @()

foreach ($ef in $evidenceFiles) {
    $content = Get-Content $ef.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -and $content -match 'Machine:\s*(.+)') {
        $name = $Matches[1].Trim()
        if ($name -and $name -ne '(unknown)') {
            $machineNames += $name
        }
    }
}

$uniqueMachines = @($machineNames | Select-Object -Unique)
$uniqueCount = $uniqueMachines.Count

Check 'Machine names parsed' ($machineNames.Count -gt 0) "$($machineNames.Count) machine name(s) extracted"
Check 'Minimum 2 unique machines' ($uniqueCount -ge 2) "$uniqueCount unique: $($uniqueMachines -join ', ')"

Write-Host ""

# --- Check 3: Installer hash presence (proxy for real install + API readiness) ---

Write-Host "--- Check 3: API Readiness (Installer Hash Proxy) ---" -ForegroundColor Cyan

$hashCount = 0

foreach ($ef in $evidenceFiles) {
    $content = Get-Content $ef.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -and $content -match 'SHA256:\s*[A-F0-9]{64}') {
        $hashCount++
    }
}

Check 'Evidence files with installer hash' ($hashCount -gt 0) "$hashCount file(s) have SHA256"
Check 'Minimum 2 hashes (real installs)' ($hashCount -ge 2) "$hashCount / 2 required"

Write-Host ""

# --- Check 4: Evidence freshness ---

Write-Host "--- Check 4: Evidence Freshness ---" -ForegroundColor Cyan

$freshCount = 0
$staleThreshold = (Get-Date).AddDays(-5)

foreach ($ef in $evidenceFiles) {
    if ($ef.LastWriteTime -gt $staleThreshold) {
        $freshCount++
    }
}

Check 'Fresh evidence (< 5 days old)' ($freshCount -gt 0) "$freshCount / $evidenceCount fresh"
Check 'All evidence fresh' ($freshCount -eq $evidenceCount) "$freshCount / $evidenceCount within 5-day window"

Write-Host ""

# --- Check 5: Smoke checklist proxy (multi-section evidence) ---

Write-Host "--- Check 5: Evidence Completeness ---" -ForegroundColor Cyan

$completeCount = 0
$requiredSections = @('Operating System', 'Runtime Versions', 'App Version', 'Build Artifacts')

foreach ($ef in $evidenceFiles) {
    $content = Get-Content $ef.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    $sectionsFound = 0
    foreach ($section in $requiredSections) {
        if ($content -match $section) { $sectionsFound++ }
    }
    if ($sectionsFound -ge $requiredSections.Count) {
        $completeCount++
    }
}

Check 'Complete evidence reports' ($completeCount -gt 0) "$completeCount / $evidenceCount have all 4 required sections"
Check 'Minimum 2 complete reports' ($completeCount -ge 2) "$completeCount / 2 required"

Write-Host ""

# --- Summary ---

Write-Host "=== Summary ===" -ForegroundColor Cyan

$totalChecks = $pass + $fail
Write-Host "PASS: $pass | FAIL: $fail | TOTAL: $totalChecks" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })

Write-Host ""

# Wave readiness assessment
if ($fail -eq 0) {
    Write-Host "WAVE READINESS: GO" -ForegroundColor Green
    Write-Host "All input validation checks passed. Safe to evaluate exit criteria." -ForegroundColor Green
} elseif ($evidenceCount -ge 3 -and $uniqueCount -ge 2) {
    Write-Host "WAVE READINESS: CONDITIONAL" -ForegroundColor Yellow
    Write-Host "Core thresholds met but some quality checks failed. Review warnings." -ForegroundColor Yellow
} else {
    Write-Host "WAVE READINESS: NOT READY" -ForegroundColor Red
    Write-Host "Insufficient evidence to evaluate exit criteria. Collect more tester data." -ForegroundColor Red
}

Write-Host ""

if ($fail -gt 0) {
    exit 1
}

exit 0
