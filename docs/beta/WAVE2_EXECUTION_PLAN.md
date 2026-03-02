# KAIRO DESKTOP - Wave 2 Beta Execution Plan [ARCHIVED]

Version: 1.0
Date: 2026-03-01
Author: [Proposed: Claude]
Status: **PENDING** (awaiting external tester recruitment)

## Context

Wave 1 (D0-D2) confirmed all automated quality gates PASS with zero production bugs. However, zero external testers participated, resulting in 5/10 exit criteria FAIL (operational gap). Wave 2 extends the beta window (D3-D5) to collect real external tester data.

### Wave 1 Results (Reference)

| Metric | Wave 1 Result |
|--------|---------------|
| Automated gates | ALL PASS |
| Production bugs | 0 |
| External testers | 0 |
| Exit criteria met | 4/10 |
| Decision | NO-GO Phase 8 (operational gap) |

Full report: `docs/beta/WAVE1_EXECUTION_REPORT.md`

## Wave 2 Objectives

1. **Minimum 3 external testers** install and run smoke checklist.
2. **Minimum 2 distinct machines** submit evidence reports.
3. **Minimum 2 testers** verify multi-turn chat with streaming.
4. **Zero P0 bugs** at D5 checkpoint.
5. Collect enough data to evaluate all 10 exit criteria.

## Prerequisites

| Prerequisite | Owner | Status |
|--------------|-------|--------|
| Distribute `kairo-beta-v0.1.0-*.zip` or installer to >= 3 testers | User | PENDING |
| Ensure >= 2 testers have paid Gemini API keys (non-zero quota) | User | PENDING |
| Share `EXTERNAL_TESTER_PACKET.md` with each tester | User | PENDING |
| Verify testers have Windows 10/11 64-bit | User | PENDING |

## Timeline (D3-D5)

| Day | Activity | Owner |
|-----|----------|-------|
| D3 | Testers install + run smoke checklist | Testers |
| D3 | Testers submit evidence via `collect-beta-evidence.ps1` | Testers |
| D3 | Testers share evidence `.txt` files back to User | Testers |
| D4 | User places evidence files in `Kairo_Desktop/` | User |
| D4 | Run `scripts/qa/run-beta-day.ps1` (daily pipeline) | User/Claude |
| D4 | File bugs in `docs/beta/issues/` if any found | User/Testers |
| D4 | Triage bugs per `docs/13_KAIRO_BETA_DAILY_TRIAGE.md` | User/Claude |
| D5 | Final evidence collection + pipeline run | User/Claude |
| D5 | Evaluate all 10 exit criteria | Tribunal |
| D5 | Decision: GO / CONDITIONAL GO / NO-GO | Tribunal |

## Tester Workflow

```
Receive ZIP/installer → Install (bypass SmartScreen)
  → Settings (enter Gemini API key) → New Project (pick folder)
  → Chat (3+ turns) → Editor (open + edit file) → Terminal (run commands)
  → Run collect-beta-evidence.ps1 → Send .txt file to User
  → Fill smoke checklist (from 09_KAIRO_ONBOARDING_BETA.md)
  → Report bugs (if any) via EXTERNAL_TESTER_PACKET.md instructions
```

## Validation Script

Run `scripts/qa/validate-wave-inputs.ps1` before D5 evaluation:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa/validate-wave-inputs.ps1
```

This script verifies:
- >= 3 evidence files present
- >= 2 unique machine names
- >= 2 testers with API key readiness (installer hash present = tester ran evidence collection)

## D5 Decision Matrix

| Scenario | Decision | Action |
|----------|----------|--------|
| >= 8 criteria met, 0 P0 | **GO** | Tag `v0.1.0-rc1`, proceed to Phase 8 |
| 8-9 criteria met, gaps are P2/P3 | **CONDITIONAL GO** | Document gaps, proceed with caveats |
| < 8 criteria met, no P0 | **NO-GO (extend)** | Extend to D7-D10 for more data |
| P0 > 0 | **NO-GO (hotfix)** | Open 7.7 hotfix cycle immediately |
| < 2 testers active | **NO-GO (recruit)** | Re-recruit or User accepts CONDITIONAL GO |

## Risk Mitigation

| Risk | Severity | Wave 2 Mitigation |
|------|----------|-------------------|
| Gemini API quota = 0 | HIGH | Require paid API key. Document in EXTERNAL_TESTER_PACKET. |
| SmartScreen warning deters testers | MEDIUM | Step-by-step bypass in tester packet. |
| Testers don't return evidence | MEDIUM | Follow up at D4. Minimum evidence = tester ran collect script. |
| Path-with-spaces on tester machines | LOW | collect-beta-evidence.ps1 tested on paths with spaces. |

## Success Criteria for Wave 2

Wave 2 is successful if ALL of these are true at D5:
- >= 3 evidence reports from >= 2 distinct machines
- >= 2 smoke checklists submitted
- 0 P0 bugs
- Pipeline scripts all PASS with real multi-machine data

---

_[Proposed: Claude] - Generated for D3-D5 beta extension._
