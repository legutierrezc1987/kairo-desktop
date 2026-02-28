# PROJECT MEMORY (Single Living Context)

Version: 3.24
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

- Active phase: Phase 5 (Recall + Consolidation + Rate-Limit) — Sprint B COMPLETE (pending audit).
- Sealed commits: `326071a` (Sprint A hardening), `3c5799c` (Sprint B + stabilization), `756ad33` (Sprint C streaming e2e), `07831d4` (Sprint D cut-pipeline e2e), pending (Phase 5 Sprint A recall), pending (Phase 5 Sprint B consolidation).
- Current objective: Gemini audit of Sprint B consolidation engine for GO/NO-GO.
- Active debates: none.
- Open RFCs: none.
- IPC channels: 41 (`CONSOLIDATION_STATUS` added in Phase 5 Sprint B).

## Completed This Session

- **Phase 5 Sprint B** (Consolidation Engine, DEC-022) — COMPLETE:
  - `consolidation-engine.ts`: Pure function module — `shouldConsolidate()`, `executeConsolidation()`, `truncateConsolidationInput()`, `mechanicalFallback()`, `MASTER_SUMMARY_PROMPT`. Port-based architecture for testability.
  - Hard Guards enforced:
    1. `_isConsolidating` lock in SyncWorker (try/finally)
    2. Atomic source claiming — only SYNCED entries, transactional `markConsolidated()` in DB
    3. Never delete non-SYNCED — DB query filters + runtime `status === 'synced'` validation
    4. Input cap — `CONSOLIDATION_INPUT_CAP_CHARS = 80,000` chars (~20K tokens)
    5. Local files preserved — never delete `.kairo/sessions/` files on disk
  - DB schema migration v1→v2: table rebuild pattern for `upload_queue` (new `consolidated_into` column + `'consolidated'` status in CHECK constraint).
  - MemoryProvider interface extended with optional `deleteSource()`. NotebookLM provider: MCP JSON-RPC `memory/delete`. Local-markdown: graceful no-op.
  - UploadQueueService: `getSyncedSources()`, `countSynced()`, `markConsolidated()` — atomic transaction wrapping.
  - SyncWorker: `maybeConsolidate()` fire-and-forget after `markSynced()`, `_isConsolidating` guard, `ConsolidationPort` + emitter + project context setters.
  - index.ts: Built `ConsolidationPort` adapter, wired `CONSOLIDATION_STATUS` push channel, updated project handler with `syncWorker.setProjectContext()`.
  - Renderer: `chatStore.consolidationPhase`, `useChat` CONSOLIDATION_STATUS listener, `ChatPanel` non-blocking green indicator with phase labels.
  - Tests: 96 new assertions in `test_consolidation_engine.mjs` (threshold, truncation, happy path, edge cases, SyncWorker integration).
  - Existing tests updated: `test_renderer_sprint_b.mjs` (channel count 40→41 + CONSOLIDATION_STATUS assertion), `test_renderer_streaming.mjs` (+10 consolidation store/hook/panel assertions).

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Consolidation engine test | `node tests/test_consolidation_engine.mjs` | 96/96 PASS |
| Recall strategy test | `node tests/test_recall_strategy.mjs` | 59/59 PASS |
| Approval test | `node tests/test_approval.mjs` | 75/75 PASS |
| Broker test | `node tests/test_broker.mjs` | 58/58 PASS |
| Chat history test | `node tests/test_chat_history.mjs` | 38/38 PASS |
| Cut pipeline test | `node tests/test_cut_pipeline.mjs` | 31/31 PASS |
| IPC parity test | `node tests/test_ipc_negative.mjs` | 60/60 PASS |
| Kill switch test | `node tests/test_kill_switch.mjs` | 67/67 PASS |
| MCP process test | `node tests/test_mcp_process.mjs` | 41/41 PASS |
| Memory provider test | `node tests/test_memory_provider.mjs` | 61/61 PASS |
| Renderer bridge guard test | `node tests/test_renderer_bridge_guard.mjs` | 44/44 PASS |
| Renderer Sprint B test | `node tests/test_renderer_sprint_b.mjs` | 115/115 PASS |
| Renderer streaming test | `node tests/test_renderer_streaming.mjs` | 44/44 PASS |
| Sandbox paths test | `node tests/test_sandbox_paths.mjs` | 106/106 PASS |
| Snapshot service test | `node tests/test_snapshot_service.mjs` | 18/18 PASS |
| Streaming gateway test | `node tests/test_streaming_gateway.mjs` | 40/40 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 189KB, preload 3KB, renderer 1079KB) |

Non-sqlite runnable total: 953 assertions / 0 failures (18 test files).
SQLite-dependent tests (8 files): blocked by `ERR_DLOPEN_FAILED` (pre-existing `better-sqlite3` ABI mismatch in headless Node — requires `npm rebuild better-sqlite3`).
PTY-dependent test (`test_terminal_blocked_execution.mjs`): blocked by `node-pty` ABI mismatch.

## Pending (Priority Ordered)

1. Gemini audit of Sprint B consolidation for GO/NO-GO.
2. Implement Phase 5 Sprint C (Rate-limit handler) with retry/backoff/fallback.
3. Resolve handling policy for `test_audit_memory_hacks.mjs` (fix, quarantine, or remove from canonical ledgers).
4. Resolve Gemini API quota for real streaming smoke test (billing/project action).
5. MCP provider package resolution checkpoint (fallback still active).
6. Clean scratch untracked artifacts from working tree (`diff*.txt`, `*_diff.txt`, bundle, audit scratch test).

## Known Risks

- Gemini API abort is client-side; aborted requests may still consume provider-side tokens.
- Gemini generateContent quota remains zero in current GCP project.
- Path-with-spaces remains a portability risk for native rebuilds outside validated PowerShell flow.
- MCP provider package remains unresolved in npm registry.
- ConPTY "AttachConsole failed" noise persists in tests; non-blocking.
- `better-sqlite3`/`node-pty` ABI dual-rebuild workflow remains required between Node tests and Electron runtime.
- `safeStorage` unavailable in headless test environments (`PLAINTEXT:` fallback path).
- `test_audit_memory_hacks.mjs` fails due to ESM `.ts` import resolution and remains untracked scratch.

## Mitigations

- Keep live-provider tests conditional until quota/billing enabled.
- Use PowerShell-native rebuild flow for Windows ABI swaps.
- Keep local memory fallback active until MCP package checkpoint resolves.
- Treat ConPTY attach failures as non-blocking test noise (already tolerated in suite).
- Maintain documented dual-rebuild runbook for Node/Electron contexts.
- Preserve bridge-guard pattern (`hasKairoApi`/`getKairoApiOrThrow`) for renderer IPC safety.
- Keep `_isCutting` + idempotent cut lock + worker timeout as invariant in future refactors.
- Exclude scratch tests/artifacts from release ledgers unless promoted to canonical suite.
- Consolidation race CLOSED: `_isConsolidating` lock + SYNCED-only DB queries + atomic `markConsolidated()` + input cap.
- Recall race CLOSED: `_isRecalling` guard + UI input disable + `handleStreamingChat` rejection.

## Next Step (Exact)

Gemini audits Sprint B consolidation implementation for GO/NO-GO. On GO, Codex issues Sprint C implementation packet.

## Next Owner

- Gemini (auditor): audit Sprint B consolidation.
- Codex (orchestrator): route Sprint C packet on GO.
- Claude (implementer): awaits Sprint C packet.
