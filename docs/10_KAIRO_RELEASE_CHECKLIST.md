# KAIRO DESKTOP — Release Checklist

Version: 1.0
Date: 2026-03-01
Author: [Proposed: Claude]

## Purpose

GO/NO-GO matrix for releasing Kairo Desktop builds. Used before distributing any installer or unpacked build.

## Build Commands

All commands run from `Kairo_Desktop/` directory.

```bash
# 1. TypeScript strict check
npx tsc --noEmit

# 2. Bundle (main + preload + renderer)
npx electron-vite build

# 3. Native module rebuild (PowerShell only)
node scripts/rebuild-native.js

# 4. Unpacked build (for local testing)
npm run build:unpack

# 5. Windows installer (.exe)
npm run build:win
```

## Artifact Verification

After `npm run build:win`, verify artifacts exist:

```powershell
# Installer
Get-Item dist/kairo-desktop-*-setup.exe | Select-Object Name, Length

# Unpacked executable
Get-Item dist/win-unpacked/kairo-desktop.exe | Select-Object Name, Length

# Native modules in asar.unpacked
Get-ChildItem dist/win-unpacked/resources/app.asar.unpacked -Recurse -Filter "*.node" |
  Select-Object FullName, Length
```

### SHA256 Hash

```powershell
Get-FileHash dist/kairo-desktop-*-setup.exe -Algorithm SHA256 | Format-List
```

Record the hash in PROJECT_MEMORY for each sealed build.

### Expected Artifacts (v0.1.0)

| Artifact | Expected Size | Required |
|----------|--------------|----------|
| `kairo-desktop-0.1.0-setup.exe` | ~105 MB | YES |
| `dist/win-unpacked/kairo-desktop.exe` | ~190 MB | YES |
| `app.asar.unpacked/**/better_sqlite3.node` | ~2.5 MB | YES |
| `app.asar.unpacked/**/pty.node` | ~100 KB | YES |
| `app.asar.unpacked/**/conpty.node` | ~200 KB | YES |
| `app.asar.unpacked/**/conpty_console_list.node` | ~100 KB | YES |

## GO/NO-GO Matrix

### Gate 1: Code Quality

| Check | Command | GO Criterion | NO-GO |
|-------|---------|-------------|-------|
| TypeScript strict | `npx tsc --noEmit` | exit 0 | Any type error |
| electron-vite build | `npx electron-vite build` | 3 targets built | Build failure |
| Test suite | `node tests/test_*.mjs` (all 30 files) | 1862/1862 PASS | Any failure |

### Gate 2: Packaging

| Check | Command | GO Criterion | NO-GO |
|-------|---------|-------------|-------|
| Unpacked build | `npm run build:unpack` | `dist/win-unpacked/` created | Build failure |
| Installer build | `npm run build:win` | `.exe` created in `dist/` | Build failure |
| Native modules | Check `app.asar.unpacked/**/*.node` | All 4 `.node` files present | Missing native binaries |
| SHA256 recorded | Hash in PROJECT_MEMORY | Hash matches build | Hash mismatch |

### Gate 3: Functional (Manual Smoke Test)

| Check | Method | GO Criterion | NO-GO |
|-------|--------|-------------|-------|
| Install | Run setup.exe on clean Windows | Installs without error | Installer crash |
| Launch | Open from desktop shortcut | Window renders, no crash | Crash on launch |
| Settings | Enter API key | Key saved, settings panel works | Settings broken |
| Chat | Send message | Streaming response received | No response / crash |
| Terminal | Run `dir` | Output displayed | Terminal non-functional |
| Editor | Open file | File content displayed | Editor blank / crash |
| Kill switch | Trigger emergency stop | Processes stopped, session archived | Kill fails or data loss |

### Gate 4: Documentation

| Check | Method | GO Criterion | NO-GO |
|-------|--------|-------------|-------|
| Setup guide | `docs/08_KAIRO_SETUP_GUIDE.md` | Installer section complete | Missing |
| Onboarding | `docs/09_KAIRO_ONBOARDING_BETA.md` | Quickstart + checklist complete | Missing |
| Release checklist | `docs/10_KAIRO_RELEASE_CHECKLIST.md` | This file exists and is current | Missing |
| PROJECT_MEMORY | `docs/00-governance/01_PROJECT_MEMORY.md` | Updated with build hash + status | Stale |

### Gate 5: Security

| Check | Method | GO Criterion | NO-GO |
|-------|--------|-------------|-------|
| No hardcoded secrets | `grep -r "GEMINI_API_KEY\|sk-\|AIza" src/` | Zero matches | Hardcoded key found |
| Sandbox enforced | Test `rm /etc/passwd` in terminal | Blocked (red zone) | Allowed |
| Workspace bound | Test file ops outside project folder | Rejected | Escape possible |
| IPC whitelist | `test_ipc_negative.mjs` | 60/60 PASS | Any bypass |

## Release Decision

| Verdict | Condition |
|---------|-----------|
| **GO** | All gates 1-5 pass |
| **CONDITIONAL GO** | Gates 1-2 pass, Gate 3 has minor issues documented in Known Limitations |
| **NO-GO** | Any gate fails without documented mitigation |

## Rollback Procedure

If a released build has critical issues:

### For End Users

1. Uninstall via Windows Settings > Apps > "Kairo Desktop".
2. Optionally remove app data: `%APPDATA%/kairo-desktop/`.
3. Install the previous known-good version (if available).

### For Developers

1. Identify the last known-good commit from PROJECT_MEMORY sealed commits list.
2. Check out that commit:
   ```bash
   git checkout <commit-hash> -- Kairo_Desktop/
   ```
3. Rebuild:
   ```bash
   cd Kairo_Desktop
   npm install
   node scripts/rebuild-native.js
   npm run build:win
   ```
4. Distribute the rebuilt installer.

### Data Safety

- User projects and memory files are stored in user-selected workspace folders, not inside the app installation directory. Uninstalling does not delete project data.
- Session history is stored in SQLite at `%APPDATA%/kairo-desktop/`. This persists across installs unless manually deleted.
- API keys are encrypted via Windows DPAPI (`safeStorage`). They are stored in `%APPDATA%/kairo-desktop/` and persist across reinstalls.

## Version History

| Version | Date | Installer | SHA256 (first 8) | Commit |
|---------|------|-----------|-------------------|--------|
| 0.1.0 | 2026-03-01 | `kairo-desktop-0.1.0-setup.exe` (105.71 MB) | F584B8DA | `37c8cbc` |
