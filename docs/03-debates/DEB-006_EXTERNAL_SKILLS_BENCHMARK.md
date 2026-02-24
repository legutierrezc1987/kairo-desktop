# DEB-006 - External Skills Benchmark Assimilation

Estado: OPEN (FASE B ONLY - baseline v1.1 locked)
Fecha apertura: 2026-02-24
Owner: Orchestrator (Codex/ChatGPT)

## Objetivo
Ingerir skills externas de arquitectura, extraer patrones de alto valor y consolidarlos en la skill universal sin aumentar ruido documental.

## Artefacto Canonico Objetivo
- `skills/universal-architecture-tribunal/*`

## Entradas Esperadas del Usuario
- rutas/archivos de skills externas
- casos de uso donde esas skills brillan
- debilidades observadas

## Sintesis Recibida (Claude + Gemini + Codex)

### Puntos de Acuerdo
1. La skill universal ya es usable en produccion, pero necesitaba cierre de huecos operativos.
2. Se requeria reforzar: paralelismo/secuencialidad, attribution, control de trafico del user-bus y cierre de ronda.
3. Habia divergencia entre `SKILL.md` y `METHODOLOGY.md` en templates y reglas operativas.

### Puntos de Discrepancia
1. Nivel de recorte de referencias: propuesta extrema de eliminar varios archivos vs enfoque moderado.
2. Rol del benchmark externo: dependencia runtime vs referencia de mantenimiento.

### Decision Parcial de Codex (aplicada)
- PATCH-01: ACEPTADO (Round Completion Conditions en SKILL).
- PATCH-02: ACEPTADO (bootstraping explicito para greenfield).
- PATCH-03: ACEPTADO (sincronizacion de Methodology con Skill).
- PATCH-04: ACEPTADO PARCIAL (se reduce carga runtime; referencias quedan on-demand/maintenance).
- PATCH-05: ACEPTADO (license/attribution en intake benchmark).
- PATCH-06: ACEPTADO (manejo de respuesta parcial con waiver documentado).
- FA-01: ACEPTADO (Methodology `Mandatory Outputs per Round` sincronizado con Skill: +3 outputs).
- FA-02: ACEPTADO (wrappers por modelo en templates para eliminar edicion manual del usuario-bus).
- FA-03: ACEPTADO (limpieza de referencias huerfanas: `workflow.md` y `canonical-artifacts.md` eliminados).

### Pendiente para cerrar DEB-006
- Ingerir skills externas reales compartidas por el usuario y ejecutar matriz KEEP/ADAPT/REJECT sobre evidencia concreta.
- Validar propuesta de "questioning loop" para detectar si agrega valor o ruido antes de promoverla.

### Intake Result - `architecture-patterns` (first external skill)
- Status: GO CON CAMBIOS (high reject ratio, selective extraction).
- KEEP: conceptual taxonomy (Clean/Hex/DDD), pitfalls/best-practice heuristics.
- ADAPT: moved distilled decision heuristics to:
  - `docs/04-research/external-skills/architecture-patterns.md`
  - `skills/universal-architecture-tribunal/references/architecture-checklists.md` (pattern evaluation + antipattern triggers)
- REJECT: runtime tutorial code, Python-specific examples, ghost references/assets.

### Intake Result - `nodejs-backend-patterns` (second external skill)
- Status: GO CON CAMBIOS (very high reject ratio, selective extraction).
- KEEP: none as direct canonical text.
- ADAPT:
  - `skills/universal-architecture-tribunal/references/architecture-checklists.md`
  - Added `Execution Resilience & Production-Readiness` section.
  - Added antipattern triggers:
    - `Flat Error Handling`
    - `Resource Starvation Vectors`
- REJECT: Node/Express/Fastify runtime tutorial content and framework-specific implementation blocks.
- Policy: trigger-based loading only (not always-on).

### Decision on "read every interaction"
- Rejected.
- Reason: guaranteed context bloat and lower signal-to-noise ratio.
- Approved policy: load by trigger only (Hypothesis disagreement, pattern-fit CQL, readiness mismatch).

### CQL Consensus Outcome (Claude + Gemini + Codex)
- Decision: APPROVED WITH GUARDRAILS (integrated as v1.2 candidate).
- Guardrails adopted:
  - Planning-mode only
  - material ambiguity threshold (decision/risk impacting)
  - max 3 open items per round
  - Open-only persistence in live memory
  - full history in DEB/RFC
  - close before readiness unless explicit user waiver
- Schema decision:
  - mandatory: `Question | Why it matters | Status`
  - optional: `QREF` assigned by Codex when needed (not mandatory to avoid overhead)

## Marco de Evaluacion (KEEP / ADAPT / REJECT)
1. Trigger quality
2. Workflow repeatability
3. Rigor arquitectonico (tradeoffs + riesgos + readiness)
4. Gobernanza y trazabilidad
5. Costo operativo del usuario-bus
6. Portabilidad multi-dominio

## Paquete para Claude (copy/paste)

```md
[TAREA PARA CLAUDE - IMPLEMENTACION]
Objetivo:
Evaluar skills externas y proponer integraciones concretas a la skill universal sin romper ejecutabilidad.

Salida requerida:
- KEEP / ADAPT / REJECT por patron
- RIESGOS OPERATIVOS
- PATCHES DE TEXTO EXACTOS
- VEREDICTO FINAL
```

## Paquete para Gemini (copy/paste)

```md
[TAREA PARA GEMINI - AUDITORIA]
Objetivo de auditoria:
Stress-test de patrones externos para evitar deriva, sobre-documentacion y degradacion de contexto.

Salida requerida:
- KEEP / ADAPT / REJECT por patron
- RIESGOS CRITICOS (P0/P1/P2)
- RECOMENDACIONES PRIORIZADAS
- VEREDICTO FINAL
```

## Decision
Pendiente de cierre final tras intake externo (GO / GO CON CAMBIOS / NO-GO)

## Phase B Cutoff Rule (agreed)

- Target sample size: 4 external skills total for Phase B.
- Completed so far: 2 (`architecture-patterns`, `nodejs-backend-patterns`).
- Remaining capacity: up to 2 additional external skills.
- If the next 2 skills both contribute <20% reusable governance signal and introduce no new P1/P0 heuristics, close DEB-006 Phase B.
- User may close Phase B early at any time if ROI is judged insufficient.
