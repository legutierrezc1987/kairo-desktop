# KAIRO DESKTOP — Beta Daily Triage Process

Version: 1.0
Date: 2026-03-01
Author: [Proposed: Claude]

## Purpose

Structured daily process for reviewing, prioritizing, and routing beta bug reports. Run daily from D3 through beta close (D10).

## Triage Roles

| Role | Owner | Responsibility |
|------|-------|---------------|
| Triage Lead | User (Director) | Final priority decision, assigns work |
| Implementer | Claude | Fix assessment, implementation, verification |
| Auditor | Gemini | Risk review, regression check |
| Orchestrator | Codex | Synthesis, escalation, process enforcement |

## Daily Triage Checklist

Run this checklist once per day during active beta:

### 1. Intake Review (5 min)

- [ ] Collect all new bug reports since last triage
- [ ] Verify each report has: summary, steps to reproduce, priority, environment
- [ ] Request missing info from reporter if incomplete

### 2. Priority Assessment (10 min)

For each new bug:

- [ ] Confirm or adjust reporter's priority assessment
- [ ] Apply priority definitions:

| Priority | Criteria | Action |
|----------|----------|--------|
| P0 | Crash, data loss, security breach | Immediate hotfix. Pause beta if widespread. |
| P1 | Feature non-functional, no workaround | Schedule fix before beta close |
| P2 | Degraded but usable, workaround exists | Track, fix if time permits |
| P3 | Cosmetic, enhancement | Backlog for post-beta |

### 3. Duplicate Check (2 min)

- [ ] Compare against existing bug list
- [ ] Merge duplicates, note additional reproduction info

### 4. Assignment (3 min)

- [ ] Assign P0/P1 bugs to implementer (Claude)
- [ ] Request auditor review for P0 bugs (Gemini)
- [ ] Update status in bug tracker / triage log

### 5. Status Update (5 min)

- [ ] Update triage log (below) with current state
- [ ] Notify testers of any known workarounds
- [ ] If P0 open > 24h, escalate to beta pause decision

## Triage Log Template

Copy and update daily:

```
## Triage — [DATE]

### New Bugs
| ID | Summary | Reporter | Priority | Assigned | Status |
|----|---------|----------|----------|----------|--------|
| B-001 | [description] | [name] | P1 | Claude | Open |

### In Progress
| ID | Summary | Assigned | ETA | Notes |
|----|---------|----------|-----|-------|
| B-001 | [description] | Claude | D4 | [notes] |

### Resolved Since Last Triage
| ID | Summary | Fix | Verified |
|----|---------|-----|----------|
| B-000 | [description] | commit abc123 | Yes/No |

### Blocked
| ID | Summary | Blocker | Action Needed |
|----|---------|---------|--------------|
| (none) | | | |

### Metrics
- Total bugs: X
- Open P0: X | Open P1: X | Open P2: X | Open P3: X
- Fixed since last triage: X
- Beta health: GREEN / AMBER / RED
```

## Escalation Rules

| Condition | Action |
|-----------|--------|
| P0 open > 24 hours | Triage Lead decides: hotfix or pause beta |
| 3+ P1 bugs open simultaneously | Mid-beta checkpoint (re-evaluate beta health) |
| Tester reports data loss | Immediate investigation + notify all testers |
| Same bug reported by 3+ testers | Elevate to P0 regardless of original priority |

## Beta Health Indicator

| Status | Criteria |
|--------|----------|
| GREEN | 0 open P0, <=2 open P1, testers active |
| AMBER | 1 open P0 (being fixed), or 3+ open P1 |
| RED | P0 open >24h, or data loss confirmed, or >50% testers blocked |

## Mid-Beta Checkpoint (D5)

At the midpoint, evaluate:

1. **Bug volume**: Is the rate sustainable?
2. **Severity distribution**: Are most bugs P2/P3 (healthy) or P0/P1 (concerning)?
3. **Tester engagement**: Are testers still active?
4. **Decision**: Continue / Pause for hotfix / Abort

## Beta Close Process (D10)

1. Freeze new bug intake
2. Final triage of all open bugs
3. Classify remaining open bugs as: fix-for-RC / defer-to-backlog / won't-fix
4. Generate beta summary report:
   - Total bugs: X (P0: X, P1: X, P2: X, P3: X)
   - Fixed: X
   - Deferred: X
   - Smoke checklist pass rate across testers
5. GO/NO-GO for release candidate (using `docs/10_KAIRO_RELEASE_CHECKLIST.md`)
