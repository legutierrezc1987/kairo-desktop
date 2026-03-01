# PROJECT MEMORY (Single Living Context)

Version: 3.27
Last Updated: 2026-03-01
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

- Active phase: Phase 5 COMPLETE — Sprint C SEALED + AUDITED GO (`da6c092`). Transitioning to Phase 6.
- Sealed commits: `326071a` (Sprint A hardening), `3c5799c` (Sprint B + stabilization), `756ad33` (Sprint C streaming e2e), `07831d4` (Sprint D cut-pipeline e2e), `64c3813` (Phase 5 Sprint A recall), `a0b30d8` (Phase 5 Sprint B consolidation), `da6c092` (Phase 5 Sprint C rate-limit, GO).
- Current objective: Scope audit of Phase 6 Sprint A (Monaco editor integration 6.1).
- Active debates: none.
- Open RFCs: none.
- IPC channels: 42 (`RATE_LIMIT_STATUS` added in Phase 5 Sprint C).

## Completed This Session

- **Phase 5 Sprint C seal** — commit `da6c092`:
  - 429/503/RESOURCE_EXHAUSTED multi-signal detection (`is429()`).
  - Exponential backoff with ±25% jitter (1s/2s/4s), max 60s cap.
  - Primary model → 3 retries → fallback model (Pro→Flash) → 3 retries → "Cuota agotada".
  - Non-429 errors propagate immediately (no retry).
  - Orchestrator: `streamOnce` Promise wrapper + `retryWithBackoff` integration.
  - RATE_LIMIT_STATUS IPC push channel (42nd). Amber non-blocking ChatPanel indicator.
  - Gates: 66/66 rate-limit, 96/96 consolidation (regression), 116/116 renderer-b (regression), 54/54 renderer-streaming (regression + 10 new), tsc exit 0.
  - 12 files committed (9 production + 3 tests). Scratch artifacts excluded.

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
| Rate-limit handler test | `node tests/test_rate_limit.mjs` | 66/66 PASS |
| Renderer Sprint B test | `node tests/test_renderer_sprint_b.mjs` | 116/116 PASS |
| Renderer streaming test | `node tests/test_renderer_streaming.mjs` | 54/54 PASS |
| Sandbox paths test | `node tests/test_sandbox_paths.mjs` | 106/106 PASS |
| Snapshot service test | `node tests/test_snapshot_service.mjs` | 18/18 PASS |
| Streaming gateway test | `node tests/test_streaming_gateway.mjs` | 40/40 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 189KB, preload 3KB, renderer 1079KB) |

Non-sqlite runnable total: 1069 assertions / 0 failures (19 test files).
SQLite-dependent tests (8 files): blocked by `ERR_DLOPEN_FAILED` (pre-existing `better-sqlite3` ABI mismatch in headless Node — requires `npm rebuild better-sqlite3`).
PTY-dependent test (`test_terminal_blocked_execution.mjs`): blocked by `node-pty` ABI mismatch.

## Pending (Priority Ordered)

1. Scope audit of Phase 6 Sprint A (Monaco editor: open/edit/save).
2. Resolve handling policy for `test_audit_memory_hacks.mjs` (fix, quarantine, or remove from canonical ledgers).
3. Resolve Gemini API quota for real streaming smoke test (billing/project action).
4. MCP provider package resolution checkpoint (fallback still active).
5. Clean scratch untracked artifacts from working tree (`diff*.txt`, `*_diff.txt`, bundle, audit scratch test).

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
- Rate-limit race CLOSED: `retryWithBackoff` is purely sequential per call, no shared mutable state. Non-429 errors propagate immediately.

## Next Step (Exact)

Gemini audita scope de Fase 6 Sprint A (Monaco: abrir/editar/guardar) para GO/NO-GO pre-implementación.

## Next Owner

- Gemini (auditor): scope audit Phase 6 Sprint A.
- Codex (orchestrator): route Phase 6 Sprint A packet on GO.
- Claude (implementer): awaits Phase 6 scope packet.
