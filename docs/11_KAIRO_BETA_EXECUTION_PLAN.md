# KAIRO DESKTOP — Beta Execution Plan

Version: 1.0
Date: 2026-03-01
Author: [Proposed: Claude]

## Purpose

Operational plan for running a closed beta of Kairo Desktop v0.1.0. Defines participants, timeline, deliverables, and exit criteria.

## Beta Scope

- **Version**: 0.1.0 (NSIS installer, Windows x64)
- **Type**: Closed beta (invite-only, 3-10 testers)
- **Duration**: 5-10 business days
- **Platform**: Windows 10/11 64-bit

## Participant Selection

| Criterion | Requirement |
|-----------|-------------|
| OS | Windows 10 64-bit or Windows 11 |
| Technical level | Comfortable installing unsigned software (SmartScreen bypass) |
| Gemini API | Has a working Gemini API key with non-zero quota |
| Availability | Can dedicate 1-2 hours over the beta period |
| Communication | Reachable for triage (email, Slack, or GitHub Issues) |

## Distribution

1. Share `kairo-desktop-0.1.0-setup.exe` via secure link (cloud storage, not email attachment).
2. Include SHA256 hash for verification: `F584B8DA00C98C6446594A13C03F42B3ED00C01A840F9B13005D78FD7EB28C93`.
3. Provide `docs/09_KAIRO_ONBOARDING_BETA.md` as the quickstart guide.
4. Provide `docs/12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md` as the bug report template.

## Beta Timeline

| Day | Activity |
|-----|----------|
| D0 | Distribute installer + onboarding guide to testers |
| D1 | Testers install, run smoke checklist (from `09_KAIRO_ONBOARDING_BETA.md`) |
| D1-D2 | Collect initial smoke test results |
| D2-D5 | Free-form usage: chat, editor, terminal, settings, memory |
| D3 | First triage (see `13_KAIRO_BETA_DAILY_TRIAGE.md`) |
| D5 | Mid-beta checkpoint: review bug intake, decide if hotfix needed |
| D7-D10 | Final usage window |
| D10 | Beta close: collect final reports, triage all open bugs |

## Success Metrics

| Metric | Target |
|--------|--------|
| Install success rate | 100% (all testers install without fatal error) |
| Smoke checklist pass rate | >80% items pass per tester |
| Critical bugs (P0/P1) | 0 unresolved at beta close |
| Tester retention | >50% active through full beta period |

## Bug Classification

| Priority | Definition | SLA |
|----------|-----------|-----|
| P0 — Critical | App crash, data loss, security breach | Hotfix within 24h or beta pause |
| P1 — High | Feature non-functional (chat fails, terminal broken) | Fix before beta close |
| P2 — Medium | Feature degraded but usable (slow, cosmetic, workaround exists) | Track for next release |
| P3 — Low | Enhancement request, minor cosmetic | Backlog |

## Exit Criteria (Beta → Release Candidate)

All must be true:

- [ ] All P0 bugs resolved (zero open)
- [ ] All P1 bugs resolved or mitigated with documented workaround
- [ ] Smoke checklist passes on at least 2 distinct machines
- [ ] At least 3 testers completed multi-turn chat successfully
- [ ] At least 2 testers verified terminal command execution
- [ ] At least 1 tester verified file editing workflow
- [ ] No regression in existing test suite (1862 assertions pass)
- [ ] GO decision from release checklist (docs/10_KAIRO_RELEASE_CHECKLIST.md)

## Communication Plan

| Channel | Purpose | Cadence |
|---------|---------|---------|
| Bug intake form | Structured bug reports | Per incident |
| Daily triage | Review + prioritize bugs | Daily (D3-D10) |
| Mid-beta checkpoint | GO/NO-GO for continuation | D5 |
| Beta close report | Summary + next steps | D10 |

## Rollback Plan

If critical issues are discovered:

1. **Pause beta**: Notify all testers to stop usage.
2. **Hotfix path**: Claude implements fix → tsc + build + test → new installer.
3. **Redistribute**: New installer with incremented patch version.
4. **Resume**: Testers reinstall and continue.

If issues are unfixable within SLA:
1. **Abort beta**: Notify testers.
2. **Post-mortem**: Document root cause and fix plan.
3. **Re-schedule**: New beta after fix is verified.

## Known Limitations (Communicate to Testers)

- Installer is unsigned (SmartScreen warning expected).
- Gemini free-tier may have zero quota — paid API key recommended.
- MCP external provider not available — local memory fallback active.
- ConPTY "AttachConsole failed" messages in terminal are cosmetic noise.
- No auto-update — manual reinstall required for new versions.
