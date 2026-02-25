# PROJECT MEMORY (Single Living Context)

Version: 3.5
Last Updated: 2026-02-25
Status: ACTIVE

## Editing Rule (MANDATORY)

THIS FILE IS A LIVE SNAPSHOT (Option B).
Overwrite current state. Remove resolved items. Do not append historical logs here.
Historical rationale belongs to DEB/RFC/governance docs and Git history.

## Scope Boundary

This file must contain only:
- current objective
- active debates/RFCs
- pending priority list
- active risks + mitigations
- exact next step + next owner

Do not duplicate full DEC or long rationale content.

## Current Snapshot

- Active phase: Phase 2 (OS + Security) — Sprint C completed, hardening C.1 in progress.
- Current objective: execute Sprint C.1 hardening (kill-tree robustness + interpreter path guard).
- Active debates: none.
- Open RFCs: none.

## Completed This Session

- Fase 2 Sprint C (2.5-2.6) implemented:
  - Kill switch `Ctrl+Shift+K` via Electron `globalShortcut` — system-wide.
  - `killAll()` returns count; `emergencyReset()` soft resets pending queue (timer alive).
  - Push event `killswitch:activated` to renderer; KillSwitch banner with 4s auto-dismiss.
  - `will-quit` handler unregisters all global shortcuts.
  - `sudo` added to RED_PATTERNS — privilege escalation always blocked.
  - `ALLOWED_SHELLS` allowlist — `spawn()` rejects non-listed shell binaries.
  - `tokenizeCommand()`, `isLikelyPath()`, `validateCommandPaths()` in workspace-sandbox.ts.
  - YELLOW file-mutation commands (`rm`, `del`, `rmdir`, `cp`, `mv`, `chmod`) path-validated against workspace.
  - Path validation wired into `broker.evaluate()` for YELLOW commands.
  - `executeApproved()` re-validates CWD before writing to PTY.
  - `write()` passes `this.workspacePath` to broker (not `instance.cwd`).
  - IPC channels: 21 → 22 (`killswitch:activated` added).

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Broker adversarial test | `node test_broker.mjs` | 57/57 PASS |
| IPC parity test | `node test_ipc_negative.mjs` | 41/41 PASS |
| Approval flow test | `node test_approval.mjs` | 74/74 PASS |
| PTY blocked execution test | `node test_terminal_blocked_execution.mjs` | 8/8 PASS |
| Kill switch test | `node test_kill_switch.mjs` | 60/60 PASS |
| Sandbox path test | `node test_sandbox_paths.mjs` | 46/46 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 83KB, preload 2KB, renderer 1041KB) |

## Pending (Priority Ordered)

1. Sprint C.1 hardening: kill-tree cross-platform (`taskkill /T /F` on Windows, process group on POSIX).
2. Sprint C.1 hardening: extend `validateCommandPaths` for interpreter commands with file targets (e.g., `python /outside/script.py`).
3. Resolve Gemini API quota for full live chat testing (billing/project action).
4. MCP provider package resolution checkpoint (deferred fallback still active).

## Known Risks

- `proc.kill()` on Windows only kills the shell, not child processes spawned by the command.
- Interpreter commands (`python`, `node`) can target files outside workspace without path validation.
- Gemini generateContent quota remains at zero for current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY on Windows emits "AttachConsole failed" on proc.kill() — noise only, no functional impact.

## Mitigations

- Kill-tree: Sprint C.1 adds `taskkill /T /F` on Windows and process group kill on POSIX.
- Interpreter paths: Sprint C.1 extends path validation to interpreter file targets.
- Gemini quota: keep as CONDITIONAL for live generation until billing/project is enabled.
- Path-with-spaces: use PowerShell for native rebuilds; avoid Git Bash for node-gyp workflows.
- MCP: keep local fallback active; handle provider decision in dedicated Fase 2 checkpoint.
- ConPTY noise: stderr from ConPTY agent is benign; PTY integration tests tolerate it.

## Next Step (Exact)

Claude implements Sprint C.1 hardening: kill-tree + interpreter path guard. Revalidate all 8 checks.

## Next Owner

- Claude (implementer): execute Sprint C.1 hardening and revalidate.
- Gemini (auditor): audit kill-tree safety and extended path guard.
- User (director): validate hardening completeness.
