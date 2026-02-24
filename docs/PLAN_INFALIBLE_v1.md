# PLAN INFALIBLE DE ORGANIZACION Y CONTINUIDAD (v1)

Status: DRAFT CONTROLADO
Lifecycle: To be merged into canonical methodology or archived after DEB-001 closure.
Fecha: 2026-02-24
Orquestador: ChatGPT/Codex
Alcance: organizacion documental + continuidad de planificacion hasta ejecucion en codigo

## 1) Diagnostico Brutal (estado real)

- Mezcla de perfiles de agentes y documentos de producto en la raiz.
- Hay dos PRD casi equivalentes (`v3` y `v3-1`), riesgo de desalineacion.
- Hay archivos de investigacion con nombres inconsistentes (espacios/acentos).
- Faltan 4 documentos operativos criticos para convertir plan en codigo:
  - `04_KAIRO_DB_SCHEMA.sql`
  - `08_KAIRO_SETUP_GUIDE.md`
  - `09_KAIRO_MCP_INTEGRATION.md`
  - `10_KAIRO_TESTING_PLAN.md`
- No existe pipeline formal de control de cambios documentales (RFC operativo para docs).

## 2) Objetivo

Crear una estructura documental anti-ruido, trazable y preparada para ejecucion, donde cada decision arquitectonica tenga:
- fuente de verdad unica
- estado claro
- ruta de implementacion
- criterio de aceptacion

## 3) Propuesta de Estructura

Ver `docs/INDEX.md`.

## 4) Debate Tribunal (obligatorio antes de mover archivos nucleares)

Se abre: `DEB-001_DOC_STRUCTURE_ALIGNMENT`

### Preguntas de conflicto tecnico

1. Debe `v3-1` reemplazar formalmente a `v3` como canonico unico?
2. Conviene mover perfiles de agentes a `/docs/05-agent-profiles` o mantenerlos en raiz por ergonomia?
3. Se acepta politica de nombres sin espacios/acentos para futuros archivos?
4. Como versionamos actualizaciones sin multiplicar archivos (v4, v5, etc.)?

## 5) Plan Gradual (sin romper)

### Fase A - Fundacion (hoy)

- Crear estructura `docs/`.
- Crear index canonico.
- Abrir DEB-001 y recopilar veredictos de Claude/Gemini.

### Fase B - Normalizacion Controlada

- Congelar archivos canonicos activos.
- Mover `01_KAIRO_PRD_FINAL_v3.md` a `docs/01-prd/archive/`.
- Definir estado oficial de cada documento en `docs/INDEX.md`.

### Fase C - Trazabilidad Ejecutable

- Crear `08_KAIRO_SETUP_GUIDE.md` (Fase 0)
- Crear `04_KAIRO_DB_SCHEMA.sql` (Fase 3)
- Crear `09_KAIRO_MCP_INTEGRATION.md` (Fase 4)
- Crear `10_KAIRO_TESTING_PLAN.md` (Fase 7)

### Fase D - Continuidad Operativa

- Cada sesion inicia leyendo:
  1. `docs/00-governance/00_KAIRO_MASTER_GOVERNANCE.md`
  2. `docs/INDEX.md`
  3. checklist de fase activa
- Cada cierre de sesion actualiza estado y bloqueos.

## 6) Quality Gates (Bulletproof)

Gate G1 - Coherencia
- No hay 2 fuentes activas para el mismo tema.

Gate G2 - Trazabilidad
- Toda DEC referenciada apunta a un doc existente.

Gate G3 - Ejecutabilidad
- Cada modulo del roadmap tiene entregable, validacion y duenio.

Gate G4 - Seguridad
- Riesgos criticos con mitigacion verificable (Broker, Sandbox, MCP fallback).

Gate G5 - Testabilidad
- Cada fase tiene evidencia de prueba definida antes de codificar.

## 7) Riesgos y Mitigacion

- Riesgo: ruptura por mover paths.
  - Mitigacion: mover por lotes + verificacion de referencias + rollback.
- Riesgo: debate infinito.
  - Mitigacion: timebox 1 ronda por modelo + sintesis final del orquestador.
- Riesgo: duplicacion documental futura.
  - Mitigacion: politica de documento canonico unico + archivo historico.

## 8) Definicion de Exito

- Arbol documental unificado y sin ambiguedades.
- PRD activo unico.
- Fases pendientes convertidas en documentos operativos con criterios testables.
- Tribunal alineado y sin colisiones de rol.

## 9) Prompts listos para copiar y pegar

### 9.1 Para Claude (implementador)

```md
[TAREA PARA CLAUDE - IMPLEMENTACION]
Objetivo:
Validar y mejorar la propuesta de estructura documental de KAIRO.

Contexto minimo:
Revisa `docs/INDEX.md` y `docs/PLAN_INFALIBLE_v1.md`.

Restricciones:
- No reabrir DEC congeladas sin RFC.
- Priorizar trazabilidad a implementacion.
- Detectar impactos en paths y referencias cruzadas.

Salida requerida:
1) PUNTOS DE ACUERDO
2) PUNTOS DE DISCREPANCIA
3) AJUSTES PROPUESTOS AL ARBOL
4) CHECKLIST TECNICO DE MIGRACION
5) VEREDICTO FINAL (GO / NO-GO)
```

### 9.2 Para Gemini (auditor)

```md
[TAREA PARA GEMINI - AUDITORIA]
Objetivo de auditoria:
Auditar la propuesta de organizacion documental y continuidad de planificacion.

Alcance:
`docs/INDEX.md` y `docs/PLAN_INFALIBLE_v1.md`.

Riesgos a estresar:
- colision de fuentes de verdad
- deuda documental
- riesgos de gobernanza
- huecos para pasar de plan a codigo

Salida requerida:
- PUNTOS DE ACUERDO
- PUNTOS DE DISCREPANCIA
- RIESGOS CRITICOS
- RECOMENDACIONES PRIORIZADAS
- VEREDICTO DE AUDITORIA (GO / GO CON CAMBIOS / NO-GO)
```

## 10) Siguiente paso operativo

Cuando pegues y recuperes respuestas de Claude y Gemini, se consolida una sintesis final y se ejecuta la migracion fisica definitiva de archivos.
