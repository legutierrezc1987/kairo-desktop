# PROJECT MEMORY (Single Living Context)

Version: 3.16
Last Updated: 2026-02-28
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

- Active phase: Phase 4 (Memory + MCP) — Sprint B (UI + Wiring + runtime stabilization) complete.
- Current objective: Commit Sprint B + stabilization patch, then define Sprint C scope.
- Active debates: none.
- Open RFCs: none.

## Completed This Session

- **Phase 4 Sprint B** (UI layer + live chat wiring):
  - **Stores**: `projectStore.ts` (Zustand: projects[], activeProject, isLoading, error) + `sessionStore.ts` (dbSession, sessionState, budgetState, isArchiving).
  - **Hooks**: `useProject.ts` (createProject, loadProject, selectFolder; fetches project list on mount) + `useSession.ts` (archiveSession; polls SESSION_GET_STATE + TOKEN_GET_BUDGET every 5s).
  - **IPC channels**: 35→37. Added `SESSION_ARCHIVE` (manual consolidation via orchestrator.requestArchive) + `APP_SELECT_FOLDER` (native dialog.showOpenDialog).
  - **Types**: Added `SessionArchiveRequest`, `SessionArchiveResponse`, `SelectFolderResponse`.
  - **Backend handlers** (index.ts): `session:archive` validates CutReason via whitelist, defaults to 'manual'. `app:select-folder` validates sender, returns `{ folderPath: string | null }`.
  - **ProjectManager** (full rewrite): project list, create form with native folder picker, active project highlight, loadProject on click.
  - **AccountManager**: CRUD for API accounts (create/list/setActive/delete), password-type input for API key.
  - **SettingsPanel**: modal overlay (z-index 1000), renders AccountManager.
  - **StatusBar**: shows active project name, turn count, token usage % with color coding (green/yellow/red).
  - **ConsolidateButton**: manual session archive, disabled when archiving, only visible when project active.
  - **RecallButton**: memory:query popover (maxResults=3), search input, result list with relevance %, absolute positioning.
  - **MainLayout wiring**: StatusBar (left) + SettingsPanel + ModeToggle (right) in top bar.
  - **ChatPanel wiring**: ConsolidateButton in header, RecallButton as popover near input.
  - **App.tsx**: optional `last_project_id` restore from settings on startup (best-effort).
  - **Tests**: `test_renderer_sprint_b.mjs` (114 assertions) + `test_session_archive.mjs` (22 assertions). IPC negative auto-gained 2 assertions (56 total).

- **Sprint B Stabilization** (runtime bootstrap reliability):
  - Added renderer IPC bridge guard module (`hasKairoApi`, `getKairoApiOrThrow`) and migrated hooks/components away from direct `window.kairoApi` calls.
  - Added app fallback UI for missing bridge and race-safe project restore guard.
  - Hardened main startup with preflight guards (`ELECTRON_RUN_AS_NODE`, missing app module).
  - Added lazy import of `DatabaseService` with startup `try/catch` to surface deterministic error dialog on native module boot failures.
  - Added `scripts/dev-electron-vite.cjs` and switched `npm run dev` to clear `ELECTRON_RUN_AS_NODE` before launching Electron.
  - Added `test_renderer_bridge_guard.mjs` (44 assertions).

- **Manual runtime smoke test (Windows/Electron dev)**:
  - Electron window booted successfully after explicit native rebuild for Electron ABI 133 (`better-sqlite3`, `node-pty`).
  - Renderer, terminal panel, sidebar, settings entrypoint, and status shell visible without `window.kairoApi` crash cascade.
  - Expected runtime status observed: no API key configured yet, broker in supervised mode, memory provider on local fallback.

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Renderer Sprint B test (NEW) | `node tests/test_renderer_sprint_b.mjs` | 114/114 PASS |
| Renderer bridge guard test (NEW) | `node tests/test_renderer_bridge_guard.mjs` | 44/44 PASS |
| Session archive test (NEW) | `node tests/test_session_archive.mjs` | 22/22 PASS |
| Memory hardening test | `node tests/test_memory_hardening.mjs` | 71/71 PASS |
| MCP process test | `node tests/test_mcp_process.mjs` | 41/41 PASS |
| Memory provider test | `node tests/test_memory_provider.mjs` | 61/61 PASS |
| IPC parity test | `node tests/test_ipc_negative.mjs` | 56/56 PASS |
| Integration layer test | `node tests/test_integration_layer.mjs` | 64/64 PASS |
| Token persistence test | `node tests/test_token_persistence.mjs` | 45/45 PASS |
| Accounts/settings test | `node tests/test_accounts_settings.mjs` | 59/59 PASS |
| DB schema test (real service) | `node tests/test_db_schema.mjs` | 44/44 PASS |
| Project state test (real service) | `node tests/test_project_state.mjs` | 56/56 PASS |
| Broker adversarial test | `node tests/test_broker.mjs` | 57/57 PASS |
| Approval flow test | `node tests/test_approval.mjs` | 74/74 PASS |
| Kill switch test | `node tests/test_kill_switch.mjs` | 66/66 PASS |
| Sandbox path test | `node tests/test_sandbox_paths.mjs` | 105/105 PASS |
| PTY blocked execution test | `node tests/test_terminal_blocked_execution.mjs` | 8/8 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 148KB + lazy chunk 6KB, preload 3KB, renderer 1071KB) |

Total: 987 assertions, all passing (943 prior + 44 new).

## Pending (Priority Ordered)

1. Phase 4 Sprint B + stabilization commit (Codex orchestrator).
2. Define Phase 4 Sprint C scope (live chat E2E, streaming, advanced features).
3. Resolve Gemini API quota for full live chat testing (billing/project action).
4. MCP provider package resolution checkpoint (deferred fallback still active).

## Known Risks

- Gemini generateContent quota remains at zero for current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY on Windows emits "AttachConsole failed" on proc.kill() — noise only, no functional impact.
- `better-sqlite3` ABI: `npm rebuild better-sqlite3` for system Node tests; `electron-builder install-app-deps` for Electron runtime. Dual-rebuild pattern documented.
- `ELECTRON_RUN_AS_NODE` can be injected by shell/process context and prevent startup if not sanitized.
- npm runtime override vars (`npm_config_runtime`, `npm_config_target`, `npm_config_disturl`, `npm_config_build_from_source`) can remain in session and produce noisy warnings if not cleared.
- `safeStorage` not available in headless/test environments — PLAINTEXT fallback is traceable but not encrypted. Production Electron runtime uses OS keychain.
- `handleChatMessage` integration now testable via shimmed gateway (mock generateContent/countTokens). Full E2E still requires Gemini quota.

## Mitigations

- Gemini quota: keep as CONDITIONAL for live generation until billing/project is enabled.
- Path-with-spaces: use PowerShell for native rebuilds; avoid Git Bash for node-gyp workflows.
- MCP: keep local fallback active; handle provider decision in dedicated checkpoint.
- ConPTY noise: stderr from ConPTY agent is benign; PTY integration tests tolerate it.
- better-sqlite3 ABI: documented dual-rebuild pattern. Tests verify both paths.
- Dev launcher sanitizes environment (`npm run dev` now clears `ELECTRON_RUN_AS_NODE` before spawning Electron).
- Clear npm runtime override vars after ABI rebuild to avoid warning noise in subsequent npm commands.
- safeStorage fallback: tests verify PLAINTEXT: prefix path. Production uses real OS encryption.
- handleChatMessage integration: now tested via shimmed gateway in `test_integration_layer.mjs` and `test_session_archive.mjs`. Orchestrator lifecycle fully exercised at runtime.

## Next Step (Exact)

Commit current Sprint B + stabilization changes (manual UI smoke test already completed).

## Next Owner

- Codex (orchestrator): commit Sprint B + stabilization, then define Phase 4 Sprint C scope.
- Claude (implementer): standby for next implementation packet.
- Gemini (auditor): standby for next audit cycle.
