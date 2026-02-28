# PROJECT MEMORY (Single Living Context)

Version: 3.21
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

- Active phase: Phase 5 (Recall + Consolidation + Rate-Limit) — scoped, pending implementation.
- Sealed commits: `326071a` (Sprint A hardening), `3c5799c` (Sprint B + stabilization), `756ad33` (Sprint C streaming e2e), `07831d4` (Sprint D cut-pipeline e2e).
- Current objective: Implement Phase 5 Sprint A (Recall strategy) with tribunal concurrency guards.
- Active debates: none.
- Open RFCs: none.
- IPC channels: 39 (Phase 5 scope plans +3 push channels → 42).

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
- **Phase 4 Sprint D v2** (Cut Pipeline Integration) implemented:
  - 12-step cut pipeline wired end-to-end (snapshot, local save, upload queue enqueue, bridge buffer, recall/fallback, context rebuild, UI unblock).
  - Mandatory guards enforced: `_isCutting` gate, idempotent `requestArchive`, sync-worker `Promise.race` upload timeout, async callsite timeouts (`kill switch`, `before-quit`), terminal UI state in `finally`.
  - New services: `snapshot.service.ts`, `upload-queue.service.ts`.
  - Worker implemented: `sync-worker.ts` (single-flight, timeout, retry loop).
  - UI wiring: `CUT_PIPELINE_STATE` channel + `chatStore.cutPhase` + cut overlay in `ChatPanel`.
  - Prompt scaffold implemented in `system-prompt.ts`.
- **Phase 5 scope tribunal** (design-only):
  - Claude delivered Phase 5 scope: Sprint A (Recall DEC-026), Sprint B (Consolidation DEC-022), Sprint C (Rate-limit PRD §14).
  - Gemini audit verdict: GO CONDICIONADO.
  - Mandatory implementation guards accepted for next step:
    - Consolidation lock (`_isConsolidating`) + SYNCED→CONSOLIDATING transition.
    - Recall concurrency guard aligned with single-flight chat path (no user overlap during in-flight recall).
    - Consolidation input window/token cap guard to avoid context overflow.

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
| IPC parity test | `node tests/test_ipc_negative.mjs` | 58/58 PASS |
| Memory hardening test | `node tests/test_memory_hardening.mjs` | 71/71 PASS |
| MCP process test | `node tests/test_mcp_process.mjs` | 41/41 PASS |
| Memory provider test | `node tests/test_memory_provider.mjs` | 61/61 PASS |
| Renderer Sprint B test | `node tests/test_renderer_sprint_b.mjs` | 114/114 PASS |
| Renderer bridge guard test | `node tests/test_renderer_bridge_guard.mjs` | 44/44 PASS |
| Streaming gateway test (NEW) | `node tests/test_streaming_gateway.mjs` | 40/40 PASS |
| Chat history test (NEW) | `node tests/test_chat_history.mjs` | 38/38 PASS |
| Renderer streaming test (NEW) | `node tests/test_renderer_streaming.mjs` | 34/34 PASS |
| Snapshot service test (NEW) | `node tests/test_snapshot_service.mjs` | 18/18 PASS |
| Upload queue test (NEW) | `node tests/test_upload_queue.mjs` | 23/23 PASS |
| Sync worker test (NEW) | `node tests/test_sync_worker.mjs` | 15/15 PASS |
| Cut pipeline test (NEW) | `node tests/test_cut_pipeline.mjs` | 31/31 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 172KB, preload 3KB, renderer 1076KB) |

Total: 1188 assertions validated (24 green test files, 1 known pre-existing failing scratch test: `test_audit_memory_hacks.mjs`).

## Pending (Priority Ordered)

1. Implement Phase 5 Sprint A (Recall strategy) with accepted concurrency safeguards.
2. Implement Phase 5 Sprint B (Consolidation engine) with `_isConsolidating` and durable source-state transitions.
3. Implement Phase 5 Sprint C (Rate-limit handler) with retry/backoff/fallback.
4. Resolve handling policy for `test_audit_memory_hacks.mjs` (fix, quarantine, or remove from canonical ledgers).
5. Resolve Gemini API quota for real streaming smoke test (billing/project action).
6. MCP provider package resolution checkpoint (fallback still active).
7. Clean scratch untracked artifacts from working tree (`diff*.txt`, `*_diff.txt`, bundle, audit scratch test).

## Known Risks

- Gemini API abort is client-side; aborted requests may still consume provider-side tokens.
- Gemini generateContent quota remains zero in current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY "AttachConsole failed" noise persists in tests; non-blocking.
- `better-sqlite3`/`node-pty` ABI dual-rebuild workflow remains required between Node tests and Electron runtime.
- `safeStorage` unavailable in headless test environments (`PLAINTEXT:` fallback path).
- `test_audit_memory_hacks.mjs` fails due to ESM `.ts` import resolution and remains untracked scratch.
- Consolidation race/data-loss risk if source claiming is not atomic before LLM merge.
- Recall/conversation overlap risk if recall is executed outside single-flight request path.

## Mitigations

- Keep live-provider tests conditional until quota/billing enabled.
- Use PowerShell-native rebuild flow for Windows ABI swaps.
- Keep local memory fallback active until MCP package checkpoint resolves.
- Treat ConPTY attach failures as non-blocking test noise (already tolerated in suite).
- Maintain documented dual-rebuild runbook for Node/Electron contexts.
- Preserve bridge-guard pattern (`hasKairoApi`/`getKairoApiOrThrow`) for renderer IPC safety.
- Keep `_isCutting` + idempotent cut lock + worker timeout as invariant in future refactors.
- Exclude scratch tests/artifacts from release ledgers unless promoted to canonical suite.
- Enforce `_isConsolidating` lock + atomic source-state transition for consolidation workflow.
- Keep recall execution within existing single-flight chat lifecycle; renderer input remains disabled while request is active.
- Apply bounded consolidation input window with token cap and overflow fallback path.

## Next Step (Exact)

Codex issues Phase 5 Sprint A implementation packet to Claude with mandatory guards, then Gemini audits implementation for GO/NO-GO.

## Next Owner

- Codex (orchestrator): route Sprint A implementation packet and synthesize verdict.
- Claude (implementer): implement Phase 5 Sprint A.
- Gemini (auditor): audit Sprint A implementation.
