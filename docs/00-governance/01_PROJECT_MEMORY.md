# PROJECT MEMORY (Single Living Context)

Version: 3.7
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

- Active phase: Phase 2 (OS + Security) — Sprint C + C.1 sealed (Codex GO).
- Current objective: Open next Fase 2 sprint or transition to Fase 3.
- Active debates: none.
- Open RFCs: none.

## Completed This Session

- Sprint C.1 hardening implemented:
  - **Kill-tree cross-platform**: `killProcessTree()` private method in TerminalService.
    - Windows: `taskkill /T /F /PID <pid>` — kills entire process tree forcefully.
    - POSIX: `process.kill(-pid, 'SIGKILL')` — sends SIGKILL to process group.
    - Fallback: `proc.kill()` if tree kill fails (process already exited).
    - Both `kill()` and `killAll()` delegate to `killProcessTree()`.
  - **Interpreter path guard**: `YELLOW_INTERPRETER_COMMANDS` constant in command-zones.ts.
    - Covers: `python`, `python3`, `node`, `ts-node`, `tsx`, `deno`, `bun`.
    - `validateCommandPaths()` extended: checks first path-like non-flag argument of interpreter commands against workspace boundary.
    - `python /outside/evil.py` → BLOCKED. `python ./local.py` → ALLOWED. `python -m pip` → ALLOWED (no path arg).

- Codex NO-GO remediation (5 fixes):
  1. **TS2551 fix**: `window.electron` declared in `index.d.ts` — `typecheck:web` now passes.
  2. **Universal path validation**: removed permissive return for unknown commands. ALL commands now have path-like tokens validated against workspace boundary (universal fallback).
  3. **Navigation commands**: `NAVIGATION_COMMANDS` constant (`cd`, `chdir`, `pushd`, `popd`) added to command-zones.ts. First non-flag argument validated (even bare directory names, not just path-like tokens).
  4. **GREEN+YELLOW path validation**: path validation moved BEFORE zone dispatch in execution-broker.ts. Applies to GREEN and YELLOW zones. RED skipped (already unconditionally blocked). Prevents `cd ../../` then `rm ./file` attack vector.
  5. **New tests**: 32 new assertions covering navigation bypass, universal fallback, GREEN+path broker integration, and source verification.

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Broker adversarial test | `node test_broker.mjs` | 57/57 PASS |
| IPC parity test | `node test_ipc_negative.mjs` | 41/41 PASS |
| Approval flow test | `node test_approval.mjs` | 74/74 PASS |
| PTY blocked execution test | `node test_terminal_blocked_execution.mjs` | 8/8 PASS |
| Kill switch test | `node test_kill_switch.mjs` | 66/66 PASS |
| Sandbox path test | `node test_sandbox_paths.mjs` | 105/105 PASS |
| TypeScript strict (web) | `npx tsc --noEmit -p tsconfig.web.json --composite false` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 86KB, preload 2KB, renderer 1041KB) |

Total: 351 assertions, all passing.

## Pending (Priority Ordered)

1. Resolve Gemini API quota for full live chat testing (billing/project action).
2. MCP provider package resolution checkpoint (deferred fallback still active).

## Known Risks

- Gemini generateContent quota remains at zero for current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY on Windows emits "AttachConsole failed" on proc.kill() — noise only, no functional impact.

## Mitigations

- Gemini quota: keep as CONDITIONAL for live generation until billing/project is enabled.
- Path-with-spaces: use PowerShell for native rebuilds; avoid Git Bash for node-gyp workflows.
- MCP: keep local fallback active; handle provider decision in dedicated Fase 2 checkpoint.
- ConPTY noise: stderr from ConPTY agent is benign; PTY integration tests tolerate it.

## Next Step (Exact)

Sprint C.1 sealed (Codex GO). User decides next sprint scope (Fase 2 remaining items or Fase 3 transition).

## Next Owner

- User (director): decide next sprint scope and assign work packets.
- Codex (orchestrator): prepare next sprint plan once scope is defined.
- Claude (implementer): standby for next implementation packet.
