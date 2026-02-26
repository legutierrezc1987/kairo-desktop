# PROJECT MEMORY (Single Living Context)

Version: 3.9
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

- Active phase: Phase 3 (State + Tokens) — Sprint B complete (token persistence + accounts/settings).
- Current objective: Codex audit Sprint B, define Sprint C scope.
- Active debates: none.
- Open RFCs: none.

## Completed This Session

- Sprint B (3.3 token persistence + 3.4 accounts/settings):
  - **SessionPersistenceService** (NEW): DB-backed session CRUD — create, getActive, addTokens, archiveSession. FK constraint to projects. Session numbering via COUNT+1.
  - **AccountService** (REWRITTEN): Account CRUD with `safeStorage` encryption (DPAPI/Keychain/libsecret). Plaintext fallback with `PLAINTEXT:` prefix + console warning. API key NEVER exposed via IPC. Single-active enforcement via transaction.
  - **SettingsService** (NEW): Key/value store with UPSERT pattern. get/set/getAll/delete.
  - **settings.handlers.ts** (REWRITTEN): 8 IPC handlers (SETTINGS_GET, SETTINGS_SET, SESSION_CREATE, SESSION_GET_ACTIVE, ACCOUNT_CREATE, ACCOUNT_LIST, ACCOUNT_SET_ACTIVE, ACCOUNT_DELETE). All use `validateSender()` + type guards.
  - **IPC channels**: 25→31 (6 new: 4 account + 2 session persistence).
  - **index.ts wired**: SessionPersistenceService, AccountService, SettingsService instantiated and handlers registered.
  - **Tests**: `test_token_persistence.mjs` (45 assertions), `test_accounts_settings.mjs` (59 assertions).
  - **IPC parity test auto-scaled**: 44→50 assertions (6 new channels detected).

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Token persistence test | `node test_token_persistence.mjs` | 45/45 PASS |
| Accounts/settings test | `node test_accounts_settings.mjs` | 59/59 PASS |
| DB schema test (real service) | `node test_db_schema.mjs` | 44/44 PASS |
| Project state test (real service) | `node test_project_state.mjs` | 50/50 PASS |
| Broker adversarial test | `node test_broker.mjs` | 57/57 PASS |
| IPC parity test | `node test_ipc_negative.mjs` | 50/50 PASS |
| Approval flow test | `node test_approval.mjs` | 74/74 PASS |
| Kill switch test | `node test_kill_switch.mjs` | 66/66 PASS |
| Sandbox path test | `node test_sandbox_paths.mjs` | 105/105 PASS |
| PTY blocked execution test | `node test_terminal_blocked_execution.mjs` | 8/8 PASS |
| TypeScript strict (web) | `npx tsc --noEmit -p tsconfig.web.json --composite false` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 115KB, preload 3KB, renderer 1041KB) |

Total: 558 assertions, all passing.

## Pending (Priority Ordered)

1. Codex audit Sprint B → promote or request fixes.
2. Define Sprint C scope (Orchestrator persistence linkage, Gemini gateway account integration).
3. Resolve Gemini API quota for full live chat testing (billing/project action).
4. MCP provider package resolution checkpoint (deferred fallback still active).

## Known Risks

- Gemini generateContent quota remains at zero for current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY on Windows emits "AttachConsole failed" on proc.kill() — noise only, no functional impact.
- `better-sqlite3` ABI: `npm rebuild better-sqlite3` for system Node tests; `electron-builder install-app-deps` for Electron runtime. Dual-rebuild pattern documented.
- `safeStorage` not available in headless/test environments — PLAINTEXT fallback is traceable but not encrypted. Production Electron runtime uses OS keychain.

## Mitigations

- Gemini quota: keep as CONDITIONAL for live generation until billing/project is enabled.
- Path-with-spaces: use PowerShell for native rebuilds; avoid Git Bash for node-gyp workflows.
- MCP: keep local fallback active; handle provider decision in dedicated checkpoint.
- ConPTY noise: stderr from ConPTY agent is benign; PTY integration tests tolerate it.
- better-sqlite3 ABI: documented dual-rebuild pattern. Tests verify both paths.
- safeStorage fallback: tests verify PLAINTEXT: prefix path. Production uses real OS encryption.

## Next Step (Exact)

Sprint B complete. Codex audits Sprint B output and defines Sprint C scope.

## Next Owner

- Codex (orchestrator): audit Sprint B, define Sprint C scope.
- Claude (implementer): standby for next implementation packet.
- Gemini (auditor): standby for next audit cycle.
