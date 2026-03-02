# KAIRO Session Reboot Playbook

Version: 1.0  
Last Updated: 2026-03-01  
Scope: Fast restart protocol for new sessions (Codex / Claude / Gemini)

## Purpose

Provide a deterministic restart path so any new session can recover full context quickly, avoid scope drift, and resume the roadmap from the exact live state.

## Mandatory Bootstrap (All Agents)

Read in this exact order:

1. `00_TRIBUNAL_START_HERE.md`
2. `AGENTS.md`
3. Persona file:
   - Codex: `CODEX.md`
   - Claude: `CLAUDE.md`
   - Gemini: `GEMINI.md`
4. `docs/00-governance/01_PROJECT_MEMORY.md` (live state, current objective, next step)
5. `00_KAIRO_MASTER_GOVERNANCE.md` (frozen decisions / architecture)
6. `docs/INDEX.md` (canonical map)
7. Active beta docs:
   - `docs/beta/WAVE2_DISTRIBUTION_LOG.md`
   - `docs/beta/WAVE2_DAY0_READINESS.md`
   - `docs/beta/WAVE2_EXECUTION_PLAN.md`
   - `docs/14_KAIRO_BETA_EXIT_CRITERIA.md`
   - `docs/beta/D5_DECISION.md`

## Current Program State (Quick)

- Active status: Phase 7.6 operational beta execution (external testers pending).
- Core engineering: Hotfix J + Patch K sealed and validated.
- Current blocker: operational distribution + external evidence, not code quality.
- Mandatory principle now: no feature expansion; run beta loop and triage.

## Codex Restart Packet (Orchestrator)

### Mission

Drive execution rhythm, enforce scope, synthesize Claude/Gemini outputs, and keep canonical docs synchronized.

### First 15 Minutes Checklist

1. Validate real git state:
   - `git status --short --branch`
   - `git log --oneline -n 12`
2. Confirm live memory:
   - `docs/00-governance/01_PROJECT_MEMORY.md` version and next owner.
3. Confirm beta operational docs exist and are current:
   - distribution log, day0 readiness, daily snapshot, dashboard, backlog.
4. Confirm no hidden implementation drift:
   - if user asks "state", answer only with git + canonical docs evidence.

### Routing Rules

1. Claude receives execution packets with:
   - exact scope in/out,
   - strict gates,
   - expected files,
   - required output format (hash + files + gates + status).
2. Gemini receives audit packets with:
   - explicit checklist,
   - verdict contract,
   - residual-risk filter (runtime, not cosmetic).
3. Never promote unverified claims to canonical docs.

### Daily Beta Loop (when evidence arrives)

1. Run `scripts/qa/run-beta-day.ps1`
2. Run `scripts/qa/validate-wave-inputs.ps1`
3. Update:
   - `docs/beta/BETA_DASHBOARD.md`
   - `docs/beta/BETA_BACKLOG.md`
   - `docs/beta/daily/YYYY-MM-DD.md`
4. Recompute exit criteria from `docs/14_KAIRO_BETA_EXIT_CRITERIA.md`
5. Decide: GO Phase 8 / CONTINUE BETA / HOTFIX

## Claude Restart Packet (Implementer)

### Mission

Implement only what Codex packet scopes; defend with tests/gates and clean git hygiene.

### Non-Negotiables

1. No unsanctioned scope.
2. Prefer small commits by intent.
3. Always provide:
   - commit hash(es),
   - exact file list,
   - gate results,
   - final git status.
4. If unexpected repo changes appear mid-task, stop and escalate.

### Default Work Pattern

1. Read bootstrap + current packet.
2. Implement minimal diff.
3. Run required gates only.
4. Report with evidence, not narrative.

## Gemini Restart Packet (Auditor)

### Mission

Stress-test implementation quality and scope hygiene; emit hard verdict.

### Audit Checklist Baseline

1. Scope adherence (in/out).
2. Regression risk on sealed paths.
3. Runtime safety (deadlocks, races, stale-state).
4. Gate coverage sufficiency.
5. Documentation coherence vs git evidence.

### Verdict Contract

Use:

1. PUNTOS DE ACUERDO
2. PUNTOS DE DISCREPANCIA
3. PROPUESTA DE SÍNTESIS
4. `[VEREDICTO]: GO | GO CONDICIONADO | NO-GO`

## Cross-Agent Handoff Contract

For every material action:

1. Update `docs/00-governance/01_PROJECT_MEMORY.md`
2. Keep live state concise; remove resolved items.
3. If action is not in canonical docs + git, treat it as non-existent.

## Session Close Rule

Before ending any session:

1. `git status --short --branch`
2. Update `01_PROJECT_MEMORY.md`:
   - completed,
   - pending (priority),
   - risks,
   - exact next step,
   - next owner.
