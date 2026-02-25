---
name: universal-architecture-tribunal
description: Universal software-architecture planning and governance skill for multi-model collaboration (ChatGPT orchestrator, Claude implementer, Gemini auditor). Use when the user wants to transform an idea into an executable architecture through structured debates, consensus decisions, risk control, and canonical documentation without context loss.
---

# Universal Architecture Tribunal

Run a portable architecture-planning system for any project domain.

## Use This Skill To

- turn fuzzy ideas into architecture decisions with explicit tradeoffs
- run cross-model debates and converge to consensus
- prevent context drift across many sessions
- produce canonical artifacts that implementation teams can execute

## Scope

Focus on planning, architecture, governance, and decision quality.
Do not implement production code as part of this skill workflow.
`Implementation-Prep` means handoff-ready planning only (owners, validations, risks, rollout/rollback), not coding.

## Startup Sequence

1. Read the project bootstrap file if present (`00_TRIBUNAL_START_HERE.md` or equivalent).
2. Read routing/governance files (`AGENTS.md`, governance docs, active DEB/RFC files).
3. Read the live memory snapshot file (for example: `PROJECT_MEMORY.md`).
4. Identify active mode (`Planning` or `Implementation-Prep`).

If bootstrap/governance files do not exist, create these minimal files before debating:

1. `TRIBUNAL_START_HERE.md`:
- startup order
- session contract (start/during/end)
- live memory scope boundary
- deadlock rule

2. `AGENTS.md`:
- team hierarchy (director, orchestrator, implementer, auditor)
- instruction precedence (user > governance > persona > skills)
- debate output contract

3. `PROJECT_MEMORY.md`:
- editing rule (live snapshot only)
- current snapshot (objective, active debates)
- pending list (priority ordered)
- known risks + mitigations
- next step + next owner

Use the project name as prefix for domain-specific governance files.

## Core Operating Rules

1. Zero assumptions
- Ask for missing facts before freezing architecture.
- Critical Question Loop (CQL):
  - Activate only in Planning mode when:
    - ambiguity blocks a GO/NO-GO decision, or
    - unanswered ambiguity creates business-impact technical risk.
  - Limit: maximum 3 open CQL questions per round.
  - Format per question:
    - `Question | Why it matters | Status (Open / Answered / Accepted-Risk / Escalated-RFC)`
  - Optional reference (`QREF`) can be assigned by Codex during synthesis when needed.
  - Keep only `Open` CQL items in live memory (one-line summary each).
  - Store full CQL resolution history in active DEB/RFC files.
  - Resolved CQL items must be purged from live memory snapshot.
  - All Open CQL items must be closed before Readiness Gate unless user explicitly waives:
    - `[Waived: CQL - reason: <reason>]`

2. Debate discipline
- Every proposal must include:
  - PUNTOS DE ACUERDO
  - PUNTOS DE DISCREPANCIA
  - PROPUESTA DE SINTESIS

3. Mandatory tradeoffs
- Every recommendation must include:
  - [PROS]
  - [CONTRAS]
  - [VEREDICTO]

4. Live memory policy
- Keep one live snapshot file for current truth.
- Keep historical rationale in DEB/RFC/governance files and VCS history.

5. Deadlock protocol
- If result is `NO-GO`, issue a reframe package with at least 2 alternatives (A/B).
- If 2 consecutive rounds are blocked, escalate to user final decision.

6. Anti-noise artifact policy
- One canonical file per topic.
- One active draft per topic.
- Merge or archive drafts within one debate cycle.

7. Attribution policy
- Every promoted decision must include model attribution tags:
  - `[Proposed: <model>]`
  - `[Audited: <model>]`
  - `[Synthesized: Codex]`
  - `[Approved: User]`

## Multi-Model Role Model

- ChatGPT/Codex: orchestrator and synthesis owner
- Claude: implementation feasibility and delivery constraints
- Gemini: audit, risk, and architecture stress testing
- User: director and message bus

When running 1:1 with only one model, require `MEMORY_PATCH` output for later synthesis.

## Execution Topology (Mandatory)

- Parallel allowed:
  - Hypothesis
  - Debate
  - Feasibility/risk analysis by Claude and Gemini on the same proposal
- Sequential mandatory:
  - Synthesis
  - Canonical promotion
  - Any final user decision checkpoint

Codex must not advance to synthesis until both parallel responses are received or explicitly waived by the user.

If one model response is missing:
- Codex may proceed with single-model synthesis only if user explicitly waives the missing response.
- The waiver must be documented as: `[Waived: <model> response - reason: <reason>]`.
- If the missing response arrives later, evaluate it in the next round (no retroactive insertion).

## Workflow Phases

1. Intake
- Capture business goal, constraints, quality attributes, compliance context, and success metrics.

2. Hypothesis
- Propose 2-3 architecture options with tradeoffs.

3. Debate
- Send structured packets to implementer and auditor.
- Collect and compare objections, gaps, and conflicts.

4. Synthesis
- Select one path or composite path.
- Record accepted and rejected decisions with reasons.

5. Canonical Promotion
- Update canonical docs + live memory snapshot.
- Set next owner and exact next step.

6. Readiness Gate
- Verify plan is executable (owners, validations, risks, rollback).

## Delivery Control (User-Bus Traffic)

Codex must always provide a copy/paste-ready routing block:
- Codex must include PUNTO DE VISTA INICIAL DE CODEX in every outgoing packet (critical hypothesis, key objections, provisional verdict).

```md
[ROUTE_INSTRUCTIONS]
1. Send Packet A to Claude and Packet B to Gemini in parallel.
2. Wait for both answers before returning.
3. Paste both responses exactly as received (do not edit formatting).
4. If wrapper tags are missing, request resend from the corresponding model.
5. Do not proceed to synthesis until both responses exist (unless user waives).
```

## Required Outputs Per Round

- one-paragraph decision summary
- accepted actions (owner + validation condition)
- rejected actions (with reason)
- active risks + mitigations
- open CQL items (if any)
- exact next step + next owner
- copy/paste packet for next model
- `ROUTE_INSTRUCTIONS` block
- attribution tags for promoted decisions
- codex initial viewpoint block included in outgoing packets

## Round Completion Conditions

A round is complete only when all conditions are true:
- decision status is explicit (GO / GO WITH CHANGES / NO-GO)
- next owner is explicit
- next step is explicit and actionable
- live memory snapshot is updated (or `MEMORY_PATCH` emitted in 1:1 sessions)
- attribution tags are present for promoted decisions

If any condition is missing, the round remains open.

## Minimal Packet Templates

### Packet to Claude

```md
[TAREA PARA CLAUDE - IMPLEMENTACION]
PUNTO DE VISTA INICIAL DE CODEX:
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

### Packet to Gemini

```md
[TAREA PARA GEMINI - AUDITORIA]
PUNTO DE VISTA INICIAL DE CODEX:
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

### Response Back (Schema Reference)

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

## References

Load references only when needed (do not load all by default):
- `references/architecture-checklists.md`
- `references/debate-rubric.md`

Maintenance reference (do not load in normal rounds):
- `references/external-skill-benchmark.md`


