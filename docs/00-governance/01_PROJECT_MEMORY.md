# PROJECT MEMORY (Single Living Context)

Version: 3.12
Last Updated: 2026-02-26
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

- Active phase: Phase 3 (State + Tokens) — Sprint C post-remediation complete.
- Current objective: Define Phase 4 scope (UI layer, live chat end-to-end).
- Active debates: none.
- Open RFCs: none.

## Completed This Session

- Sprint C post-remediation (Gemini audit findings):
  - **Gateway lifecycle**: Added `resetGeminiGateway()` to clear SDK/models state. `onAccountChanged` now resolves `dbKey ?? envKey` — re-inits gateway when key exists, resets gateway when no key available. No stale state after delete/set-active without key.
  - **Integration tests rewritten**: `test_integration_layer.mjs` now instantiates **real Orchestrator** with instrumented fake `SessionPersistencePort`. Tests verify: `setActiveProject()` archives previous session, `requestArchive()` forces close, `handleChatMessage` triggers lazy session creation + token persistence (via shimmed gateway). String-search cross-verification reduced to 12 wiring-only assertions (T19).
  - **Test organization**: All 11 `test_*.mjs` files moved to `Kairo_Desktop/tests/` folder. All `__dirname` paths updated to `../` relative.
  - **Tests**: `test_integration_layer.mjs` expanded from 61 → 64 assertions (runtime Orchestrator tests + gateway lifecycle + reduced string searches).
- TS2352 hotfix: Removed redundant `AccountTier` cast in `ACCOUNT_CREATE` handler — `data.tier` accessed directly via type guard. Validated: `npm run build` PASS, `test_accounts_settings.mjs` 59/59, `test_integration_layer.mjs` 64/64.

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Integration layer test | `node tests/test_integration_layer.mjs` | 64/64 PASS |
| Token persistence test | `node tests/test_token_persistence.mjs` | 45/45 PASS |
| Accounts/settings test | `node tests/test_accounts_settings.mjs` | 59/59 PASS |
| DB schema test (real service) | `node tests/test_db_schema.mjs` | 44/44 PASS |
| Project state test (real service) | `node tests/test_project_state.mjs` | 50/50 PASS |
| Broker adversarial test | `node tests/test_broker.mjs` | 57/57 PASS |
| IPC parity test | `node tests/test_ipc_negative.mjs` | 50/50 PASS |
| Approval flow test | `node tests/test_approval.mjs` | 74/74 PASS |
| Kill switch test | `node tests/test_kill_switch.mjs` | 66/66 PASS |
| Sandbox path test | `node tests/test_sandbox_paths.mjs` | 105/105 PASS |
| PTY blocked execution test | `node tests/test_terminal_blocked_execution.mjs` | 8/8 PASS |
| TypeScript strict (web) | `npx tsc --noEmit -p tsconfig.web.json --composite false` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 120KB, preload 3KB, renderer 1041KB) |

Total: 622 assertions, all passing.

## Pending (Priority Ordered)

1. Define Phase 4 scope (UI layer, live chat end-to-end).
2. Resolve Gemini API quota for full live chat testing (billing/project action).
3. MCP provider package resolution checkpoint (deferred fallback still active).

## Known Risks

- Gemini generateContent quota remains at zero for current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY on Windows emits "AttachConsole failed" on proc.kill() — noise only, no functional impact.
- `better-sqlite3` ABI: `npm rebuild better-sqlite3` for system Node tests; `electron-builder install-app-deps` for Electron runtime. Dual-rebuild pattern documented.
- `safeStorage` not available in headless/test environments — PLAINTEXT fallback is traceable but not encrypted. Production Electron runtime uses OS keychain.
- `handleChatMessage` integration now testable via shimmed gateway (mock generateContent/countTokens). Full E2E still requires Gemini quota.

## Mitigations

- Gemini quota: keep as CONDITIONAL for live generation until billing/project is enabled.
- Path-with-spaces: use PowerShell for native rebuilds; avoid Git Bash for node-gyp workflows.
- MCP: keep local fallback active; handle provider decision in dedicated checkpoint.
- ConPTY noise: stderr from ConPTY agent is benign; PTY integration tests tolerate it.
- better-sqlite3 ABI: documented dual-rebuild pattern. Tests verify both paths.
- safeStorage fallback: tests verify PLAINTEXT: prefix path. Production uses real OS encryption.
- handleChatMessage integration: now tested via shimmed gateway in `test_integration_layer.mjs` (T04-T07). Orchestrator lifecycle fully exercised at runtime.

## Next Step (Exact)

Sprint C post-remediation complete. Define Phase 4 scope.

## Next Owner

- Codex (orchestrator): define Phase 4 scope.
- Claude (implementer): standby for next implementation packet.
- Gemini (auditor): standby for next audit cycle.
