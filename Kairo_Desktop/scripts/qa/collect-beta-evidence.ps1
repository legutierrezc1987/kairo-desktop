# collect-beta-evidence.ps1 — Collect system + app evidence for beta triage
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/qa/collect-beta-evidence.ps1
# Run from Kairo_Desktop/ directory.
#
# Generates a timestamped text report with:
# - OS version, Node version, npm version
# - App version from package.json
# - Installer/unpacked SHA256 hashes
# - Native module presence
# - Electron + electron-builder versions
# - Log snapshots from %APPDATA%/kairo-desktop (if present)

$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$reportFile = Join-Path $root "beta-evidence-$timestamp.txt"

function Out($line) {
    $line | Out-File -FilePath $reportFile -Append -Encoding UTF8
    Write-Host $line
}

Out "=== Kairo Desktop Beta Evidence Report ==="
Out "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Out "Machine: $env:COMPUTERNAME"
Out ""

# --- OS ---
Out "--- Operating System ---"
$os = Get-CimInstance Win32_OperatingSystem
Out "OS: $($os.Caption) $($os.Version) ($($os.OSArchitecture))"
Out "Build: $($os.BuildNumber)"
Out ""

# --- Runtime ---
Out "--- Runtime Versions ---"
$nodeVer = & node --version 2>&1
Out "Node.js: $nodeVer"
$npmVer = & npm --version 2>&1
Out "npm: $npmVer"
$gitVer = & git --version 2>&1
Out "Git: $gitVer"
Out ""

# --- App Version ---
Out "--- App Version ---"
$pkgPath = Join-Path $root 'package.json'
if (Test-Path $pkgPath) {
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    Out "Name: $($pkg.name)"
    Out "Version: $($pkg.version)"
    Out "Description: $($pkg.description)"
} else {
    Out "package.json NOT FOUND at $pkgPath"
}
Out ""

# --- Electron + Builder ---
Out "--- Electron + Builder ---"
$electronPkg = Join-Path $root 'node_modules' 'electron' 'package.json'
if (Test-Path $electronPkg) {
    $ePkg = Get-Content $electronPkg -Raw | ConvertFrom-Json
    Out "Electron: $($ePkg.version)"
}
$builderPkg = Join-Path $root 'node_modules' 'electron-builder' 'package.json'
if (Test-Path $builderPkg) {
    $bPkg = Get-Content $builderPkg -Raw | ConvertFrom-Json
    Out "electron-builder: $($bPkg.version)"
}
Out ""

# --- Artifacts ---
Out "--- Build Artifacts ---"
$dist = Join-Path $root 'dist'
if (Test-Path $dist) {
    $setupExe = Get-ChildItem -Path $dist -Filter 'kairo-desktop-*-setup.exe' -ErrorAction SilentlyContinue
    if ($setupExe) {
        $size = [math]::Round($setupExe[0].Length / 1MB, 2)
        $hash = (Get-FileHash $setupExe[0].FullName -Algorithm SHA256).Hash
        Out "Installer: $($setupExe[0].Name) ($size MB)"
        Out "SHA256: $hash"
    } else {
        Out "Installer: NOT FOUND"
    }

    $unpackedExe = Join-Path $dist 'win-unpacked' 'kairo-desktop.exe'
    if (Test-Path $unpackedExe) {
        $uSize = [math]::Round((Get-Item $unpackedExe).Length / 1MB, 2)
        $uHash = (Get-FileHash $unpackedExe -Algorithm SHA256).Hash
        Out "Unpacked: kairo-desktop.exe ($uSize MB)"
        Out "SHA256: $uHash"
    } else {
        Out "Unpacked exe: NOT FOUND"
    }
} else {
    Out "dist/ directory NOT FOUND"
}
Out ""

# --- Native Modules ---
Out "--- Native Modules (app.asar.unpacked) ---"
$asarUnpacked = Join-Path $dist 'win-unpacked' 'resources' 'app.asar.unpacked'
if (Test-Path $asarUnpacked) {
    $nodes = Get-ChildItem -Path $asarUnpacked -Recurse -Filter '*.node'
    if ($nodes) {
        foreach ($n in $nodes) {
            $nKB = 1KB
            $nSize = [math]::Round($n.Length / $nKB, 1)
            Out "  $($n.Name) - $nSize KB ($($n.FullName))"
        }
    } else {
        Out "  No .node files found"
    }
} else {
    Out "  app.asar.unpacked NOT FOUND"
}
Out ""

# --- App Data / Logs ---
Out "--- App Data ---"
$appData = Join-Path $env:APPDATA 'kairo-desktop'
if (Test-Path $appData) {
    Out "App data dir: $appData"
    $files = Get-ChildItem $appData -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        $fKB = 1KB
        $fSize = [math]::Round($f.Length / $fKB, 1)
        Out "  $($f.Name) ($fSize KB)"
    }

    # Check for log files
    $logs = Get-ChildItem $appData -Filter '*.log' -Recurse -ErrorAction SilentlyContinue
    if ($logs) {
        Out ""
        Out "--- Log Tail (last 20 lines per log) ---"
        foreach ($log in $logs) {
            Out "[$($log.Name)]"
            Get-Content $log.FullName -Tail 20 | ForEach-Object { Out "  $_" }
            Out ""
        }
    }
} else {
    Out "App data dir NOT FOUND (app may not have been launched yet)"
}
Out ""

Out "=== End of Report ==="
Out "Report saved to: $reportFile"

Write-Host ""
Write-Host "Evidence report saved to: $reportFile" -ForegroundColor Green
