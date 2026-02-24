# DEB-007 - Persona Files Hardening and Schema Alignment

Estado: CLOSED
Fecha apertura: 2026-02-24
Fecha cierre: 2026-02-24
Owner: Orchestrator (Codex/ChatGPT)

## Objetivo
Eliminar deriva entre persona files y gobernanza, y alinear el esquema de `AGENTS.md` con el estado real de `CODEX.md`, `CLAUDE.md`, y `GEMINI.md`.

## Puntos de Acuerdo (Consenso)
1. Persona files deben ser role-scoped y sin estado dinamico de proyecto.
2. La verdad de estado vive en `docs/00-governance/01_PROJECT_MEMORY.md`.
3. Las decisiones congeladas viven en `00_KAIRO_MASTER_GOVERNANCE.md`.
4. Startup sequence se delega a `00_TRIBUNAL_START_HERE.md`.

## Hallazgos Clave
- Contradiccion normativa detectada: `AGENTS.md` usaba "must contain only" mientras los tres persona files ya incluian secciones opcionales utiles y estaticas.
- `CLAUDE.md` y `GEMINI.md` requerian ajuste fino para paridad de contrato (CQL/attribution/debate output).

## Decisiones Aplicadas

### 1) Schema Alignment en `AGENTS.md`
- Se definio:
  - `Required sections (all 6)`
  - `Allowed optional sections (static, role-scoped only)`
  - `Hard prohibition (unchanged)` contra estado dinamico

### 2) Hardening de `CLAUDE.md`
- Eliminado estado dinamico/duplicado.
- Conservadas reglas role-specific de implementacion y seguridad.
- Agregado trigger CQL en scope de planning.
- Agregado recordatorio obligatorio de attribution tags.
- Titulo normalizado a `Claude Engineer and Technical Reviewer`.

### 3) Hardening de `GEMINI.md`
- Contrato de debate alineado a `PROPUESTA DE SINTESIS` (sin sufijo `/ VEREDICTO`).
- Agregado CQL en scope auditor (`flag ambiguities as CQL candidates`).
- Agregado guardrail de attribution tags.
- Agregado guardrail anti-noise de artifacts no canonicos.
- Naming normalizado (`Gemini Critical Auditor`, `Operating Rules (Critical)`).

### 4) Paridad de Triada de Personas
- `CODEX.md`, `CLAUDE.md`, `GEMINI.md` alineados al schema actualizado.
- Persisten secciones opcionales permitidas (team/context/session/role-specific) sin romper la prohibicion de estado dinamico.

## Resultado
- Persona hardening: CERRADO.
- Contradiccion de schema: CERRADA.
- Riesgo de state drift en persona files: MITIGADO.

## Riesgos Residuales
- Ningun P0/P1 activo en este frente.
- P2 operativo general: mantener disciplina anti-noise y evitar proliferacion de artefactos no canonicos.

## Referencias
- `AGENTS.md`
- `CODEX.md`
- `CLAUDE.md`
- `GEMINI.md`
- `00_TRIBUNAL_START_HERE.md`
- `docs/00-governance/01_PROJECT_MEMORY.md`
