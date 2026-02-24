# DEB-003 - Project Memory Mode + Skill Audit

Estado: CLOSED
Fecha apertura: 2026-02-24
Fecha cierre: 2026-02-24
Owner: Orchestrator (Codex/ChatGPT)
Decision: GO CON CAMBIOS

## Sintesis Ejecutiva

Claude and Gemini converged on the same core direction:
- D1 approved as Option B (`estado vivo unico`).
- Skill/methodology are structurally solid but required operational hardening.
- Git absence is a critical blocker for traceability.

## Puntos de Acuerdo (Claude + Gemini)

1. Enforce live snapshot memory (Option B) to minimize context drift.
2. Strengthen operational guardrails (deadlock/no-go handling).
3. Clarify anti-noise rules to avoid documentation sprawl.
4. Keep user-bus workflow with copy/paste-ready packets.

## Puntos de Discrepancia Relevantes

- Claude pushed stronger execution framing (C1-C7 patchset).
- Gemini emphasized explicit deadlock handling and anti-overdocumentation phrasing.
No architectural contradiction between both outputs.

## Accepted Change Set (Promoted)

- C1 Boundary scope in `01_PROJECT_MEMORY.md`.
- C2 Ownership by scenario (tribunal vs 1:1 sessions).
- C3 Explicit definitions for session and round.
- C4 Operating modes (Planning vs Implementation).
- C5 Skill repositioned as reference, not canonical duplicate.
- C6 Instruction precedence with skills in `AGENTS.md`.
- C7 Git blocker promoted to immediate action in governance flow.

## Follow-up

Open `DEB-004_METHOD_HARDENING_PATCHSET` to validate wording and lock baseline.
