# PROJECT MEMORY (Single Living Context)

Version: 2.3
Last Updated: 2026-02-24
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

- Active phase: Phase 0 (Setup Base) - governance hardening.
- Current objective: run DEB-006 Phase B external benchmark with CQL guardrails integrated for v1.2.
- Active debates:
  - `DEB-006_EXTERNAL_SKILLS_BENCHMARK` (OPEN)
- Open RFCs: none.

## Completed This Session

- Closed DEB-004 with decision GO.
- Closed DEB-005 with decision GO CON CAMBIOS (applied).
- Applied P1/P2/P3/P4/P6 to `skills/universal-architecture-tribunal/SKILL.md`.
- Applied PATCH-01..PATCH-06 synthesis (accepted + partial where applicable) under DEB-006 phase A.
- Applied fine-audit addenda FA-01/FA-02/FA-03 from Claude+Gemini synthesis.
- Kept final name: `universal-architecture-tribunal`.
- Added route-control and attribution policies to skill baseline.
- Git baseline hardened: `.gitignore` created + initial governance lock commit (`f118149`).
- CQL (Critical Question Loop) integrated with anti-noise guardrails (Planning-only, max 3, Open-only persistence).
- External skill `architecture-patterns` benchmarked (high-noise tutorial profile); distilled output created.
- External skill `nodejs-backend-patterns` benchmarked (high-noise tutorial profile); distilled output integrated into checklist.
- Applied `PATCH-EXT-02` and `PATCH-EXT-03` to architecture checklist (execution resilience + additional antipattern triggers).
- Applied `PATCH-PERSONA-01` in `AGENTS.md` (mandatory persona schema + prohibited dynamic state).
- Applied `PATCH-PERSONA-02` in `CLAUDE.md` (role-only hardening + context pointers).
- Applied `PATCH-PERSONA-03` in `GEMINI.md` (startup alignment with `00_TRIBUNAL_START_HERE.md` + role-only scope).
- Added explicit `Personality / Tone` sections to `CLAUDE.md` and `GEMINI.md` to satisfy mandatory persona schema.
- Applied `PATCH-SCHEMA-ALIGN` in `AGENTS.md`: persona schema updated to required sections + allowed optional static role-scoped sections; hard prohibition unchanged.
- Applied `PATCH-GEMINI-01/02/03/04` in `GEMINI.md` (CQL candidate trigger, attribution/non-canonical guardrails, debate contract alignment, and title/section naming normalization).
- Persona hardening formal close: all three persona files (`CODEX.md`, `CLAUDE.md`, `GEMINI.md`) aligned with updated AGENTS schema.
- Opened and closed `DEB-007_PERSONA_SCHEMA_ALIGNMENT.md` (formal closure record for persona hardening and schema alignment).
- Updated `docs/INDEX.md` with target-vs-current layout disclaimer.
- Clarified DEB-006 cutoff counting (target sample size: 4 total; completed: 2; remaining: up to 2).

## Pending (Priority Ordered)

1. Decide whether to continue DEB-006 Phase B with the next external skill or close early due to ROI.
2. If continuing: run KEEP/ADAPT/REJECT synthesis with Claude and Gemini for each additional skill (max 2 remaining).
3. If both additional skills provide <20% reusable governance signal and no new P1/P0 heuristics, close DEB-006 Phase B.
4. Apply final v1.2 patchset from benchmark evidence and close DEB-006.
5. Resume DEB-001 file migration and root cleanup (legacy txt artifacts and non-canonical leftovers).

## Known Risks

- Duplicate PRD versions may still produce contradictory references.
- User-bus operational load may increase if packets are not concise.

## Mitigations

- Keep `v3-1` as active PRD until RFC says otherwise.
- Keep packet templates concise and copy/paste-ready.

## Next Step (Exact)

User decides whether to continue DEB-006 Phase B (next external skill) or close Phase B early. Codex executes the chosen path and updates canonical docs.

## Next Owner

- User (messenger): provide external skills and route packets.
- Codex (orchestrator): synthesize and apply v1.2 patchset.
