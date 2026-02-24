# KAIRO_DESKTOP — CIERRE DEFINITIVO DE DEBATE
## Ronda 2 Completa | Claude Architect — Análisis Final
### 24 de Febrero 2026

---

# 1. ANÁLISIS DE CONVERGENCIA

Los 3 modelos han llegado a consenso total en la arquitectura base.
Lo que queda son **refinamientos de implementación**, no discrepancias arquitectónicas.

## 1.1 Consenso Completo (los 3 modelos coinciden)

- Umbral 200K tokens ✅ (Gemini aceptó formalmente bajar del 60%)
- Corte triple: tokens + 40 turnos + hito manual ✅
- Zona Roja inmutable en ambos modos ✅
- Upload async en background ✅
- MemoryProvider pluggable ✅
- Motor de consolidación a las 40 fuentes ✅
- Recall event-driven, no per-turn ✅
- jacob-bd/notebooklm-mcp-cli como MCP ✅
- Modo dual per-project (no global) ✅
- Tool calls en JSON estricto ✅

## 1.2 Ideas Nuevas de Ronda 2 que ADOPTO (3 de alto impacto)

### IDEA A — Multi-Model Routing (Gemini R2) ⭐ CRÍTICA

**Concepto:** No usar Gemini 3.1 Pro para TODO. Usar Flash para tareas de background.

```
Gemini 3.1 Pro (Foreground):
  - Chat con el usuario
  - Razonamiento de código
  - Decisiones arquitectónicas
  - Function calling (tool use)

Gemini Flash (Background, invisible al usuario):
  - Resumir output de terminal (5000 líneas → 50 líneas)
  - Comprimir diffs largos
  - Generar Summary.md durante el corte
  - Resumir respuestas de NotebookLM si exceden presupuesto
```

**[PROS]:**
- Latencia de background casi cero (Flash es 10x más rápido)
- Costo reducido ~80% en tareas de mantenimiento
- Pro se dedica 100% a lo que importa: razonar con el usuario

**[CONTRAS]:**
- Dos instancias del SDK en memoria (impacto menor, ~50MB extra)
- Posible inconsistencia de estilo entre resúmenes de Flash vs Pro
- Requiere lógica de routing en el Orchestrator

**VEREDICTO DE CLAUDE:** Adoptado sin reservas. Es la optimización
más inteligente del debate entero. Nexus propuso el Token Budgeter
por canales, pero Gemini resolvió el CÓMO ejecutar esa compresión
sin gastar tokens caros.

---

### IDEA B — Tool Schema JSON Estricto (Nexus R2) ⭐ CRÍTICA

**Concepto:** El agente emite tool calls en JSON estricto, no en texto libre.
El Execution Broker parsea JSON, no regex sobre markdown.

```json
// El agente emite:
{
  "tool": "run_command",
  "args": {
    "command": "npm install express",
    "cwd": "C:/proyectos/mi-app"
  }
}

// El Broker:
// 1. Parsea JSON
// 2. Clasifica "npm install" → ZONA AMARILLA
// 3. Verifica modo (Auto/Supervisado)
// 4. Ejecuta o pide permiso
// 5. Retorna resultado al agente
```

**Catálogo de Tools definido por Nexus + Gemini fusionados:**

```
TOOL SCHEMA CANÓNICO:

1. run_command
   args: { command: string, cwd?: string, timeout_ms?: number }
   desc: Ejecutar comando en terminal
   broker: Clasifica por zonas → ejecuta o bloquea

2. read_file
   args: { path: string, start_line?: number, end_line?: number }
   desc: Leer archivo completo o rango de líneas
   broker: Solo dentro del workspace

3. write_file
   args: { path: string, content: string }
   desc: Crear o sobrescribir archivo completo
   broker: Solo dentro del workspace

4. apply_patch
   args: { path: string, start_line: number, end_line: number, new_content: string }
   desc: Reemplazar rango de líneas (NO reescribir archivo completo)
   broker: Solo dentro del workspace (idea Gemini: "sliding window")

5. list_dir
   args: { path: string, depth?: number }
   desc: Listar estructura de directorios
   broker: Solo dentro del workspace

6. open_in_editor
   args: { path: string, line?: number }
   desc: Abrir archivo en Monaco Editor y posicionar cursor
   broker: Sin restricción (es lectura visual)

7. recall
   args: { query: string, mode?: "summary" | "detailed" | "decisions" | "errors" }
   desc: Consultar NotebookLM para contexto histórico
   broker: Siempre permitido

8. checkpoint
   args: { reason?: string }
   desc: Forzar corte manual de sesión
   broker: Siempre permitido
```

**VEREDICTO DE CLAUDE:** Adoptado. Esto elimina el caos de parsear
respuestas en texto libre. Gemini API soporta function calling nativo,
así que estos tools se definen como `functionDeclarations` en el SDK.
El agente los invoca, el SDK retorna JSON tipado, el Broker actúa.

---

### IDEA C — Workspace Sandbox (Nexus R2) ⭐ IMPORTANTE

**Concepto:** En modo automático, el agente SOLO opera dentro de
`project.folder_path`. Si necesita acceder fuera del workspace,
requiere confirmación explícita incluso en automático.

```
REGLA DE SANDBOX:

  Todas las operaciones de archivo (read/write/delete/patch):
    IF path.startsWith(project.folder_path) → permitido según modo
    ELSE → SIEMPRE requiere confirmación (incluso en automático)

  Todos los comandos de terminal (run_command):
    IF cwd está dentro de project.folder_path → permitido según modo
    ELSE → SIEMPRE requiere confirmación

  SETTING OPCIONAL (desactivado por defecto):
    "allow_outside_workspace": false
    Si el usuario lo activa, el agente puede operar fuera en modo auto
```

**VEREDICTO DE CLAUDE:** Adoptado. Es la diferencia entre un producto
"usable" y un producto "vendible". Si quieres productizar en 6 meses,
NECESITAS esta capa de seguridad. Además, la implementación es trivial:
un `path.startsWith()` antes de cada operación.

---

## 1.3 Ideas Nuevas de Impacto Medio

### IDEA D — System Prompt como Máquina de Estados (Gemini R2)

Gemini propone que el system prompt cambie dinámicamente según el modo.

**Mi posición:** Parcialmente de acuerdo. El system prompt base es FIJO
(personalidad, reglas, tools). Lo que cambia es un BLOQUE INYECTADO
que define los permisos actuales:

```
SYSTEM PROMPT = BASE (fijo) + MODE_BLOCK (dinámico) + CONTEXT (variable)

BASE: Identidad, reglas de operación, catálogo de tools
MODE_BLOCK:
  - Supervisado: "Usa request_command. Espera aprobación."
  - Automático: "Usa execute_command directamente. Si falla,
    autocorrígete hasta 3 veces antes de pedir ayuda."
CONTEXT: project_name, folder, model, session, recall_bootstrap
```

No es un "motor de estados" completo como dice Gemini — es un bloque
inyectable. Más simple, mismo resultado.

### IDEA E — Testing Strategy (Gemini R2)

Gemini dice: "Unit tests solo para Execution Broker + Token Counter.
MCP testing manual. E2E de Electron es un infierno."

**Mi posición:** De acuerdo al 90%. Agrego:

```
TESTING STRATEGY MVP:

  UNIT TESTS (Vitest):
    ✅ Execution Broker — Zona Roja NUNCA pasa
    ✅ Command Classifier — clasificación correcta
    ✅ Token Budgeter — presupuestos por canal
    ✅ Workspace Sandbox — paths fuera del workspace bloqueados

  INTEGRATION TESTS (manual con scripts):
    ✅ Gemini API — enviar/recibir con function calling
    ✅ MCP — crear notebook + subir fuente + query
    ✅ Pipeline de corte completo

  E2E (Playwright — solo lo crítico):
    ✅ Chat envía mensaje y recibe respuesta
    ✅ Terminal ejecuta comando y muestra output
    ✅ Kill Switch detiene ejecución

  NO TESTEAR EN MVP:
    ❌ MCP E2E automatizado (frágil, testing manual)
    ❌ Electron packaging (verificar manualmente)
```

### IDEA F — Límites Diarios de NotebookLM (Nexus R2)

Nexus advierte que NotebookLM tiene ~50 chats/día como límite.

**Mi posición:** Dato relevante. Lo agrego como riesgo R9 y lo mitigo
con la política de recall event-driven (ya en su lugar). Si el límite
se alcanza, el fallback local toma el control del recall.

---

## 1.4 Discrepancias Menores Cerradas

| Punto | Nexus | Gemini | Claude | Resolución |
|-------|-------|--------|--------|-----------|
| Recall periódico | cada 6 turnos | no especifica | cada 8 turnos | **8 turnos** (configurable). Menor uso de quota NLM |
| Nombre del modo | "Automático" | "God Mode" | "Automático" | **"Automático" en UI**, `god_mode` en código. Per-project. |
| Consolidación trigger | 40 fuentes | 40 fuentes | 40 fuentes | **Unánime: 40** |
| Tool format | JSON estricto | JSON (function calling) | JSON | **Unánime: JSON** via functionDeclarations |

---

# 2. DECISIONES DEL USUARIO (RONDA 2 — NUEVAS)

| # | Pregunta | Respuesta | Impacto |
|---|----------|-----------|---------|
| D15 | Tool calls: JSON o bloques etiquetados | **JSON estricto** (recomendado) | Function calling nativo de Gemini API |
| D16 | God Mode: per-project o global | **Per-project** (cada proyecto tiene su modo) | Campo `agent_mode` ya existe en PROJECTS |
| D17 | Naming de archivos de documentación | **Claude propone nombres, usuario documenta** | Ver sección 3 de este documento |

---

# 3. CONVENCIÓN DE ARCHIVOS DE DOCUMENTACIÓN

El usuario pidió que proponga nombres de archivo para cada documento
consolidado, para que pueda copiar/pegar y archivar ordenadamente.

```
ARCHIVOS DEFINITIVOS (copiar/pegar en orden):

01_KAIRO_PRD_FINAL_v3.md
   Contenido: PRD completo con todas las secciones
   Estado: ✅ Generar ahora (post R2 closure)

02_KAIRO_TOOL_SCHEMA.md
   Contenido: Catálogo completo de tools del agente (JSON)
   Estado: ✅ Incluido en este cierre

03_KAIRO_SYSTEM_PROMPT.md
   Contenido: System prompt completo (base + mode blocks)
   Estado: ✅ Incluido en PRD v3

04_KAIRO_DB_SCHEMA.sql
   Contenido: Schema SQL ejecutable para SQLite
   Estado: 🔜 Generar en Fase 1

05_KAIRO_FOLDER_STRUCTURE.md
   Contenido: Estructura de carpetas con descripciones
   Estado: ✅ Incluido en PRD v3

06_KAIRO_ROADMAP.md
   Contenido: Gantt detallado + criterios por fase
   Estado: ✅ Incluido en PRD v3

07_KAIRO_DEBATE_HISTORY.md
   Contenido: Resumen de todos los debates (R1 + R2)
   Estado: ✅ Este documento

ARCHIVOS FUTUROS (durante implementación):
08_KAIRO_SETUP_GUIDE.md      — Paso a paso para levantar el entorno
09_KAIRO_MCP_INTEGRATION.md  — Guía de integración NotebookLM
10_KAIRO_TESTING_PLAN.md     — Plan de testing detallado
```

---

# 4. CAMBIOS A APLICAR AL PRD v3

| # | Sección del PRD | Cambio | Origen |
|---|----------------|--------|--------|
| 1 | NUEVA Sección 7.3 | Multi-Model Routing (Pro + Flash) | Gemini R2 |
| 2 | NUEVA Sección 10.5 | Workspace Sandbox | Nexus R2 |
| 3 | NUEVA Sección 21 | Tool Schema completo (8 tools) | Nexus R2 + Gemini R2 |
| 4 | Sección 19 | System Prompt: agregar mode blocks dinámicos | Gemini R2 |
| 5 | Sección 18 | Agregar R9: límites diarios NotebookLM | Nexus R2 |
| 6 | Sección 20 | Agregar criterio: tool calls JSON parsean correctamente | Síntesis |
| 7 | NUEVA Sección 22 | Testing Strategy | Gemini R2 + Claude |
| 8 | Decisiones cerradas | Agregar D15, D16, D17 | Usuario R2 |

---

# 5. CRÉDITO FINAL POR MODELO

| Modelo | Contribuciones Principales |
|--------|---------------------------|
| **Claude Architect** | Arquitectura general, síntesis de debates, umbral 200K, ERD completo, estructura de carpetas, roadmap, presupuesto por canales escalado, kill switch spec, workspace sandbox adoption, system prompt base |
| **Gemini Architect** | node-pty spec, async workers, terminal truncation (50 líneas), turn limit 40, **Multi-Model Routing** (la optimización más valiosa), file sliding window (read_file_lines/apply_patch), testing pragmatism, "God Mode" naming |
| **Nexus (ChatGPT)** | **Token Budgeter por canales** (la idea más innovadora), **MemoryProvider pluggable**, **Tool Schema JSON** (catálogo de 8 tools), recall triggers event-driven, multi-cuenta, kill switch idea, **Workspace Sandbox**, emergency cut, presets de umbral, límites diarios NLM |

---

# 6. VEREDICTO FINAL

**EL DEBATE HA TERMINADO.**

No quedan discrepancias abiertas. Las únicas diferencias son
preferencias menores resueltas con configurabilidad (presets, turnos
de recall, nombres de modo).

Gemini lo dijo bien: "Cualquier debate adicional sobre la arquitectura
base sería procrastinación disfrazada de planificación."

**Próximo paso inmediato:** Generar PRD v3 con los 8 cambios listados
y comenzar Fase 1 del Roadmap.
