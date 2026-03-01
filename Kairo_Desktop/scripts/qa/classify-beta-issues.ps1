# classify-beta-issues.ps1 - Classify beta issues and generate backlog
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/qa/classify-beta-issues.ps1
# Run from Kairo_Desktop/ directory.
#
# Scans docs/beta/issues/ for *.md issue files and classifies by priority.
# Exports operational backlog to docs/beta/BETA_BACKLOG.md.
#
# Issue file format (one .md per issue in docs/beta/issues/):
#   Line 1: # ISSUE-NNN: Title
#   Priority: P0|P1|P2|P3
#   Status: Open|In Progress|Fixed|Won't Fix|Duplicate
#   Reporter: name
#   Date: YYYY-MM-DD
#   (body follows)
#
# If no issue files exist, generates an empty backlog template.

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$repoRoot = Split-Path -Parent $root
$betaDir = Join-Path (Join-Path $repoRoot 'docs') 'beta'
$issuesDir = Join-Path $betaDir 'issues'
$backlogPath = Join-Path $betaDir 'BETA_BACKLOG.md'
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

Write-Host "=== Kairo Beta Issue Classification ===" -ForegroundColor Cyan
Write-Host "Issues dir: $issuesDir"
Write-Host "Backlog: $backlogPath"
Write-Host ""

# --- Ensure directories exist ---

if (-not (Test-Path $betaDir)) {
    New-Item -ItemType Directory -Path $betaDir -Force | Out-Null
}
if (-not (Test-Path $issuesDir)) {
    New-Item -ItemType Directory -Path $issuesDir -Force | Out-Null
}

# --- Scan issue files ---

$issueFiles = Get-ChildItem -Path $issuesDir -Filter '*.md' -ErrorAction SilentlyContinue
$issueCount = if ($issueFiles) { $issueFiles.Count } else { 0 }

Check 'Issue scan complete' ($true) "$issueCount issue files found"

# --- Parse issues ---

$issues = @()

foreach ($f in $issueFiles) {
    $content = Get-Content $f.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }

    $issue = @{
        File = $f.Name
        Id = ''
        Title = ''
        Priority = 'P3'
        Status = 'Open'
        Reporter = ''
        Date = ''
    }

    # Parse title from first heading
    if ($content -match '^#\s+(?:ISSUE-(\d+):?\s*)?(.+)') {
        $issue.Id = if ($Matches[1]) { "ISSUE-$($Matches[1])" } else { $f.BaseName }
        $issue.Title = $Matches[2].Trim()
    } else {
        $issue.Id = $f.BaseName
        $issue.Title = $f.BaseName
    }

    # Parse priority
    if ($content -match 'Priority:\s*(P[0-3])') {
        $issue.Priority = $Matches[1]
    }

    # Auto-classify by keywords if no explicit priority
    if ($content -notmatch 'Priority:') {
        if ($content -match 'crash|data loss|security|CRITICAL') {
            $issue.Priority = 'P0'
        } elseif ($content -match 'non-functional|broken|fails|cannot') {
            $issue.Priority = 'P1'
        } elseif ($content -match 'slow|degraded|workaround|cosmetic') {
            $issue.Priority = 'P2'
        } else {
            $issue.Priority = 'P3'
        }
    }

    # Parse status
    if ($content -match 'Status:\s*(Open|In Progress|Fixed|Won''t Fix|Duplicate)') {
        $issue.Status = $Matches[1]
    }

    # Parse reporter
    if ($content -match 'Reporter:\s*(.+)') {
        $issue.Reporter = $Matches[1].Trim()
    }

    # Parse date
    if ($content -match 'Date:\s*(\d{4}-\d{2}-\d{2})') {
        $issue.Date = $Matches[1]
    }

    $issues += $issue
}

# --- Sort by priority then date ---

$sorted = $issues | Sort-Object @{Expression={
    switch ($_.Priority) {
        'P0' { 0 }
        'P1' { 1 }
        'P2' { 2 }
        'P3' { 3 }
        default { 4 }
    }
}}, @{Expression={ $_.Date }}

# --- Generate backlog markdown ---

$md = @()
$md += "# KAIRO DESKTOP - Beta Backlog"
$md += ""
$md += "Last Updated: $timestamp"
$md += "Total Issues: $issueCount"
$md += ""

# Summary counts
$p0Open = @($sorted | Where-Object { $_.Priority -eq 'P0' -and $_.Status -eq 'Open' }).Count
$p1Open = @($sorted | Where-Object { $_.Priority -eq 'P1' -and $_.Status -eq 'Open' }).Count
$p2Open = @($sorted | Where-Object { $_.Priority -eq 'P2' -and $_.Status -eq 'Open' }).Count
$p3Open = @($sorted | Where-Object { $_.Priority -eq 'P3' -and $_.Status -eq 'Open' }).Count
$fixed = @($sorted | Where-Object { $_.Status -eq 'Fixed' }).Count
$inProgress = @($sorted | Where-Object { $_.Status -eq 'In Progress' }).Count

$md += "## Summary"
$md += ""
$md += "| Priority | Open | In Progress | Fixed | Total |"
$md += "|----------|------|-------------|-------|-------|"
$md += "| P0 - Critical | $p0Open | $(@($sorted | Where-Object { $_.Priority -eq 'P0' -and $_.Status -eq 'In Progress' }).Count) | $(@($sorted | Where-Object { $_.Priority -eq 'P0' -and $_.Status -eq 'Fixed' }).Count) | $(@($sorted | Where-Object { $_.Priority -eq 'P0' }).Count) |"
$md += "| P1 - High | $p1Open | $(@($sorted | Where-Object { $_.Priority -eq 'P1' -and $_.Status -eq 'In Progress' }).Count) | $(@($sorted | Where-Object { $_.Priority -eq 'P1' -and $_.Status -eq 'Fixed' }).Count) | $(@($sorted | Where-Object { $_.Priority -eq 'P1' }).Count) |"
$md += "| P2 - Medium | $p2Open | $(@($sorted | Where-Object { $_.Priority -eq 'P2' -and $_.Status -eq 'In Progress' }).Count) | $(@($sorted | Where-Object { $_.Priority -eq 'P2' -and $_.Status -eq 'Fixed' }).Count) | $(@($sorted | Where-Object { $_.Priority -eq 'P2' }).Count) |"
$md += "| P3 - Low | $p3Open | $(@($sorted | Where-Object { $_.Priority -eq 'P3' -and $_.Status -eq 'In Progress' }).Count) | $(@($sorted | Where-Object { $_.Priority -eq 'P3' -and $_.Status -eq 'Fixed' }).Count) | $(@($sorted | Where-Object { $_.Priority -eq 'P3' }).Count) |"
$md += ""

# Health assessment
$healthStatus = 'GREEN'
$healthReason = '0 open P0, <= 2 open P1'
if ($p0Open -gt 0) {
    $healthStatus = 'RED'
    $healthReason = "$p0Open open P0 bug(s) - immediate action required"
} elseif ($p1Open -ge 3) {
    $healthStatus = 'AMBER'
    $healthReason = "$p1Open open P1 bugs - elevated risk"
} elseif ($p1Open -ge 1) {
    $healthStatus = 'AMBER'
    $healthReason = "$p1Open open P1 bug(s) - monitor closely"
}

$md += "## Beta Health: $healthStatus"
$md += ""
$md += "$healthReason"
$md += ""

# Exit criteria check
$md += "## Exit Criteria Status"
$md += ""
$md += "| Criterion | Status | Detail |"
$md += "|-----------|--------|--------|"
$md += "| P0 bugs = 0 | $(if ($p0Open -eq 0) { 'PASS' } else { 'FAIL' }) | $p0Open open P0 |"
$md += "| P1 bugs <= 2 | $(if ($p1Open -le 2) { 'PASS' } else { 'FAIL' }) | $p1Open open P1 |"
$md += "| All P1 mitigated | _manual_ | check workarounds documented |"
$md += "| Smoke pass rate >= 80% | _manual_ | check per-tester checklists |"
$md += "| 2+ distinct machines | _manual_ | check evidence reports |"
$md += ""

if ($issueCount -eq 0) {
    $md += "> No issue files found in ``docs/beta/issues/``."
    $md += ""
    $md += "## How to Add Issues"
    $md += ""
    $md += "Create markdown files in ``docs/beta/issues/`` with this format:"
    $md += ""
    $md += '```markdown'
    $md += "# ISSUE-001: Short description"
    $md += ""
    $md += "Priority: P1"
    $md += "Status: Open"
    $md += "Reporter: John"
    $md += "Date: 2026-03-01"
    $md += ""
    $md += "Detailed description of the issue..."
    $md += '```'
} else {
    # Full issue table
    $md += "## All Issues"
    $md += ""
    $md += "| ID | Title | Priority | Status | Reporter | Date | File |"
    $md += "|----|-------|----------|--------|----------|------|------|"

    foreach ($i in $sorted) {
        $md += "| $($i.Id) | $($i.Title) | $($i.Priority) | $($i.Status) | $($i.Reporter) | $($i.Date) | $($i.File) |"
    }
}

$md += ""
$md += "---"
$md += ""
$md += "_Generated by ``classify-beta-issues.ps1`` at $timestamp._"

# --- Write backlog ---

($md -join "`n") | Out-File -FilePath $backlogPath -Encoding UTF8

$backlogExists = Test-Path $backlogPath
Check 'Backlog written' $backlogExists $backlogPath

if ($backlogExists) {
    $backlogSize = (Get-Item $backlogPath).Length
    Check 'Backlog non-empty' ($backlogSize -gt 100) "$backlogSize bytes"
}

# --- Summary ---

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "PASS: $pass | FAIL: $fail" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "Issues found: $issueCount" -ForegroundColor Green
Write-Host "Backlog: $backlogPath" -ForegroundColor Green
Write-Host "Health: $healthStatus - $healthReason" -ForegroundColor $(
    switch ($healthStatus) { 'GREEN' { 'Green' } 'AMBER' { 'Yellow' } 'RED' { 'Red' } default { 'White' } }
)

if ($fail -gt 0) {
    exit 1
}

exit 0
