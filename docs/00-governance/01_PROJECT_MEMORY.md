# PROJECT MEMORY (Single Living Context)

Version: 3.42
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

- Active phase: Phase 7 (Testing + Hardening) — Sprint F SEALED.
- Sealed commits: `326071a` (Sprint A hardening), `3c5799c` (Sprint B + stabilization), `756ad33` (Sprint C streaming e2e), `07831d4` (Sprint D cut-pipeline e2e), `64c3813` (Phase 5 Sprint A recall), `a0b30d8` (Phase 5 Sprint B consolidation), `da6c092` (Phase 5 Sprint C rate-limit, GO), `5df7b7a` (Phase 6 Sprint A Monaco editor read/write, GO), `9fc53df` (Phase 6 Sprint B File Explorer lazy tree, GO), `5e3a168` (Phase 6 Sprint C Settings completeness, GO), `88489d1` (Phase 6 Sprint D Impact Analyzer + UndoManager, GO), `9e3e7c5` (Phase 7 Sprint A Safety Net), `856824c` (Phase 7 Sprint A Delta — extracted suites), `9295c31` (cleanup scratch + .gitignore), `ddf6952` (Phase 7 Sprint B Integration Tests), `90c8dc2` (Phase 7 Sprint C E2E Tests), `37c8cbc` (Phase 7 Sprint D electron-builder Windows installer), `e44c117` (Phase 7 Sprint E Docs + Onboarding), `TBD` (Phase 7 Sprint F Beta Ops).
- Current objective: Smoke-test installer on fresh Windows. Execute closed beta per docs/11.
- Active debates: none.
- Open RFCs: none.
- IPC channels: 47 (unchanged — docs/scripts/tests-only sprint).

## Completed This Session

- **Phase 7 Sprint F — Beta Ops (docs + QA scripts + integrity tests)**:
  - `docs/11_KAIRO_BETA_EXECUTION_PLAN.md` v1.0: closed beta plan (participants, timeline D0-D10, success metrics, exit criteria, rollback).
  - `docs/12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md` v1.0: structured bug report template (reporter info, repro steps, priority, evidence collection, triage fields).
  - `docs/13_KAIRO_BETA_DAILY_TRIAGE.md` v1.0: daily triage process (roles, checklist, escalation rules, health indicator GREEN/AMBER/RED, close process).
  - `scripts/qa/verify-packaging.ps1`: validates dist artifacts (installer, unpacked exe, native .node files, SHA256, yml config). 14 checks.
  - `scripts/qa/collect-beta-evidence.ps1`: collects OS, app version, artifact hashes, native modules, app data/logs into timestamped report.
  - `tests/test_packaging_integrity.mjs`: 38 assertions (electron-builder.yml, package.json scripts, rebuild-native.js, dist artifacts, QA scripts).
  - `tests/test_beta_docs_integrity.mjs`: 55 assertions (8 doc files exist, section presence for docs 08-13, INDEX cross-references).
  - `docs/INDEX.md`: updated canonical tree and status with 3 new beta docs.
  - Zero production files modified.

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
| Safety Net Sprint A test | `node tests/test_safety_net_sprint_a.mjs` | 107/107 PASS |
| Tool Schema test | `node tests/test_tool_schema.mjs` | 35/35 PASS |
| System Prompt test | `node tests/test_system_prompt.mjs` | 18/18 PASS |
| Model Router test | `node tests/test_model_router.mjs` | 9/9 PASS |
| Gateway Integration test | `node tests/test_gateway_integration.mjs` | 45/45 PASS |
| MCP Fallback Integration test | `node tests/test_mcp_fallback_integration.mjs` | 35/35 PASS |
| Cut Pipeline Integration test | `node tests/test_cut_pipeline_integration.mjs` | 40/40 PASS |
| Chat E2E test | `node tests/test_chat_e2e.mjs` | 40/40 PASS |
| Terminal E2E test | `node tests/test_terminal_e2e.mjs` | 35/35 PASS |
| Kill Switch E2E test | `node tests/test_kill_switch_e2e.mjs` | 35/35 PASS |
| Packaging integrity test | `node tests/test_packaging_integrity.mjs` | 38/38 PASS |
| Beta docs integrity test | `node tests/test_beta_docs_integrity.mjs` | 55/55 PASS |
| QA verify-packaging | `powershell -File scripts/qa/verify-packaging.ps1` | 14/14 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 216KB, preload 4KB, renderer 8340KB) |

Non-sqlite runnable total: 1955 assertions / 0 failures (32 test files).
Note: The 3 extracted suites (test_tool_schema, test_system_prompt, test_model_router) verify the same contracts as T2/T3/T4 in test_safety_net_sprint_a — they do not add new unique assertions but provide standalone runnable coverage.
SQLite-dependent tests (8 files): blocked by `ERR_DLOPEN_FAILED` (pre-existing `better-sqlite3` ABI mismatch in headless Node — requires `npm rebuild better-sqlite3`).
PTY-dependent test (`test_terminal_blocked_execution.mjs`): blocked by `node-pty` ABI mismatch.

## Pending (Priority Ordered)

1. Smoke-test installer on fresh Windows (install → launch → verify terminal/chat/settings).
2. Execute closed beta per `docs/11_KAIRO_BETA_EXECUTION_PLAN.md`.
3. Route next phase (Phase 8 or beyond) based on beta results.
4. Resolve Gemini API quota for real streaming smoke test (billing/project action).
5. MCP provider package resolution checkpoint (fallback still active).

## Known Risks

- Gemini API abort is client-side; aborted requests may still consume provider-side tokens.
- Gemini generateContent quota remains zero in current GCP project.
- Path-with-spaces requires `SUBST` drive + winpty.gyp patch for node-pty rebuild (`scripts/rebuild-native.js` automates this). `npm install` from a spaceless path avoids the issue entirely.
- MCP provider package remains unresolved in npm registry.
- ConPTY "AttachConsole failed" noise persists in tests; non-blocking.
- `better-sqlite3`/`node-pty` ABI dual-rebuild workflow remains required between Node tests and Electron runtime.
- `safeStorage` unavailable in headless test environments (`PLAINTEXT:` fallback path).
- Monaco worker bundle size is high (`ts.worker`/language chunks), with potential renderer memory overhead on low-end devices.
- Large directory payloads can still stress renderer if users expand very large trees repeatedly (mitigated by exclusions + caps + truncation).
- Lowering custom budget aggressively during active usage can trigger immediate session cut behavior; safe but potentially abrupt UX.

## Mitigations

- Keep live-provider tests conditional until quota/billing enabled.
- Use `node scripts/rebuild-native.js` for native module rebuilds (handles SUBST + winpty.gyp patch automatically).
- `npmRebuild: false` in electron-builder.yml — native modules must be pre-rebuilt via `scripts/rebuild-native.js` before packaging.
- Installer is unsigned (no code-signing cert) — Windows SmartScreen warning expected on first run.
- Keep local memory fallback active until MCP package checkpoint resolves.
- Treat ConPTY attach failures as non-blocking test noise (already tolerated in suite).
- Maintain documented dual-rebuild runbook for Node/Electron contexts.
- Preserve bridge-guard pattern (`hasKairoApi`/`getKairoApiOrThrow`) for renderer IPC safety.
- Keep `_isCutting` + idempotent cut lock + worker timeout as invariant in future refactors.
- Consolidation race CLOSED: `_isConsolidating` lock + SYNCED-only DB queries + atomic `markConsolidated()` + input cap.
- Recall race CLOSED: `_isRecalling` guard + UI input disable + `handleStreamingChat` rejection.
- Rate-limit race CLOSED: `retryWithBackoff` is purely sequential per call, no shared mutable state. Non-429 errors propagate immediately.
- Keep file operations async-only and workspace-bound (`FileOperationsService`) to avoid main-thread stalls and sandbox escapes.
- Clamp and validate custom budgets (`CUSTOM_BUDGET_MIN/MAX`) before persistence to prevent invalid runtime budget states.
- UndoManager uses content-based collision guard (not mtime) — Windows mtime resolution is unreliable for sub-second comparisons.
- Ephemeral undo stack cleared on project switch and app restart — no persistent state leak.

## Next Step (Exact)

Smoke-test installer on a clean Windows machine. Then execute closed beta per docs/11.

## Next Owner

- User: smoke-test `kairo-desktop-0.1.0-setup.exe` on clean Windows (install → launch → verify terminal + chat + settings). Then distribute to beta testers per `docs/11_KAIRO_BETA_EXECUTION_PLAN.md`.
- Codex (orchestrator): synthesize Phase 7 closure and route Phase 8.
- Claude (implementer): standby until next sprint routed.
