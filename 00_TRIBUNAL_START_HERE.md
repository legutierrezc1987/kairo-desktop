# TRIBUNAL START HERE - KAIRO

Version: 1.1
Last Updated: 2026-02-24
Purpose: single startup entrypoint for fresh sessions with any agent.

## Mandatory Rule: Total Documentation

Document every relevant decision, risk, assumption, and pending item.
Leave zero loose ends.
If it is not written in canonical docs, it does not exist.

## Definitions (Operational)

- Session: one uninterrupted interaction window with one model instance.
- Round: one complete tribunal cycle (Codex frame -> Claude/Gemini review -> Codex synthesis -> user decision).

## Startup Order (All Agents)

1. Read `AGENTS.md` (routing, precedence, and boundaries).
2. Read your persona file:
   - Codex -> `CODEX.md`
   - Claude -> `CLAUDE.md`
   - Gemini -> `GEMINI.md`
3. Read shared governance in this order:
   - `docs/00-governance/01_PROJECT_MEMORY.md` (live snapshot + next step)
   - `00_KAIRO_MASTER_GOVERNANCE.md` (DECs, roadmap, checklists)
   - `docs/INDEX.md` (canonical map and artifact status)
4. Read active debate/RFC files listed in `01_PROJECT_MEMORY.md`.

## Session Operating Contract

- Start: publish what you understood, what is missing, and your first action.
- During: update decisions and blockers in canonical files.
- End: update `docs/00-governance/01_PROJECT_MEMORY.md` with:
  - completed work
  - pending work
  - risks
  - exact next owner (Codex, Claude, Gemini, User)

## Project Memory Scope Boundary

`01_PROJECT_MEMORY.md` is live state only (today + next step).
Do not store long rationale/history there.
Rationale/history belongs in DEB/RFC/governance docs and Git history.

## Operational Modes

- Planning mode: full analysis (pros/cons/verdict, alternatives, risk map).
- Implementation mode: minimal overhead (decision, changed artifacts, validations, next step).

## Deadlock Rule

If verdict is `NO-GO`, Codex must produce an explicit reframe package (A/B path) before next round.
If two consecutive rounds stay blocked, user decides final direction.

## Artifact Lifecycle (anti-noise)

- Stable filenames for canonical docs (no new vN files by default).
- Keep version inside document headers/changelog.
- Working drafts must be merged or archived within one debate cycle.
- Only create a new file when it introduces a new domain artifact.

## Messenger Workflow (User as Bus)

1. Codex issues task packets for Claude and Gemini.
2. User copies each packet to target model.
3. User brings responses back.
4. Codex synthesizes and promotes accepted decisions to canonical docs.
