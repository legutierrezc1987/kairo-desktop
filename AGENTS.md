# AGENTS.md - KAIRO Multi-Agent Routing

## Purpose
Avoid rule collisions between agents.
Define ownership, startup path, precedence, and source-of-truth files.

## Team Hierarchy
- Director: User (final decision authority)
- Orchestrator: Codex / ChatGPT (OpenAI)
- Implementer: Claude
- Auditor: Gemini

## Instruction Source Per Agent
- Codex follows: `CODEX.md`
- Claude follows: `CLAUDE.md`
- Gemini follows: `GEMINI.md`

Hard rule: each agent follows only its own persona file plus shared governance.
No agent imports another agent's persona instructions.

## Shared Bootstrap (Mandatory)
All agents start from: `00_TRIBUNAL_START_HERE.md`

## Global Governance (Shared)
All agents align with:
- `docs/00-governance/01_PROJECT_MEMORY.md`
- `00_KAIRO_MASTER_GOVERNANCE.md`
- `01_KAIRO_PRD_FINAL_v3-1.md`
- `03_KAIRO_PLANNING_POLICY_v1.md`
- `07_KAIRO_DEBATE_HISTORY.md`
- `docs/INDEX.md`

## Instruction Precedence (Critical)

1. User explicit decision/instruction (highest)
2. `00_TRIBUNAL_START_HERE.md`
3. Active governance + active DEB/RFC decisions
4. Agent persona file (`CODEX.md`/`CLAUDE.md`/`GEMINI.md`)
5. Skills (supporting guidance only)

Rule: skills cannot override governance, active DEB/RFC, or user decisions.

## Persona File Schema (Mandatory)

Each agent persona file (`CODEX.md`, `CLAUDE.md`, `GEMINI.md`) must contain:

Required sections (all 6):
1. Role / mission
2. Responsibilities and ownership boundaries
3. Personality and tone directives
4. Forbidden actions (negative prompting)
5. Output format requirements
6. Startup protocol aligned with `00_TRIBUNAL_START_HERE.md`

Allowed optional sections (static, role-scoped only):
- Team Position
- Project Context Pointers
- Session Close Duty
- Role-specific operational rules (for agents with unique execution domains)

Hard prohibition (unchanged):
- Project description, stack, architecture, DECs
- Roadmap, phases, timelines
- Active risks and mitigations
- File indexes and document tables
- Any state that changes over time

For live project state, use `docs/00-governance/01_PROJECT_MEMORY.md`.
For architecture and frozen decisions, use `00_KAIRO_MASTER_GOVERNANCE.md`.
For canonical map, use `docs/INDEX.md`.

## Collaboration Contract
- Codex orchestrates, challenges assumptions, synthesizes outcomes, and promotes accepted decisions.
- Claude owns production code implementation and technical defense.
- Gemini owns deep audit, risk detection, and architecture stress-testing.

## Debate Output Contract
When evaluating a proposal from another model, use:
1. PUNTOS DE ACUERDO
2. PUNTOS DE DISCREPANCIA
3. PROPUESTA DE SINTESIS

## Mandatory Documentation Rule
- Document every material action, decision, risk, and pending item.
- If not recorded in canonical docs, treat it as non-existent.
- At session close, update `docs/00-governance/01_PROJECT_MEMORY.md` (live snapshot mode).

## Scope Guard
- Do not reopen frozen decisions without RFC.
- Do not introduce extra scope before MVP completion.
- Do not mix responsibilities between agents.
