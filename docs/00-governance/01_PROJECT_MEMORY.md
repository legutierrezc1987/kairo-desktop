# PROJECT MEMORY (Single Living Context)

Version: 3.14
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

- Active phase: Phase 4 (Memory + MCP) — Sprint A Hardening + root path hotfix complete.
- Current objective: Await Codex for Phase 4 Sprint A commit + next scope definition.
- Active debates: none.
- Open RFCs: none.

## Completed This Session

- **Phase 4 Sprint A Hardening** (Memory/MCP security):
  - **Workspace binding**: `MemoryService.updateWorkspace()` rebinds sandbox to active project `folderPath`. When MCP was active, forces degradation to local-markdown (zero cross-project leakage). Wired via `registerProjectHandlers` callback in `index.ts`.
  - **Sandbox path validation**: `isInsideWorkspace()` uses `relative()` + `isAbsolute()` + `sep` boundary check. Prevents sibling prefix attack (`/my-app` vs `/my-app-evil`). Root workspace edge case (`C:\` or `/`) handled via `wsPrefix` normalization.
  - **Payload limits**: `MEMORY_QUERY_MAX_LENGTH=2000`, `MEMORY_MAX_RESULTS_MIN=1`, `MEMORY_MAX_RESULTS_MAX=50`. Whitespace-only query rejection. `sanitizeMaxResults()` clamps NaN/Infinity/out-of-range.
  - **MCP buffer cap**: `MCP_STDOUT_BUFFER_MAX_BYTES=1MB`. Overflow kills process, rejects pending requests, triggers crash→restart cycle.
  - **IPC handler hardening**: `memory.handlers.ts` validates types, null bytes, finiteness, length limits at gate level.
  - **Tests**: `test_memory_hardening.mjs` — 71 assertions (T01-T11: sibling attack, traversal, boundary, query limits, maxResults sanitization, buffer cap, MCP degradation, local-only workspace change, null byte, source cross-verification, root workspace rejection).
- **Root path hotfix** (DEC-025 hardening):
  - `ProjectService.createProject()`: rejects filesystem root paths (`C:\`, `D:\`, `/`) with deterministic error. Uses `parse()` to detect root — checks both canonical and resolved real path (symlink defense).
  - `MemoryService.updateWorkspace()`: throws for root paths before any state mutation. Workspace remains unchanged on rejection.
  - Tests: `test_project_state.mjs` 50→56 assertions (T09b root rejection + T10l/T10m source cross-verification).

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Memory hardening test | `node tests/test_memory_hardening.mjs` | 71/71 PASS |
| MCP process test | `node tests/test_mcp_process.mjs` | 41/41 PASS |
| Memory provider test | `node tests/test_memory_provider.mjs` | 61/61 PASS |
| IPC parity test | `node tests/test_ipc_negative.mjs` | 54/54 PASS |
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
| Electron-vite build | `npx electron-vite build` | PASS (main 151KB, preload 3KB, renderer 1042KB) |

Total: 805 assertions, all passing (794 prior + 11 new from root path hotfix).

## Pending (Priority Ordered)

1. Phase 4 Sprint A commit (Codex orchestrator).
2. Define Phase 4 Sprint B scope (UI layer, live chat end-to-end).
3. Resolve Gemini API quota for full live chat testing (billing/project action).
4. MCP provider package resolution checkpoint (deferred fallback still active).

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

Phase 4 Sprint A Hardening complete. Awaiting Codex for commit + next scope definition.

## Next Owner

- Codex (orchestrator): commit Sprint A Hardening, define Phase 4 Sprint B scope.
- Claude (implementer): standby for next implementation packet.
- Gemini (auditor): standby for next audit cycle.
