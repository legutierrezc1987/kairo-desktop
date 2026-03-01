# PROJECT MEMORY (Single Living Context)

Version: 3.34
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

- Active phase: Phase 6 (Editor + Polish) — Sprint D SEALED (`88489d1`), pending Gemini post-implementation audit.
- Sealed commits: `326071a` (Sprint A hardening), `3c5799c` (Sprint B + stabilization), `756ad33` (Sprint C streaming e2e), `07831d4` (Sprint D cut-pipeline e2e), `64c3813` (Phase 5 Sprint A recall), `a0b30d8` (Phase 5 Sprint B consolidation), `da6c092` (Phase 5 Sprint C rate-limit, GO), `5df7b7a` (Phase 6 Sprint A Monaco editor read/write, GO), `9fc53df` (Phase 6 Sprint B File Explorer lazy tree, GO), `5e3a168` (Phase 6 Sprint C Settings completeness, GO), `88489d1` (Phase 6 Sprint D Impact Analyzer + UndoManager).
- Current objective: Gemini post-implementation audit of Phase 6 Sprint D. Then route next sprint.
- Active debates: none.
- Open RFCs: none.
- IPC channels: 47 (`FS_UNDO_PREVIEW` + `FS_UNDO_APPLY` added in Phase 6 Sprint D).

## Completed This Session

- **Phase 6 Sprint D seal** — commit `88489d1`:
  - UndoManagerService: ephemeral LIFO stack (15 entries max, 2MB file cap), content-based collision guard.
  - Snapshot capture wired into FileOperationsService.writeFile() (non-fatal try/catch).
  - IPC: FS_UNDO_PREVIEW + FS_UNDO_APPLY (45→47 channels).
  - Monaco DiffEditor panel in CodeEditor for side-by-side impact preview.
  - editorStore + useEditor extended with undo state and actions.
  - 118 new assertions (test_impact_analyzer_sprint_d.mjs).
  - Gates: `test_impact_analyzer_sprint_d` 118/118, `test_settings_sprint_c` 94/94, `test_editor_sprint_b` 111/111, `test_editor_sprint_a` 130/130, `test_renderer_sprint_b` 119/119, `test_renderer_streaming` 54/54, `test_rate_limit` 66/66, `tsc` exit 0, `electron-vite build` PASS.
  - 16 files committed (10 modified + 2 created + 4 test updates).

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
| Impact Analyzer Sprint D | `node tests/test_impact_analyzer_sprint_d.mjs` | 118/118 PASS |
| Editor Sprint A test | `node tests/test_editor_sprint_a.mjs` | 130/130 PASS |
| Editor Sprint B test | `node tests/test_editor_sprint_b.mjs` | 111/111 PASS |
| Settings Sprint C test | `node tests/test_settings_sprint_c.mjs` | 94/94 PASS |
| Rate-limit handler test | `node tests/test_rate_limit.mjs` | 66/66 PASS |
| Renderer Sprint B test | `node tests/test_renderer_sprint_b.mjs` | 119/119 PASS |
| Renderer streaming test | `node tests/test_renderer_streaming.mjs` | 54/54 PASS |
| Sandbox paths test | `node tests/test_sandbox_paths.mjs` | 106/106 PASS |
| Snapshot service test | `node tests/test_snapshot_service.mjs` | 18/18 PASS |
| Streaming gateway test | `node tests/test_streaming_gateway.mjs` | 40/40 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 208KB, preload 4KB, renderer 8332KB) |

Non-sqlite runnable total: 1525 assertions / 0 failures (23 test files).
SQLite-dependent tests (8 files): blocked by `ERR_DLOPEN_FAILED` (pre-existing `better-sqlite3` ABI mismatch in headless Node — requires `npm rebuild better-sqlite3`).
PTY-dependent test (`test_terminal_blocked_execution.mjs`): blocked by `node-pty` ABI mismatch.

## Pending (Priority Ordered)

1. Gemini post-implementation audit of Phase 6 Sprint D (`88489d1`).
2. Route next sprint (Phase 6 Sprint E or Phase 7).
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
- Monaco worker bundle size is high (`ts.worker`/language chunks), with potential renderer memory overhead on low-end devices.
- Large directory payloads can still stress renderer if users expand very large trees repeatedly (mitigated by exclusions + caps + truncation).
- Lowering custom budget aggressively during active usage can trigger immediate session cut behavior; safe but potentially abrupt UX.

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
- Keep file operations async-only and workspace-bound (`FileOperationsService`) to avoid main-thread stalls and sandbox escapes.
- Clamp and validate custom budgets (`CUSTOM_BUDGET_MIN/MAX`) before persistence to prevent invalid runtime budget states.
- UndoManager uses content-based collision guard (not mtime) — Windows mtime resolution is unreliable for sub-second comparisons.
- Ephemeral undo stack cleared on project switch and app restart — no persistent state leak.

## Next Step (Exact)

Gemini ejecuta auditoría post-implementación GO/NO-GO de Phase 6 Sprint D (`88489d1`). Codex sintetiza veredicto y enruta siguiente sprint.

## Next Owner

- Gemini (auditor): post-implementation audit Phase 6 Sprint D.
- Codex (orchestrator): synthesize verdict and route next sprint.
- Claude (implementer): standby until next sprint routed.
