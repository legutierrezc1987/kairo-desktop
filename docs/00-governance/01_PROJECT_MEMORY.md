# PROJECT MEMORY (Single Living Context)

Version: 1.8
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
- Current objective: ingest external skills and finish DEB-006 final lock for universal skill v1.1.
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

## Pending (Priority Ordered)

1. Ingest external skills from user into DEB-006.
2. Run KEEP/ADAPT/REJECT synthesis with Claude and Gemini on real external inputs.
3. Apply final v1.2 patches from external benchmark evidence.
4. Define baseline commit strategy and `.gitignore`.
5. Resume DEB-001 file migration after methodology lock.

## Known Risks

- Git baseline is not hardened yet (`.gitignore` + first governance commit pending).
- Duplicate PRD versions may still produce contradictory references.
- User-bus operational load may increase if packets are not concise.

## Mitigations

- Complete Git baseline hardening (`.gitignore` + initial governance commit + commit convention).
- Keep `v3-1` as active PRD until RFC says otherwise.
- Keep packet templates concise and copy/paste-ready.

## Next Step (Exact)

User shares external architecture skills (files/paths/content). Codex runs DEB-006 synthesis with Claude and Gemini and returns accepted patchset for universal skill v1.1.

## Next Owner

- User (messenger): provide external skills and route packets.
- Codex (orchestrator): synthesize and apply v1.1 patchset.
