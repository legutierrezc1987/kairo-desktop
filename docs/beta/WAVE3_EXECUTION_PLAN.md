# Wave 3 Execution Plan [ARCHIVED — SUPERSEDED by CONDITIONAL GO]

Date: 2026-03-01
Author: [Proposed: Claude]
Status: READY FOR EXECUTION
Decision Basis: D5_DECISION.md (EXTEND BETA ratified by Director)

## Objective

Obtain external tester evidence to satisfy the 6 unmet exit criteria (C3, C4, C5, C6, C7, C8). Wave 3 reuses all Wave 2 tooling, artifacts, and pipeline scripts. Zero engineering changes required.

## Anti-Echo Rule

**DO NOT run `run-beta-day.ps1` or `validate-wave-inputs.ps1` unless new external evidence files have been placed in `Kairo_Desktop/`.** Running the pipeline without new data produces endogamic metrics (identical results from the same machine). This was the lesson of Wave 2.

## Pre-Requisites (User-Owned)

| # | Action | Owner | Blocking? |
|---|--------|-------|-----------|
| 1 | Recruit >= 3 external testers (Windows 10/11 x64) | User | YES |
| 2 | Ensure >= 2 testers have Gemini API keys with **paid billing** | User | YES |
| 3 | Distribute beta ZIP (`kairo-beta-v0.1.0-2026-03-01_17-52-06.zip`) | User | YES |
| 4 | Send `EXTERNAL_TESTER_PACKET.md` instructions to each tester | User | YES |
| 5 | Confirm testers can run PowerShell scripts | User | Recommended |

**Wave 3 CANNOT start until at least 3 testers have received the beta ZIP and instructions.**

## Artifacts (Unchanged from Wave 2)

| Artifact | File | SHA256 |
|----------|------|--------|
| Installer | `kairo-desktop-0.1.0-setup.exe` | `F584B8DA00C98C64...` |
| Beta ZIP | `kairo-beta-v0.1.0-2026-03-01_17-52-06.zip` | `74340F8DACC790C3...` |

Full hashes in `WAVE2_DISTRIBUTION_LOG.md`. No rebuild needed unless P0 found.

## Timeline: D0-D5

### D0 — Distribution Day

**Owner: User**

| Step | Action | Owner |
|------|--------|-------|
| 1 | Send beta ZIP to T-001, T-002, T-003 (minimum) | User |
| 2 | Update `WAVE3_TESTER_LOG.md` with tester IDs, machine IDs, dates sent | User |
| 3 | Confirm receipt from each tester | User |

**Gate**: >= 3 testers confirmed receipt. No pipeline run.

### D1 — First Evidence Collection

**Owner: Testers + User**

| Step | Action | Owner |
|------|--------|-------|
| 1 | Testers install, configure API key, run smoke checklist | Testers |
| 2 | Testers run `collect-beta-evidence.ps1`, send evidence file + checklist back | Testers |
| 3 | User places evidence files in `Kairo_Desktop/` | User |
| 4 | Run `run-beta-day.ps1` | User/Claude |
| 5 | Run `validate-wave-inputs.ps1` | User/Claude |
| 6 | Update `WAVE3_TESTER_LOG.md` with C3/C6/C7/C8 per tester | User/Claude |
| 7 | Review `BETA_DASHBOARD.md` + `BETA_BACKLOG.md` | User |

**Gate**: >= 1 new external evidence file placed. Pipeline run justified.

### D2 — Second Evidence Collection + Bug Triage

**Owner: Testers + User + Claude (if bugs)**

| Step | Action | Owner |
|------|--------|-------|
| 1 | Collect remaining tester evidence (late submissions) | User |
| 2 | If bugs reported: classify per `12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md` | User |
| 3 | Run `run-beta-day.ps1` (only if new evidence) | User/Claude |
| 4 | Run `validate-wave-inputs.ps1` | User/Claude |
| 5 | If P0 found: **PAUSE WAVE 3, open 7.7 Hotfix** | Tribunal |
| 6 | If P1 found: document workaround, continue | Claude |

**Gate**: No P0 open. New evidence increases unique machine count.

### D3 — Midpoint Checkpoint

**Owner: Claude + User**

| Step | Action | Owner |
|------|--------|-------|
| 1 | Run pipeline (only if new evidence since D2) | User/Claude |
| 2 | Create `WAVE3_D3_MIDPOINT.md` with criteria snapshot | Claude |
| 3 | Evaluate: how many of 10 criteria now met? | Claude |
| 4 | If >= 8 criteria met: recommend early GO | Claude |
| 5 | If < 8 criteria met but trending positive: continue to D5 | Claude |
| 6 | If P0 discovered: escalate immediately | Tribunal |

**Gate**: Criteria count trending upward vs Wave 2 (was 4/10).

### D4 — Pre-Decision Evidence Lock

**Owner: User + Claude**

| Step | Action | Owner |
|------|--------|-------|
| 1 | Final evidence collection from all testers | User |
| 2 | Run pipeline (only if new evidence since D3) | User/Claude |
| 3 | Create `WAVE3_D5_DECISION_INPUT.md` with consolidated evidence | Claude |
| 4 | Lock evidence: no new files accepted after D4 EOD | User |

**Gate**: All tester evidence received or tester marked as non-responsive.

### D5 — Decision Checkpoint

**Owner: Tribunal**

| Step | Action | Owner |
|------|--------|-------|
| 1 | Run final pipeline (if any late evidence) | User/Claude |
| 2 | Evaluate all 10 exit criteria against `14_KAIRO_BETA_EXIT_CRITERIA.md` | Claude |
| 3 | Create `WAVE3_D5_DECISION.md` | Claude |
| 4 | Decision per criteria matrix below | Tribunal |

**Decision Matrix at D5:**

| Scenario | Criteria Met | Action |
|----------|-------------|--------|
| Full GO | >= 10/10 | Tag `v0.1.0-rc1`, proceed Phase 8 |
| Conditional GO | 8-9/10, no P0 | User accepts gaps, proceed Phase 8 |
| NO-GO (code) | P0 > 0 or P1 > 2 | Open 7.7 Hotfix sprint |
| NO-GO (operational) | < 8/10, no code issues | User decides: extend or CONDITIONAL GO |

## Exit Criteria Tracking

Same 10 criteria from `14_KAIRO_BETA_EXIT_CRITERIA.md`:

| # | Criterion | Wave 2 Final | Wave 3 Target |
|---|-----------|-------------|---------------|
| C1 | Open P0 = 0 | PASS | Maintain PASS |
| C2 | Open P1 <= 2 | PASS | Maintain PASS |
| C3 | Smoke >= 80% per tester | FAIL (no data) | >= 80% from >= 3 testers |
| C4 | Install = 100% | INCONCLUSIVE | 100% on >= 2 machines |
| C5 | Distinct machines >= 2 | FAIL (1) | >= 2 (target: 3) |
| C6 | Multi-turn chat >= 3 testers | FAIL (0) | >= 3 testers confirm |
| C7 | Terminal execution >= 2 testers | FAIL (0) | >= 2 testers confirm |
| C8 | File editing >= 1 tester | FAIL (0) | >= 1 tester confirms |
| C9 | Test regression = 0 | PASS (2179/2179) | Maintain PASS |
| C10 | Release checklist GO | PASS | Maintain PASS |

## Tester Requirements (Unchanged)

- Windows 10 or 11 (x64)
- Gemini API key with **paid billing enabled**
- Ability to run PowerShell scripts (`collect-beta-evidence.ps1`)
- 30-45 minutes of testing time

## Tooling (Unchanged)

All scripts from Wave 2 are reused:

| Script | Purpose |
|--------|---------|
| `scripts/qa/collect-beta-evidence.ps1` | Run on tester machine, generates evidence file |
| `scripts/qa/run-beta-day.ps1` | Daily pipeline orchestration (7 steps) |
| `scripts/qa/validate-wave-inputs.ps1` | Wave readiness check (10 checks) |
| `scripts/qa/aggregate-beta-evidence.ps1` | Dashboard generation |
| `scripts/qa/classify-beta-issues.ps1` | Bug backlog classification |

## Escalation Rules

| Trigger | Action | Owner |
|---------|--------|-------|
| P0 discovered | PAUSE Wave 3, open 7.7 Hotfix | Tribunal |
| P1 > 2 open | Evaluate sustainability, consider extend | Tribunal |
| Tester drops out (< 2 active) | Re-recruit or User decides CONDITIONAL GO | User |
| D5 still < 8 criteria (no code issue) | User decides: Wave 4 or CONDITIONAL GO | User |
| No testers recruited by D+7 from plan creation | Escalate to CONDITIONAL GO decision | User |

## Differences from Wave 2

| Aspect | Wave 2 | Wave 3 |
|--------|--------|--------|
| External testers | 0 | >= 3 (required) |
| Pipeline runs without new data | Allowed (cadence) | **FORBIDDEN** (anti-echo) |
| Artifacts | Built fresh | Reused (same SHA256) |
| Engineering changes | None | None (unless P0) |
| D0 meaning | Build + verify | Distribute to testers |

## CONDITIONAL GO Fallback

If by D5 of Wave 3 the User cannot recruit sufficient testers or criteria remain unmet for operational reasons only (zero code defects), the CONDITIONAL GO path from `D5_DECISION.md` remains available. This requires the same explicit Director ratification text.

---

_[Proposed: Claude] -- Wave 3 Execution Plan_
