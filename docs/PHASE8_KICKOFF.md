# Phase 8 Kickoff — Release Candidate Preparation

Date: 2026-03-01
Author: [Proposed: Claude]
Status: SPRINT A COMPLETE
Decision Basis: D5_DECISION.md — CONDITIONAL GO ratified by Director

## Entry Conditions (Verified)

| Condition | Status | Evidence |
|-----------|--------|----------|
| P0 open = 0 | PASS | `classify-beta-issues.ps1` — 0 P0 across Wave 1 + Wave 2 |
| P1 open = 0 | PASS | `classify-beta-issues.ps1` — 0 P1 across Wave 1 + Wave 2 |
| Automated test suite | PASS | 2179/2179 assertions, 37 test files, 0 failures |
| TypeScript strict | PASS | `npx tsc --noEmit` exit 0 |
| electron-vite build | PASS | main 216KB, preload 4KB, renderer 8340KB |
| Packaging integrity | PASS | `verify-packaging.ps1` 14/14, `create-beta-zip.ps1` 8/8 |
| Pipeline stability | PASS | 6 runs (D0-D5), 42/42 steps PASS |
| Director ratification | PASS | CONDITIONAL GO text provided via Codex route instruction |

## Accepted Gaps (Carried from Beta)

These criteria were NOT met at beta close. Director explicitly accepted these risks.

| Gap ID | Exit Criterion | Required | Actual | Risk Level | Phase 8 Action |
|--------|---------------|----------|--------|------------|----------------|
| GAP-01 | C3: Smoke pass rate >= 80% per tester | >= 3 testers | 0 external testers | Medium | Include in RC validation if testers become available |
| GAP-02 | C4: Install success on >= 2 machines | 100% on >= 2 | 100% on 1 (LABORATORIO) | Medium | Test installer on second machine before public release |
| GAP-03 | C5: Distinct machines >= 2 | >= 2 | 1 | Medium | Same as GAP-02 |
| GAP-04 | C6: Multi-turn chat >= 3 testers | >= 3 | 0 external | Low | Core chat verified via 2179 automated assertions + dev smoke |
| GAP-05 | C7: Terminal execution >= 2 testers | >= 2 | 0 external | Low | Terminal subsystem has 57+35 = 92 dedicated test assertions |
| GAP-06 | C8: File editing >= 1 tester | >= 1 | 0 external | Low | Editor has 130+111+94 = 335 dedicated test assertions |

### Risk Assessment

**Common root cause**: All 6 gaps share a single root cause — zero external testers participated in beta. This is an operational gap, not an engineering defect.

**Mitigating factors**:
- 2179 automated assertions cover all subsystems (chat, terminal, editor, memory, settings, security).
- Zero bugs discovered across entire beta lifecycle (Wave 1 D0-D5 + Wave 2 D0-D5).
- All automated quality gates pass consistently.
- Installer verified on dev machine (LABORATORIO, Windows 11 Pro, Node 22.18.0).

**Residual risk**: Unknown install/runtime issues on different Windows configurations, GPU drivers, antivirus software, or Node.js versions. This risk is accepted by the Director.

## Phase 8 Scope

Phase 8 is **Release Candidate Preparation**. The goal is to produce a tagged `v0.1.0-rc1` release.

### What Phase 8 IS

1. Tag the current build as `v0.1.0-rc1`.
2. Update documentation to reflect RC status.
3. Archive beta artifacts and triage logs.
4. Create RC release notes.
5. Prepare distribution channel (if applicable).
6. Address any gap from the accepted list if opportunity arises (e.g., a second machine becomes available).

### What Phase 8 is NOT

- No new features.
- No architectural changes.
- No dependency upgrades (unless security-critical).
- No refactoring.
- No test suite expansion (unless covering a discovered bug).

## Phase 8 Backlog

| # | Item | Priority | Owner | Status |
|---|------|----------|-------|--------|
| 1 | Tag `v0.1.0-rc1` on current commit | High | Claude | **DONE** |
| 2 | Create RC release notes (`docs/RELEASE_NOTES_v0.1.0-rc1.md`) | High | Claude | **DONE** |
| 3 | Archive beta cycle (`docs/beta/` → reference, not active) | Medium | Claude | **DONE** |
| 4 | Update PROJECT_MEMORY to Phase 8 final state | Medium | Claude | **DONE** |
| 5 | Resolve MCP provider package (fallback still active) | Medium | Tribunal | Deferred |
| 6 | Resolve Gemini API billing/quota for production keys | Medium | User | Deferred |
| 7 | Test installer on second machine (GAP-02/03) | Low | User | Opportunistic |
| 8 | Code-signing certificate for installer | Low | User | Deferred |
| 9 | Validate Gemini 3.1 Pro naming against official API | Low | Claude | Deferred |

## Quality Baseline (Inherited)

| Metric | Value |
|--------|-------|
| Assertions | 2179 / 0 failures |
| Test files | 37 |
| IPC channels | 49 |
| TypeScript strict | exit 0 |
| electron-vite build | PASS |
| Packaging | 14/14 PASS |
| Pipeline runs | 6 (42/42 steps PASS) |
| Open P0 | 0 |
| Open P1 | 0 |
| Installer SHA256 | `F584B8DA00C98C6446594A13C03F42B3ED00C01A840F9B13005D78FD7EB28C93` |

## Phase Transition Record

| Field | Value |
|-------|-------|
| Exiting | Phase 7 (Testing + Hardening + Beta) |
| Entering | Phase 8 (Release Candidate Preparation) |
| Transition type | CONDITIONAL GO |
| Decision document | `docs/beta/D5_DECISION.md` |
| Gaps carried | 6 (GAP-01 through GAP-06) |
| Engineering blockers | 0 |
| Code changes required | 0 |

---

_[Proposed: Claude] -- Phase 8 Kickoff Document_
