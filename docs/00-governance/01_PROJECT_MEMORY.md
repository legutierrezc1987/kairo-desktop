# PROJECT MEMORY (Single Living Context)

Version: 3.8
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

- Active phase: Phase 3 (State + Tokens) — Sprint A sealed (post-audit hardening complete).
- Current objective: Define Sprint B scope (3.3 token persistence + 3.4 accounts/settings).
- Active debates: none.
- Open RFCs: none.

## Completed This Session

- Sprint A hardening (post-audit):
  - **ProjectService folder validation hardened**: `realpathSync()` + `accessSync(R_OK | W_OK)` replace simple `existsSync()`. Resolves symlinks and validates read/write permissions before storing path.
  - **test_db_schema.mjs rewritten**: Uses real `DatabaseService` compiled via esbuild (no regex SQL extraction). 44 assertions against real service instance.
  - **test_project_state.mjs rewritten**: Uses real `ProjectService` + `DatabaseService` compiled via esbuild (no JS replica). 50 assertions against real service instances.
  - **Anti-flakiness**: Robust temp dir cleanup with retry/backoff for Windows EBUSY/EPERM.
  - **Source cross-verification demoted to complementary** (no longer the primary test axis).

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| DB schema test (real service) | `node test_db_schema.mjs` | 44/44 PASS |
| Project state test (real service) | `node test_project_state.mjs` | 50/50 PASS |
| Broker adversarial test | `node test_broker.mjs` | 57/57 PASS |
| IPC parity test | `node test_ipc_negative.mjs` | 44/44 PASS |
| Approval flow test | `node test_approval.mjs` | 74/74 PASS |
| Kill switch test | `node test_kill_switch.mjs` | 66/66 PASS |
| Sandbox path test | `node test_sandbox_paths.mjs` | 105/105 PASS |
| PTY blocked execution test | `node test_terminal_blocked_execution.mjs` | 8/8 PASS |
| TypeScript strict (web) | `npx tsc --noEmit -p tsconfig.web.json --composite false` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 97KB, preload 2KB, renderer 1041KB) |

Total: 448 assertions, all passing.

## Pending (Priority Ordered)

1. Define Sprint B scope: 3.3 token persistence + 3.4 accounts/settings.
2. Resolve Gemini API quota for full live chat testing (billing/project action).
3. MCP provider package resolution checkpoint (deferred fallback still active).

## Known Risks

- Gemini generateContent quota remains at zero for current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY on Windows emits "AttachConsole failed" on proc.kill() — noise only, no functional impact.
- `better-sqlite3` ABI: `npm rebuild better-sqlite3` for system Node tests; `electron-builder install-app-deps` for Electron runtime. Dual-rebuild pattern documented.

## Mitigations

- Gemini quota: keep as CONDITIONAL for live generation until billing/project is enabled.
- Path-with-spaces: use PowerShell for native rebuilds; avoid Git Bash for node-gyp workflows.
- MCP: keep local fallback active; handle provider decision in dedicated checkpoint.
- ConPTY noise: stderr from ConPTY agent is benign; PTY integration tests tolerate it.
- better-sqlite3 ABI: documented dual-rebuild pattern. Tests verify both paths.

## Next Step (Exact)

Sprint A sealed (post-audit hardening complete). Codex defines Sprint B scope (3.3 + 3.4).

## Next Owner

- Codex (orchestrator): define Sprint B scope and prepare work packets.
- Claude (implementer): standby for next implementation packet.
- Gemini (auditor): standby for next audit cycle.
