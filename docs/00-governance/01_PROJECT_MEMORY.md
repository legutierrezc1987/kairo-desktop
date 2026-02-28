# PROJECT MEMORY (Single Living Context)

Version: 3.17
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

- Active phase: Phase 4 (Memory + MCP) — Sprint C (Streaming Chat E2E) sealed.
- Sealed commits: `326071a` (Sprint A hardening), `3c5799c` (Sprint B + stabilization), `756ad33` (Sprint C streaming e2e).
- Current objective: Define Phase 4 Sprint D scope (cut pipeline integration).
- Active debates: none.
- Open RFCs: none.
- IPC channels: 38 (`CHAT_STREAM_CHUNK` added, `CHAT_ABORT` wired).

## Completed This Session

- **Phase 4 Sprint C v2** (Streaming Chat E2E) implemented:
  - Main-owned history only (`chatHistory` in orchestrator). Renderer sends `{ content, model? }` only.
  - Streaming gateway via `startChat(...).sendMessageStream(...)` + abort support.
  - Single-flight concurrency guard (`_isStreaming`) with deterministic overlap rejection.
  - Idempotent `CHAT_ABORT` behavior (`aborted:true|false`).
  - Lifecycle cleanup: abort on `requestArchive`, `setActiveProject`, `shutdown`.
  - Token accounting authoritative on completion only (`usageMetadata` final response).
  - P1 zombie-stream fix: terminal error chunk (`done:true`, `error`) emitted and renderer clears streaming state.
  - Renderer streaming UX: live deltas, stop button, no static "Thinking..." lock.
- **Cross-audit status**:
  - Claude reports implementation complete (GO).
  - Gemini audit: GO incondicional.
  - Codex independent verification run locally on full battery.

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Broker test | `node tests/test_broker.mjs` | 57/57 PASS |
| Approval test | `node tests/test_approval.mjs` | 74/74 PASS |
| PTY blocked test | `node tests/test_terminal_blocked_execution.mjs` | 8/8 PASS |
| Kill switch test | `node tests/test_kill_switch.mjs` | 66/66 PASS |
| Sandbox paths test | `node tests/test_sandbox_paths.mjs` | 105/105 PASS |
| DB schema test | `node tests/test_db_schema.mjs` | 44/44 PASS |
| Project state test | `node tests/test_project_state.mjs` | 56/56 PASS |
| Token persistence test | `node tests/test_token_persistence.mjs` | 45/45 PASS |
| Accounts/settings test | `node tests/test_accounts_settings.mjs` | 59/59 PASS |
| Integration layer test | `node tests/test_integration_layer.mjs` | 64/64 PASS |
| Session archive test | `node tests/test_session_archive.mjs` | 22/22 PASS |
| IPC parity test | `node tests/test_ipc_negative.mjs` | 57/57 PASS |
| Memory hardening test | `node tests/test_memory_hardening.mjs` | 71/71 PASS |
| MCP process test | `node tests/test_mcp_process.mjs` | 41/41 PASS |
| Memory provider test | `node tests/test_memory_provider.mjs` | 61/61 PASS |
| Renderer Sprint B test | `node tests/test_renderer_sprint_b.mjs` | 114/114 PASS |
| Renderer bridge guard test | `node tests/test_renderer_bridge_guard.mjs` | 44/44 PASS |
| Streaming gateway test (NEW) | `node tests/test_streaming_gateway.mjs` | 40/40 PASS |
| Chat history test (NEW) | `node tests/test_chat_history.mjs` | 38/38 PASS |
| Renderer streaming test (NEW) | `node tests/test_renderer_streaming.mjs` | 34/34 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 154KB, preload 3KB, renderer 1074KB) |

Total: 1100 assertions, all passing (20 test files, 0 failures).

## Pending (Priority Ordered)

1. Define Phase 4 Sprint D scope (full 12-step cut pipeline + prompt/tooling foundation).
2. Resolve Gemini API quota for real streaming smoke test (billing/project action).
3. MCP provider package resolution checkpoint (fallback still active).
4. Clean scratch untracked artifacts from working tree (`diff*.txt`, `*_diff.txt`, bundle, audit scratch test).

## Known Risks

- Gemini API abort is client-side; aborted requests may still consume provider-side tokens.
- Gemini generateContent quota remains zero in current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY "AttachConsole failed" noise persists in tests; non-blocking.
- `better-sqlite3`/`node-pty` ABI dual-rebuild workflow remains required between Node tests and Electron runtime.
- `safeStorage` unavailable in headless test environments (`PLAINTEXT:` fallback path).

## Mitigations

- Keep live-provider tests conditional until quota/billing enabled.
- Use PowerShell-native rebuild flow for Windows ABI swaps.
- Keep local memory fallback active until MCP package checkpoint resolves.
- Treat ConPTY attach failures as non-blocking test noise (already tolerated in suite).
- Maintain documented dual-rebuild runbook for Node/Electron contexts.
- Preserve bridge-guard pattern (`hasKairoApi`/`getKairoApiOrThrow`) for renderer IPC safety.

## Next Step (Exact)

Codex issues Sprint D scope packet to Claude, then Gemini audits it for GO/NO-GO before implementation.

## Next Owner

- Codex (orchestrator): frame Sprint D scope packet and synthesize tribunal verdict.
- Claude (implementer): standby for Sprint D implementation packet.
- Gemini (auditor): standby for Sprint D scope audit.
