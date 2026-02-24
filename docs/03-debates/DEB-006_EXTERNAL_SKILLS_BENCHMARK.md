# DEB-006 - External Skills Benchmark Assimilation

Estado: OPEN (FASE A CONSOLIDADA)
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
