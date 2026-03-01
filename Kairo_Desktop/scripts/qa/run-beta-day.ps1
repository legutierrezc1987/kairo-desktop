# run-beta-day.ps1 - Daily beta orchestration script
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/qa/run-beta-day.ps1
# Run from Kairo_Desktop/ directory.
#
# Steps:
# 1. Runs collect-beta-evidence.ps1 (local machine snapshot)
# 2. Runs aggregate-beta-evidence.ps1 (consolidate all evidence into dashboard)
# 3. Runs classify-beta-issues.ps1 (scan issues input and build backlog)
# 4. Generates daily snapshot in docs/beta/daily/YYYY-MM-DD.md

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$repoRoot = Split-Path -Parent $root
$scriptsQA = Join-Path (Join-Path $root 'scripts') 'qa'
$today = Get-Date -Format 'yyyy-MM-dd'
$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$dailyDir = Join-Path (Join-Path (Join-Path $repoRoot 'docs') 'beta') 'daily'
$dailyPath = Join-Path $dailyDir "$today.md"

$pass = 0
$fail = 0
$stepResults = @()

function Check($name, $condition, $detail) {
    if ($condition) {
        $script:pass++
        $script:stepResults += @{ Name = $name; Status = 'PASS'; Detail = $detail }
        Write-Host "[PASS] $name - $detail" -ForegroundColor Green
    } else {
        $script:fail++
        $script:stepResults += @{ Name = $name; Status = 'FAIL'; Detail = $detail }
        Write-Host "[FAIL] $name - $detail" -ForegroundColor Red
    }
}

Write-Host "=== Kairo Beta Daily Run - $today ===" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host "Repo: $repoRoot"
Write-Host ""

# --- Step 1: Collect evidence (local machine) ---

Write-Host "--- Step 1: Collect Evidence ---" -ForegroundColor Cyan
$collectScript = Join-Path $scriptsQA 'collect-beta-evidence.ps1'
$collectExists = Test-Path $collectScript
Check 'collect-beta-evidence.ps1 found' $collectExists $collectScript

if ($collectExists) {
    try {
        $collectArgs = "-ExecutionPolicy Bypass -File `"$collectScript`""
        $proc = Start-Process -FilePath 'powershell' -ArgumentList $collectArgs -Wait -NoNewWindow -PassThru
        Check 'Evidence collection completed' ($proc.ExitCode -eq 0) 'local machine snapshot generated'
    } catch {
        Check 'Evidence collection completed' $false $_.Exception.Message
    }
}

Write-Host ""

# --- Step 2: Aggregate evidence ---

Write-Host "--- Step 2: Aggregate Evidence ---" -ForegroundColor Cyan
$aggregateScript = Join-Path $scriptsQA 'aggregate-beta-evidence.ps1'
$aggregateExists = Test-Path $aggregateScript
Check 'aggregate-beta-evidence.ps1 found' $aggregateExists $aggregateScript

if ($aggregateExists) {
    try {
        $aggArgs = "-ExecutionPolicy Bypass -File `"$aggregateScript`""
        $proc = Start-Process -FilePath 'powershell' -ArgumentList $aggArgs -Wait -NoNewWindow -PassThru
        $dashboardPath = Join-Path (Join-Path (Join-Path $repoRoot 'docs') 'beta') 'BETA_DASHBOARD.md'
        $dashboardUpdated = Test-Path $dashboardPath
        Check 'Dashboard updated' $dashboardUpdated $dashboardPath
    } catch {
        Check 'Dashboard updated' $false $_.Exception.Message
    }
}

Write-Host ""

# --- Step 3: Classify issues ---

Write-Host "--- Step 3: Classify Issues ---" -ForegroundColor Cyan
$classifyScript = Join-Path $scriptsQA 'classify-beta-issues.ps1'
$classifyExists = Test-Path $classifyScript
Check 'classify-beta-issues.ps1 found' $classifyExists $classifyScript

if ($classifyExists) {
    try {
        $classArgs = "-ExecutionPolicy Bypass -File `"$classifyScript`""
        $proc = Start-Process -FilePath 'powershell' -ArgumentList $classArgs -Wait -NoNewWindow -PassThru
        $backlogPath = Join-Path (Join-Path (Join-Path $repoRoot 'docs') 'beta') 'BETA_BACKLOG.md'
        $backlogUpdated = Test-Path $backlogPath
        Check 'Backlog updated' $backlogUpdated $backlogPath
    } catch {
        Check 'Backlog updated' $false $_.Exception.Message
    }
}

Write-Host ""

# --- Step 4: Generate daily snapshot ---

Write-Host "--- Step 4: Daily Snapshot ---" -ForegroundColor Cyan

if (-not (Test-Path $dailyDir)) {
    New-Item -ItemType Directory -Path $dailyDir -Force | Out-Null
}

# Count evidence files
$evidenceFiles = Get-ChildItem -Path $root -Filter 'beta-evidence-*.txt' -ErrorAction SilentlyContinue
$evidenceCount = if ($evidenceFiles) { $evidenceFiles.Count } else { 0 }

# Read dashboard for metrics if available
$dashboardContent = ''
$dashboardFile = Join-Path (Join-Path (Join-Path $repoRoot 'docs') 'beta') 'BETA_DASHBOARD.md'
if (Test-Path $dashboardFile) {
    $dashboardContent = Get-Content $dashboardFile -Raw -ErrorAction SilentlyContinue
}

# Read backlog for metrics if available
$backlogContent = ''
$backlogFile = Join-Path (Join-Path (Join-Path $repoRoot 'docs') 'beta') 'BETA_BACKLOG.md'
if (Test-Path $backlogFile) {
    $backlogContent = Get-Content $backlogFile -Raw -ErrorAction SilentlyContinue
}

$md = @()
$md += "# Beta Daily Snapshot - $today"
$md += ""
$md += "Generated: $timestamp"
$md += ""
$md += "## Pipeline Results"
$md += ""
$md += "| Step | Status | Detail |"
$md += "|------|--------|--------|"

foreach ($r in $stepResults) {
    $md += "| $($r.Name) | $($r.Status) | $($r.Detail) |"
}

$md += ""
$md += "## Metrics"
$md += ""
$md += "| Metric | Value |"
$md += "|--------|-------|"
$md += "| Evidence Reports | $evidenceCount |"
$md += "| Pipeline PASS | $pass |"
$md += "| Pipeline FAIL | $fail |"
$md += "| Beta Day | $(if ($today) { $today } else { 'unknown' }) |"
$md += ""
$md += "## Actions Required"
$md += ""
$md += "- [ ] Review dashboard: docs/beta/BETA_DASHBOARD.md"
$md += "- [ ] Review backlog: docs/beta/BETA_BACKLOG.md"
$md += "- [ ] Triage new bugs per docs/13_KAIRO_BETA_DAILY_TRIAGE.md"
$md += "- [ ] Update beta health status"
$md += ""
$md += "---"
$md += ""
$md += "_Generated by run-beta-day.ps1_"

($md -join "`n") | Out-File -FilePath $dailyPath -Encoding UTF8

$dailyExists = Test-Path $dailyPath
Check 'Daily snapshot written' $dailyExists $dailyPath

# --- Summary ---

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "PASS: $pass | FAIL: $fail" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "Daily snapshot: $dailyPath" -ForegroundColor Green

if ($fail -gt 0) {
    exit 1
}

exit 0
