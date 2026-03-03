# Kairo Desktop v0.1.1 — Release Notes (Hotfix)

Date: 2026-03-02
Tag: `v0.1.1`
Status: Hotfix Release
Base: `v0.1.0` (GA)
Author: [Proposed: Claude]

## Overview

Hotfix release that fixes terminal CWD (current working directory) not following the active project workspace. No new features.

## Bug Fix

### Terminal CWD/Workspace Binding

**Problem**: Terminal sessions always started in `process.cwd()` (the Electron app's launch directory) regardless of which project was active. Switching projects or creating a new project did not update the terminal's working directory.

**Root Cause**: `TerminalService` had no mechanism to receive workspace path updates. `APP_GET_CWD` always returned `process.cwd()`. `PROJECT_CREATE` did not fire `onProjectLoaded`. `TerminalPanel` was project-unaware — no subscription to project state changes.

**Fix**:
- `terminal.service.ts`: Added `updateWorkspacePath()` / `getWorkspacePath()` methods.
- `index.ts`: Mutable `activeWorkspacePath` updated on project load/create. `APP_GET_CWD` returns active workspace.
- `project.handlers.ts`: `PROJECT_CREATE` now fires `onProjectLoaded` callback.
- `TerminalPanel.tsx`: Subscribes to `projectStore`, shows "No project open" guard, respawns terminal on project switch via `key={activeProject.id}`.

**Files Modified**: 4 production files, 1 new test file.

## Additional Build Fixes

Minor TypeScript hygiene (unused imports/parameters) resolved during release packaging:
- `chat.handlers.ts`: Prefixed unused `getMainWindow` parameter with `_`.
- `sync-worker.ts`: Removed unused `readFile` import.
- `useEditor.ts`: Removed unused destructured `content` and `activeFilePath`.
- `useSettings.ts`: Removed unused `useCallback` import and `ModelId` type import.

These are zero-behavior-change cleanups required to pass `tsc --noEmit` strict mode during the release build.

## Quality Baseline

| Metric | Value |
|--------|-------|
| Automated assertions | 2206 / 0 failures |
| Test files | 38 |
| IPC channels | 49 |
| TypeScript strict | exit 0 |
| electron-vite build | PASS (main 220KB, preload 4KB, renderer 8342KB) |
| Hotfix-specific test | `test_hotfix_workspace_cwd.mjs` — 27/27 PASS |
| Regression: terminal E2E | `test_terminal_e2e.mjs` — 35/35 PASS |
| Regression: sandbox paths | `test_sandbox_paths.mjs` — 105/105 PASS |
| Open P0 bugs | 0 |
| Open P1 bugs | 0 |

## Installation

1. Download `kairo-desktop-0.1.1-setup.exe` (105.74 MB).
2. Verify SHA256: `21E1EAFFAD6D1EDAA1C4DB879A6ED43F99922E6210F6984FD4CF1C8372AF1D3E`.
3. Run installer. Click "More info" then "Run anyway" on SmartScreen warning (unsigned).
4. Launch from desktop shortcut.

## No Feature Changes

This release contains **only** the workspace/CWD binding bug fix and build hygiene. No new features, no refactors, no dependency changes.

## Version History

| Version | Date | Type | Notes |
|---------|------|------|-------|
| 0.1.1 | 2026-03-02 | Hotfix | Terminal CWD follows active project. |
| 0.1.0 | 2026-03-01 | General Availability | First GA release. |
| 0.1.0-rc1 | 2026-03-01 | Release Candidate | CONDITIONAL GO from beta. |

---

_[Proposed: Claude] -- Release Notes v0.1.1 (Hotfix)_
