# PROJECT MEMORY (Single Living Context)

Version: 3.23
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

- Active phase: Phase 5 (Recall + Consolidation + Rate-Limit) — Sprint A SEALED (post NO-GO remediation).
- Sealed commits: `326071a` (Sprint A hardening), `3c5799c` (Sprint B + stabilization), `756ad33` (Sprint C streaming e2e), `07831d4` (Sprint D cut-pipeline e2e), pending (Phase 5 Sprint A recall + race guard).
- Current objective: Gemini re-audit of Sprint A seal, then proceed to Sprint B (Consolidation).
- Active debates: none.
- Open RFCs: none.
- IPC channels: 40 (`RECALL_STATUS` added in Phase 5 Sprint A).

## Completed This Session

- **Phase 5 Sprint A** (Recall Strategy, DEC-026) — SEALED:
  - `recall-strategy.ts`: 6 triggers (`session_start`, `task_change`, `critical_action`, `periodic`, `contradiction`, `manual`), P0 budget overflow guard, `truncateToRecallBudget()`.
  - Orchestrator integration: `executeRecall()` with timeout, budget recording, history injection (paired user+model turns), `maybePeriodicRecall()` fire-and-forget.
  - IPC push: `RECALL_STATUS` channel → `chatStore.recallPhase` → non-blocking blue indicator in `ChatPanel`.
  - Cut pipeline steps 9-10 refactored to use `executeRecall('session_start')` with local file fallback.
  - **NO-GO remediation**: `_isRecalling` boolean guard (try/finally), `handleStreamingChat` rejects during recall, `InputBar disabled` includes `recallPhase`.
  - Tests: 59 assertions in `test_recall_strategy.mjs` (48 original + 11 remediation).
  - Existing tests updated: 3 orchestrator shims (`test_cut_pipeline`, `test_session_archive`, `test_integration_layer`) + 1 channel count (`test_renderer_sprint_b`).

## Validation Ledger (Latest)

| Check | Command | Result |
|-------|---------|--------|
| Recall strategy test | `node tests/test_recall_strategy.mjs` | 59/59 PASS |
| Approval test | `node tests/test_approval.mjs` | 75/75 PASS |
| Broker test | `node tests/test_broker.mjs` | 58/58 PASS |
| Chat history test | `node tests/test_chat_history.mjs` | 38/38 PASS |
| Cut pipeline test | `node tests/test_cut_pipeline.mjs` | 32/32 PASS |
| IPC parity test | `node tests/test_ipc_negative.mjs` | 60/60 PASS |
| Kill switch test | `node tests/test_kill_switch.mjs` | 67/67 PASS |
| Renderer bridge guard test | `node tests/test_renderer_bridge_guard.mjs` | 44/44 PASS |
| Renderer Sprint B test | `node tests/test_renderer_sprint_b.mjs` | 115/115 PASS |
| Renderer streaming test | `node tests/test_renderer_streaming.mjs` | 34/34 PASS |
| Sandbox paths test | `node tests/test_sandbox_paths.mjs` | 106/106 PASS |
| Snapshot service test | `node tests/test_snapshot_service.mjs` | 19/19 PASS |
| Streaming gateway test | `node tests/test_streaming_gateway.mjs` | 40/40 PASS |
| PTY blocked test | `node tests/test_terminal_blocked_execution.mjs` | 9/9 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 178KB, preload 3KB, renderer 1077KB) |

Non-sqlite runnable total: 756 assertions / 0 failures (17 test files).
SQLite-dependent tests (8 files): blocked by `ERR_DLOPEN_FAILED` (pre-existing `better-sqlite3` ABI mismatch in headless Node — requires `npm rebuild better-sqlite3`).
Scratch test: `test_audit_memory_hacks.mjs` — `ERR_MODULE_NOT_FOUND` (non-canonical).

## Pending (Priority Ordered)

1. Gemini re-audit Sprint A seal for final GO/NO-GO.
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
- Recall race CLOSED: `_isRecalling` guard + UI input disable + `handleStreamingChat` rejection.
- Apply bounded consolidation input window with token cap and overflow fallback path.

## Next Step (Exact)

Gemini re-audits Sprint A seal commit for final GO/NO-GO. On GO, Codex issues Sprint B implementation packet.

## Next Owner

- Gemini (auditor): re-audit Sprint A seal.
- Codex (orchestrator): route Sprint B packet on GO.
- Claude (implementer): awaits Sprint B packet.
