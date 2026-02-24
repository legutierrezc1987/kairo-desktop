# External Skill Distillation - architecture-patterns

Status: Distilled (not canonical governance)
Source: `skills/skill-externas/.agents/skills/architecture-patterns/SKILL.md`
Purpose: keep reusable architecture heuristics and reject runtime tutorial noise.

## Key Insight

The external skill has valid conceptual framing (Clean/Hexagonal/DDD), but most of its size is implementation tutorial content.
Use this file as decision support, not as runtime instruction.

## Keep

- Pattern taxonomy:
  - Clean Architecture
  - Hexagonal (Ports & Adapters)
  - DDD
- Best-practice heuristics (converted to checklist)
- Antipattern signals for audit

## Reject

- Framework/language-specific runtime code in core planning flow
- Missing/ghost references and assets
- Broad triggers that over-activate complex architecture for trivial scope

## Pattern Selection Heuristics

- Prefer simple/direct architecture for trivial CRUD and low domain complexity
- Prefer Hexagonal when substitution/testing of integrations is critical
- Prefer Clean when strict layer isolation and team boundaries are critical
- Prefer DDD when domain invariants, language, and boundaries are primary risk

## Loading Policy (Critical)

Do not load this file on every interaction.
Load only when:

1. Hypothesis phase is choosing architecture style (A/B path)
2. Debate phase has pattern-fit disagreement
3. Readiness Gate fails on architecture coherence
4. CQL includes pattern-selection ambiguity

## CQL Interrogatory (Pattern Fit)

- What breaks if we choose a simpler architecture?
- Which business risk requires this pattern?
- Which quality attribute is non-negotiable (testability/changeability/resilience)?
- Are we introducing architecture debt or reducing it?
- Is the pattern still justified at current scope and complexity?
