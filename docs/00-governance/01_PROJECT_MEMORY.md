# PROJECT MEMORY (Single Living Context)

Version: 3.53
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

- Active phase: Phase 7 (Testing + Hardening) — Hotfix J + Patch K SEALED. Working tree CLEAN.
- Sealed commits: `326071a` (Sprint A hardening), `3c5799c` (Sprint B + stabilization), `756ad33` (Sprint C streaming e2e), `07831d4` (Sprint D cut-pipeline e2e), `64c3813` (Phase 5 Sprint A recall), `a0b30d8` (Phase 5 Sprint B consolidation), `da6c092` (Phase 5 Sprint C rate-limit, GO), `5df7b7a` (Phase 6 Sprint A Monaco editor read/write, GO), `9fc53df` (Phase 6 Sprint B File Explorer lazy tree, GO), `5e3a168` (Phase 6 Sprint C Settings completeness, GO), `88489d1` (Phase 6 Sprint D Impact Analyzer + UndoManager, GO), `9e3e7c5` (Phase 7 Sprint A Safety Net), `856824c` (Phase 7 Sprint A Delta — extracted suites), `9295c31` (cleanup scratch + .gitignore), `ddf6952` (Phase 7 Sprint B Integration Tests), `90c8dc2` (Phase 7 Sprint C E2E Tests), `37c8cbc` (Phase 7 Sprint D electron-builder Windows installer), `e44c117` (Phase 7 Sprint E Docs + Onboarding), `e6df7ba` (Phase 7 Sprint F Beta Ops), `798c5ff` (Phase 7 Sprint G Beta Distribution + Intake), `7ca4b9b` (Phase 7 Sprint H Beta Ops Automation).
- Current objective: **Wave 2 D5 checkpoint complete**. D1-D5 pipeline executed (6 total runs including D0). All runs: `run-beta-day` 7/7 PASS, `validate-wave-inputs` 9/10 (persistent FAIL: 1 unique machine). Exit criteria: 4/10 PASS. Zero bugs. Zero external testers enrolled. D5 decision: **PENDING USER — CONDITIONAL GO or EXTEND BETA**. See `docs/beta/D5_DECISION.md` + `WAVE2_D5_DECISION_INPUT.md`.
- D0 telemetry table upgraded for direct exit-criteria tracking: explicit columns for C3/C6/C7/C8 in `WAVE2_DISTRIBUTION_LOG.md`.
- Model catalog refresh completed (runtime + UI): deprecated `gemini-2.0-*` and `gemini-2.5-pro` removed from app paths. Active catalog now uses `gemini-2.5-flash`, `gemini-3-flash-preview`, `gemini-3.1-pro-preview`, `gemini-3.1-pro-preview-customtools`.
- Routing updated for practical quota behavior: foreground=`gemini-2.5-flash`, background/fallback=`gemini-3-flash-preview`.
- Active debates: none.
- Open RFCs: none.
- IPC channels: 49 (+1: `ACCOUNT_PREFLIGHT_GET` pull channel for Patch K).

## Completed This Session

- **Phase 7 Hotfix J — Account Preflight / No-Project Guard / Error Discrimination**:
  - `is401()` multi-signal detector in `rate-limit.service.ts` (status 401/403 + message patterns).
  - `validateGateway()` in `gemini-gateway.ts`: `countTokens('test')` lightweight ping, returns `valid`/`invalid`/`quota`/`unknown`.
  - Push channel `ACCOUNT_PREFLIGHT_STATUS`: fires on startup + account change, consumed by AccountManager badge.
  - No-project guard: dual enforcement (orchestrator rejects + ChatPanel InputBar disabled).
  - `is401` discrimination in orchestrator `onError`: deterministic Spanish error message.
  - AccountManager badge: local state, 5-state rendering (valid/invalid/quota/validating/unknown).
  - Gateway integration test fix: patched `./rate-limit.service` import for `.test-build/` directory resolution.
  - 8 production files modified, 9 test files updated (8 existing + 1 new).
  - New test: `test_account_preflight_hotfix_j.mjs` — 45 assertions.
- **Patch K — Preflight Pull + normalizeModelId Runtime Guard**:
  - `ACCOUNT_PREFLIGHT_GET` pull IPC channel: fixes mount race where AccountManager misses push event.
  - `lastPreflightStatus` module-level state in `index.ts`: stores last preflight result for pull handler.
  - `normalizeModelId()` in `constants.ts`: maps legacy model IDs (`gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-2.5-pro`) to current equivalents at runtime.
  - Applied at all 3 entry points: `rowToProject()` (DB read), `useSettings` (hydration), `routeModel()` (routing).
  - Removed dead `VALID_MODELS` array from `useSettings.ts` (replaced by `normalizeModelId`).
  - No physical DB migration needed — runtime normalization covers all paths; gateway `getModel()` is ultimate backstop.
  - 7 production files modified, 8 test files updated + 1 new.
  - New test: `test_patch_k.mjs` — 34 assertions.
- **Hygiene Closure** (`7cc0ddd`, `1d1537f`):
  - Fixed missed channel count in `test_rate_limit.mjs` (48→49).
  - Aligned API smoke scripts (`test_0.18.js`, `test_0.19.js`) from `gemini-2.0-flash` to `gemini-2.5-flash`.
  - Working tree confirmed CLEAN (zero unstaged/untracked files).
- **Wave 2 D0 Execution**:
  - `verify-packaging.ps1`: 14/14 PASS.
  - `create-beta-zip.ps1`: 8/8 PASS. ZIP: `kairo-beta-v0.1.0-2026-03-01_17-52-06.zip` (105.69 MB).
  - `run-beta-day.ps1`: 7/7 PASS. Daily snapshot: `docs/beta/daily/2026-03-01.md`.
  - `validate-wave-inputs.ps1`: 9/10 PASS (1 FAIL: 1 unique machine < 2 required).
  - Created `docs/beta/WAVE2_DISTRIBUTION_LOG.md` with artifact hashes + 5 tester slots.
  - Created `docs/beta/WAVE2_DAY0_READINESS.md` with full readiness report.
  - Zero changes to `src/`.
- **Session Reboot Documentation (multi-agent)**:
  - Created `docs/00-governance/02_SESSION_REBOOT_PLAYBOOK.md` with specific restart instructions for Codex / Claude / Gemini.
  - Updated `docs/INDEX.md` canonical map to include reboot playbook.
  - Updated `WAVE2_DISTRIBUTION_LOG.md` tester table with explicit criteria columns:
    - `Smoke % (C3)`
    - `Chat OK (C6)`
    - `Term OK (C7)`
    - `Edit OK (C8)`
- **Wave 2 D1-D5 Execution**:
  - 5 daily pipeline cycles (D1-D5) executed. All: `run-beta-day` 7/7, `validate-wave-inputs` 9/10.
  - Evidence files grew 5→10 (all LABORATORIO machine). Unique machines: 1/2 required.
  - Created `docs/beta/WAVE2_D3_MIDPOINT.md` with criteria gap analysis.
  - Created `docs/beta/WAVE2_D5_DECISION_INPUT.md` with consolidated evidence + A/B proposal.
  - Updated `docs/beta/D5_DECISION.md` with D1-D5 evidence (10 reports, 2179/2179 PASS).
  - Updated `docs/beta/WAVE2_DISTRIBUTION_LOG.md` with D1-D5 history entries.
  - Updated `docs/beta/BETA_DASHBOARD.md` (P0=0, P1=0, AMBER status).
  - Zero changes to `src/`.

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
| Account Preflight Hotfix J | `node tests/test_account_preflight_hotfix_j.mjs` | 45/45 PASS |
| Patch K test | `node tests/test_patch_k.mjs` | 34/34 PASS |
| Terminal E2E test | `node tests/test_terminal_e2e.mjs` | 35/35 PASS |
| Kill Switch E2E test | `node tests/test_kill_switch_e2e.mjs` | 35/35 PASS |
| Packaging integrity test | `node tests/test_packaging_integrity.mjs` | 38/38 PASS |
| Beta docs integrity test | `node tests/test_beta_docs_integrity.mjs` | 55/55 PASS |
| Beta distribution integrity | `node tests/test_beta_distribution_integrity.mjs` | 41/41 PASS |
| QA validate-wave-inputs | `powershell -File scripts/qa/validate-wave-inputs.ps1` | 9/10 (1 expected FAIL: 1 unique machine) |
| Issue templates integrity | `node tests/test_issue_templates_integrity.mjs` | 46/46 PASS |
| Beta ops pipeline integrity | `node tests/test_beta_ops_pipeline_integrity.mjs` | 58/58 PASS |
| QA verify-packaging | `powershell -File scripts/qa/verify-packaging.ps1` | 14/14 PASS |
| QA create-beta-zip | `powershell -File scripts/qa/create-beta-zip.ps1` | 8/8 PASS |
| QA aggregate-evidence | `powershell -File scripts/qa/aggregate-beta-evidence.ps1` | 3/3 PASS |
| QA classify-beta-issues | `powershell -File scripts/qa/classify-beta-issues.ps1` | 3/3 PASS |
| QA run-beta-day | `powershell -File scripts/qa/run-beta-day.ps1` | 7/7 PASS |
| TypeScript strict | `npx tsc --noEmit` | exit 0 |
| Electron-vite build | `npx electron-vite build` | PASS (main 216KB, preload 4KB, renderer 8340KB) |

Non-sqlite runnable total: 2179 assertions / 0 failures (37 test files).
Note: The 3 extracted suites (test_tool_schema, test_system_prompt, test_model_router) verify the same contracts as T2/T3/T4 in test_safety_net_sprint_a — they do not add new unique assertions but provide standalone runnable coverage.
SQLite-dependent tests (8 files): blocked by `ERR_DLOPEN_FAILED` (pre-existing `better-sqlite3` ABI mismatch in headless Node — requires `npm rebuild better-sqlite3`).
PTY-dependent test (`test_terminal_blocked_execution.mjs`): blocked by `node-pty` ABI mismatch.

## Pending (Priority Ordered)

1. **BLOCKING**: User recruits >= 3 external testers and distributes installer + `EXTERNAL_TESTER_PACKET.md`.
2. Testers run smoke checklist (docs/09) + collect evidence via `collect-beta-evidence.ps1`.
3. Run `scripts/qa/run-beta-day.ps1` + `validate-wave-inputs.ps1` daily after distribution.
4. When `validate-wave-inputs.ps1` shows GO: re-evaluate all 10 exit criteria.
5. Decision at new D5 (post-distribution): GO Phase 8 / CONDITIONAL GO / NO-GO.
6. Resolve Gemini API quota for real streaming smoke test (billing/project action).
7. MCP provider package resolution checkpoint (fallback still active).
8. If User decides external beta is not feasible: CONDITIONAL GO path available (documented in `D5_DECISION.md`).
9. Validate Antigravity naming semantics for "3.1 Pro (High/Low)" against official API IDs and keep mapping aligned (`3.1-pro-preview` / `3.1-pro-preview-customtools` currently used).

## Known Risks

- Gemini API abort is client-side; aborted requests may still consume provider-side tokens.
- Gemini generateContent quota remains zero in current GCP project.
- Gemini 3.1 Pro variants remain quota-sensitive in current project keys (429), while 2.5 Flash and 3 Flash are currently operational.
- Path-with-spaces requires `SUBST` drive + winpty.gyp patch for node-pty rebuild (`scripts/rebuild-native.js` automates this). `npm install` from a spaceless path avoids the issue entirely.
- Path-with-spaces also affects PS sub-process invocation: use `Start-Process -ArgumentList` with quoted `-File` string (not array).
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

Wave 2 D5 checkpoint complete. 4/10 exit criteria met (all failures are operational, not engineering). User must decide:
- **Option A (CONDITIONAL GO)**: Accept dev-machine-only testing, proceed to Phase 8 with documented gap.
- **Option B (EXTEND BETA)**: Recruit 3+ external testers, run Wave 3 (same tooling, same pipeline).
See `docs/beta/WAVE2_D5_DECISION_INPUT.md` for full analysis.

## Next Owner

- User (Director): ratify D5 decision (CONDITIONAL GO or EXTEND).
- Codex (orchestrator): route Phase 8 kickoff or Wave 3 setup based on User decision.
- Claude (implementer): D5 complete. Standby for Phase 8 or hotfix if testers find bugs.
