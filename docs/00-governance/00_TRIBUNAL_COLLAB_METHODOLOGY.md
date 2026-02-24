# TRIBUNAL Collaboration Methodology

Version: 1.3
Status: ACTIVE
Last Updated: 2026-02-24
Owner: Codex/ChatGPT (Orchestrator)

## Objective
Guarantee multi-agent collaboration without context loss, hallucination drift, or documentation gaps.

## Core Principle
Everything important must be documented. No loose ends.

## Definitions
- Session: one uninterrupted interaction with one model instance.
- Round: Codex frame -> Claude/Gemini reviews -> Codex synthesis -> user decision.

## Role Matrix
- User: Director + message bus.
- Codex: Orchestrator + synthesis owner + canonical-doc promoter.
- Claude: Implementation owner.
- Gemini: Audit owner.

## Ownership by Scenario
- Scenario S1 (Tribunal round): Codex updates canonical docs and project memory.
- Scenario S2 (User <-> Claude only): Claude must return a `MEMORY_PATCH` block.
- Scenario S3 (User <-> Gemini only): Gemini must return a `MEMORY_PATCH` block.
- Scenario S4 (User returns to Codex): Codex validates and promotes patch to canonical docs.

## Collaboration Cycle (One Round)

1. Frame
- Codex defines objective, constraints, acceptance criteria, and mode (Planning/Implementation).

2. Parallel Review
- User sends packets to Claude and Gemini.
- Claude returns implementation-focused output.
- Gemini returns audit-focused output.

3. Synthesis
- Codex evaluates both using:
  - PUNTOS DE ACUERDO
  - PUNTOS DE DISCREPANCIA
  - PROPUESTA DE SINTESIS

4. Decision
- User selects GO / GO WITH CHANGES / NO-GO.

5. Promotion
- Codex updates canonical docs.
- Codex updates `01_PROJECT_MEMORY.md`.

6. If NO-GO
- Codex must emit a reframe package (A/B path with tradeoffs).
- If two consecutive NO-GO outcomes persist, user decides final route.

## Operating Modes
- Planning mode (high rigor): pros/cons/verdict, alternatives, risks, dependencies.
- Implementation mode (low overhead): decision, changed artifacts, validations, next step.

## Execution Topology
- Parallel allowed: Hypothesis, Debate, independent feasibility/risk analysis.
- Sequential mandatory: Synthesis, Canonical Promotion, user decision checkpoints.
- Codex must not advance to synthesis until both parallel responses are received or explicitly waived by user.
- If one response is missing, Codex may proceed only with explicit user waiver documented as:
  - `[Waived: <model> response - reason: <reason>]`

## Attribution Policy
Every promoted decision must include:
- `[Proposed: <model>]`
- `[Audited: <model>]`
- `[Synthesized: Codex]`
- `[Approved: User]`

## Project Memory Boundary (Critical)
`01_PROJECT_MEMORY.md` stores only live state:
- current objective
- active debates/RFCs
- pending priority list
- known risks + mitigations
- exact next step + owner

Do not store full historical rationale in project memory.
Historical rationale belongs to:
- debate files
- RFC files
- governance docs
- Git history

## Mandatory Outputs per Round
- Decision summary.
- Accepted actions (owner + validation).
- Rejected actions (with reason).
- Risks and mitigations.
- Next exact step + next owner.
- Copy/paste packet for next model (if round continues).
- `ROUTE_INSTRUCTIONS` block (when dispatching to multiple models).
- Attribution tags for promoted decisions.

## Round Completion Conditions
A round is complete only when all are true:
- decision status explicit (GO / GO WITH CHANGES / NO-GO)
- next owner explicit
- next step explicit and actionable
- live memory updated (or `MEMORY_PATCH` in 1:1 sessions)
- attribution tags present for promoted decisions

## Session Continuity Protocol
At session start:
1. Read `00_TRIBUNAL_START_HERE.md`.
2. Read `01_PROJECT_MEMORY.md`.
3. Read active debate/RFC files.
4. Continue from `Next Step` only.

At session close:
1. Update `01_PROJECT_MEMORY.md` in live-snapshot mode.
2. Remove resolved pending items.
3. Log unresolved blockers and handoff packet.

## Artifact Policy
- Canonical files: stable names, no churn.
- Working drafts: temporary and timeboxed to one debate cycle.
- Archive after merge completion.

## File Creation Policy
Create new files only if one is true:
- introduces a new domain artifact
- isolates a reusable template
- prevents unsafe concern mixing

Otherwise, update existing canonical files.

## Communication Packets

### Packet A - To Claude

```md
[TAREA PARA CLAUDE - IMPLEMENTACION]
Objetivo:
Contexto minimo:
Restricciones DEC/RFC:
Dependencias paralelas:
Criterios de aceptacion:
Entregable:

Formato de respuesta obligatorio:
<claude_resp>
[RESPUESTA DE MODELO]
MODELO: Claude
ATRIBUCION: [Proposed: Claude] or [Audited: Claude]
PUNTOS DE ACUERDO:
PUNTOS DE DISCREPANCIA:
RIESGOS CRITICOS:
RECOMENDACION:
MEMORY_PATCH:
</claude_resp>
```

### Packet B - To Gemini

```md
[TAREA PARA GEMINI - AUDITORIA]
Objetivo de auditoria:
Alcance:
Riesgos a estresar:
Dependencias paralelas:
Criterios de evaluacion:
Entregable:

Formato de respuesta obligatorio:
<gemini_resp>
[RESPUESTA DE MODELO]
MODELO: Gemini
ATRIBUCION: [Proposed: Gemini] or [Audited: Gemini]
PUNTOS DE ACUERDO:
PUNTOS DE DISCREPANCIA:
RIESGOS CRITICOS:
RECOMENDACION:
MEMORY_PATCH:
</gemini_resp>
```

### Packet C - Back to Codex (Schema Reference)

```md
<claude_resp or gemini_resp>
[RESPUESTA DE MODELO]
MODELO: <Claude|Gemini>
ATRIBUCION: [Proposed: <model>] or [Audited: <model>]
PUNTOS DE ACUERDO:
PUNTOS DE DISCREPANCIA:
RIESGOS CRITICOS:
RECOMENDACION:
MEMORY_PATCH:
</claude_resp or gemini_resp>
```

## Quality Gates
- G1 Coherence: no contradictory active docs.
- G2 Traceability: each accepted decision references canonical section/file.
- G3 Executability: each plan item has owner + validation condition.
- G4 Security: high-impact risks have explicit mitigation.

## Escalation Rules
- Reopening a frozen DEC requires RFC.
- Blocking ambiguity must be resolved before implementation.
- Two consecutive NO-GO outcomes trigger user-level final decision.
