# KAIRO DESKTOP - Beta Exit Criteria

Version: 1.0
Date: 2026-03-01
Author: [Proposed: Claude]

## Purpose

Quantitative criteria for deciding whether Kairo Desktop v0.1.0 closed beta graduates to Release Candidate (Phase 8) or requires a 7.7 hotfix cycle. This document is the single source of truth for the GO/NO-GO decision at beta close (D10).

## Decision Matrix

| Criterion | Threshold | Measurement |
|-----------|-----------|-------------|
| Open P0 bugs | = 0 | `classify-beta-issues.ps1` output |
| Open P1 bugs | <= 2, all with documented workaround | Backlog review |
| Smoke checklist pass rate | >= 80% items per tester | Per-tester checklist in `09_KAIRO_ONBOARDING_BETA.md` |
| Install success rate | = 100% | Evidence reports (`aggregate-beta-evidence.ps1`) |
| Distinct machines tested | >= 2 | Evidence report machine count |
| Multi-turn chat verified | >= 3 testers | Triage log confirmation |
| Terminal execution verified | >= 2 testers | Triage log confirmation |
| File editing verified | >= 1 tester | Triage log confirmation |
| Test suite regression | 0 failures | `node tests/*.mjs` (all 34 suites) |
| Release checklist GO | All gates pass | `docs/10_KAIRO_RELEASE_CHECKLIST.md` |

## Decision Rules

### GO - Proceed to Phase 8

All 10 criteria met. Beta is considered successful.

**Actions:**
1. Archive beta artifacts and triage log.
2. Tag release: `v0.1.0-rc1`.
3. Update PROJECT_MEMORY: Phase 8 routed.
4. Codex synthesizes Phase 7 closure report.

### CONDITIONAL GO - Proceed with Caveats

8-9 criteria met. Remaining gaps are documented and low-risk.

**Conditions:**
- Missing criterion must be P2/P3 severity or manual-verification only.
- No P0 open (this is non-negotiable).
- P1 count <= 2 with workarounds (non-negotiable).
- Triage Lead (User) explicitly accepts remaining risk.

**Actions:**
1. Document accepted gaps in PROJECT_MEMORY.
2. Create tracking issues for deferred items.
3. Proceed to Phase 8 with known limitations list.

### NO-GO - Open 7.7 Hotfix Cycle

< 8 criteria met, OR any non-negotiable criterion fails.

**Non-negotiable failures:**
- P0 bugs open > 0.
- P1 bugs open > 2 (or any without workaround).
- Install success rate < 100%.

**Actions:**
1. Codex frames 7.7 hotfix sprint (A/B path per Deadlock Rule).
2. Claude implements fixes.
3. Gemini audits fixes.
4. Rebuild installer, re-run `verify-packaging.ps1`.
5. Redistribute to testers, restart from D1.

## Automated Checks

The following scripts provide automated measurement for criteria:

| Script | Criterion Measured |
|--------|-------------------|
| `scripts/qa/classify-beta-issues.ps1` | P0 count, P1 count, health status |
| `scripts/qa/aggregate-beta-evidence.ps1` | Machine count, install hash consistency |
| `scripts/qa/verify-packaging.ps1` | Artifact integrity (14 checks) |
| `scripts/qa/run-beta-day.ps1` | Daily pipeline orchestration |
| `node tests/*.mjs` (all suites) | Test suite regression |

## Manual Checks

These require human verification:

| Check | How |
|-------|-----|
| Smoke checklist pass rate | Count checked items per tester vs total (27 items) |
| Multi-turn chat verified | Confirm in triage log: 3+ testers report successful multi-turn conversation |
| Terminal execution verified | Confirm in triage log: 2+ testers ran commands in terminal |
| File editing verified | Confirm in triage log: 1+ tester opened and edited a file |
| P1 workarounds documented | Verify each open P1 has a workaround in its issue or backlog entry |

## Timeline Alignment

| Day | Activity | Exit Criteria Relevance |
|-----|----------|------------------------|
| D5 | Mid-beta checkpoint | Early GO/NO-GO signal. If 3+ non-negotiable criteria fail, consider early abort. |
| D10 | Beta close | Final evaluation against all 10 criteria. Decision made. |

## Escalation from Mid-Beta (D5)

If at D5:
- **P0 open > 0**: Pause beta, hotfix immediately.
- **P1 open > 3**: Evaluate if pace is sustainable. Consider extending beta by 2 days.
- **< 2 testers active**: Re-recruit or extend timeline.
- **All healthy**: Continue to D10.

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-03-01 | Initial exit criteria formalization |
