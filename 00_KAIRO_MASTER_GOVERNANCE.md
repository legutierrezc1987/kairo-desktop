# KAIRO_DESKTOP — PROJECT GOVERNANCE BOARD
## 00_KAIRO_MASTER_GOVERNANCE.md
### Versión: 1.0 | Última Actualización: 2026-02-24
### Generado por: Claude Architect (con correcciones a propuestas Nexus + Gemini)

---

# ESTADO GLOBAL

```
┌─────────────────────────────────────────────────────────────┐
│  KAIRO_DESKTOP — GOVERNANCE DASHBOARD                       │
│                                                             │
│  Estado:        🟢 ARQUITECTURA CONSOLIDADA                 │
│  Fase Activa:   Fase 0 — Setup Base                         │
│  Madurez:       Diseño Congelado / Implementación Pendiente │
│  Decisiones:    28 congeladas / 0 en debate                 │
│  Debates:       0 abiertos                                  │
│  RFCs:          0 pendientes                                │
│  Última DEC:    DEC-028 (Visibilidad UX 2 niveles)          │
│  Documentos:    3 finalizados / 4 pendientes                │
│  Riesgo Global: MEDIO-ALTO (dependencia MCP)                │
│  Viabilidad:    78% MVP en 6 meses                          │
└─────────────────────────────────────────────────────────────┘
```

---

# ⚠️ ERRORES CORREGIDOS DE LAS PROPUESTAS NEXUS / GEMINI

Antes de presentar el documento oficial, documento las correcciones:

| # | Error | Quién | Corrección |
|---|-------|-------|-----------|
| E1 | Token Presets marcado como "🟡 En debate" (DEB-002/DEB-007) | Nexus + Gemini | **INCORRECTO.** Cerrado en PRD v3 Sección 5.2: 200K default, preset Conservador 120K, Extenso 300K, Personalizado 100K-400K. Es DEC-017. |
| E2 | Consolidación NotebookLM marcada como "🟡 En debate" (DEB-001/DEB-008) | Nexus + Gemini | **INCORRECTO.** Cerrado en PRD v3 Sección 13: regla "40-1", fusionar cada 8-12 sesiones, Master Summary v{N}. Es DEC-022. |
| E3 | Multi-Model Routing listado como "RFC-001" | Gemini | **INCORRECTO.** Ya es decisión cerrada (PRD v3 Sección 7.3). Pro para foreground, Flash para background. Es DEC-019. |
| E4 | DB Schema marcado como "🟡 En debate" | Nexus | **INCORRECTO.** Cerrado en PRD v3 Sección 15 (7 tablas definidas con campos). Es DEC-023. |
| E5 | MCP NotebookLM marcado como "🟡 En debate" | Gemini | **PARCIALMENTE INCORRECTO.** El diseño está congelado (DEC-003 + DEC-020). Lo que falta es validación empírica en Fase 0 (checklist item 0.6). |
| E6 | Solo 4 DECs listadas | Ambos | **INCOMPLETO.** El PRD v3 tiene 17 decisiones del usuario + 11 decisiones arquitectónicas de debates = 28 DECs totales. |
| E7 | Roadmap con fases incorrectas (5-6 fases genéricas) | Ambos | **INCORRECTO.** El PRD v3 define 7 fases específicas con subtareas en un Gantt (Sección 19). |

**Impacto de estos errores:** Si entraban al proyecto sin corrección, en la primera sesión nueva alguien habría dicho "oye, los token presets siguen en debate" y se habría reabierto una discusión ya cerrada. Exactamente lo que este documento debe prevenir.

---

# 1. MACRO ROADMAP (ESTADO DE EJECUCIÓN)

Fases tomadas directamente del PRD v3 Sección 19 (Gantt):

| Fase | ID | Módulo | Semanas | Estado | Bloqueos | Entregable |
|------|----|--------|---------|--------|----------|-----------|
| 0 | SETUP | Entorno Base | Pre-1 | ⏳ Pendiente | Ninguno | Repo + scaffold funcional |
| 1 | SKELETON | Electron + UI + Chat | Sem 1-2 | 🔒 Diseño congelado | Fase 0 | 3 paneles + chat Gemini |
| 2 | OS-SEC | Terminal + Execution Broker | Sem 3-4 | 🔒 Diseño congelado | Fase 1 | PTY + zonas + modos |
| 3 | STATE | SQLite + Token Budgeter | Sem 5 | 🔒 Diseño congelado | Fase 2 | DB + Context Meter + multi-cuenta |
| 4 | MEMORY | MCP + MemoryProvider + Sync | Sem 6-8 | 🔒 Diseño congelado | Fase 3 | Upload + recall + fallback + corte |
| 5 | RECALL | Recall Strategy + Consolidación | Sem 9-10 | 🔒 Diseño congelado | Fase 4 | 6 triggers + motor consolidación |
| 6 | EDITOR | Monaco + File Explorer + Polish | Sem 11-14 | 🔒 Diseño congelado | Fase 5 | Editor integrado + Settings |
| 7 | SHIP | Testing + .exe + Beta | Sem 15-22 | 🔜 No iniciado | Fases 1-6 | Instalador Windows + docs |

```
LEYENDA DE ESTADOS:
  🔜 No iniciado     — Ni diseño ni implementación
  ⏳ Pendiente        — Diseño cerrado, esperando dependencias
  🟡 En debate        — Requiere decisión arquitectónica (DEB-XXX)
  🧪 En validación    — Implementado, en testing
  🔒 Diseño congelado — Diseño cerrado, implementación pendiente
  ✅ Implementado      — Código funcional + testeado
```

**NOTA CRÍTICA:** Todas las fases 1-6 están en "Diseño congelado" porque el PRD v3 ya define cada componente, tabla, interfaz y flujo. NO hay diseño pendiente. Lo que falta es CÓDIGO.

---

# 2. REGISTRO DE DECISIONES ARQUITECTÓNICAS (DEC-XXX)

## Protocolo de Gobernanza

```
REGLAS INMUTABLES:
  1. Una DEC congelada NO se reabre sin un RFC-XXX formal
  2. Un RFC requiere argumentos técnicos nuevos (no opiniones)
  3. El RFC debe ser evaluado por los 3 modelos
  4. Solo el usuario puede aprobar un RFC que modifique una DEC
  5. Si se aprueba, la DEC original se marca SUPERSEDED y se crea una nueva
```

## 2.1 Decisiones del Usuario (confirmadas por el humano)

| DEC | Decisión | Valor | Ronda | Doc Ref |
|-----|----------|-------|-------|---------|
| DEC-001 | Stack core del IDE | Electron + React + Monaco + xterm.js + node-pty | R1 | PRD §4 |
| DEC-002 | Modelo LLM principal | Gemini 3.1 Pro (fallback: Flash/2.5 Pro) | R1 | PRD §4 |
| DEC-003 | Servidor MCP | jacob-bd/notebooklm-mcp-cli | R1 | PRD §4 |
| DEC-004 | Layout UI | 3 paneles: Chat + Editor + Terminal | R1 | PRD §8 |
| DEC-005 | Gestión de pagos | Kairo NO gestiona billing. Usuario maneja su cuenta | R2 | PRD §3 |
| DEC-006 | Upload a NotebookLM | Automático, background, silencioso | R2 | PRD §3 |
| DEC-007 | Vinculación proyecto↔notebook | Kairo crea el notebook automáticamente | R2 | PRD §3 |
| DEC-008 | Estructura de proyectos | 1 carpeta disco = 1 cuaderno NotebookLM | R1 | PRD §3 |
| DEC-009 | Modo del agente | Dual: Automático / Supervisado con toggle | R1 | PRD §9 |
| DEC-010 | Permisos en modo automático | npm/pip install: SÍ. Crear/eliminar archivos: SÍ | R2 | PRD §9 |
| DEC-011 | Proyectos simultáneos | Uno a la vez | R2 | PRD §3 |
| DEC-012 | Formato de snapshot | Transcript completo + Resumen estructurado (2 archivos) | R1 | PRD §5.3 |
| DEC-013 | Timeline de productización | 6 meses | R1 | PRD §19 |
| DEC-014 | Formato de tool calls | JSON estricto (function calling nativo Gemini) | R2 | PRD §16 |
| DEC-015 | Scope del modo automático | Per-project (cada proyecto tiene su propio modo) | R2 | PRD §9 |
| DEC-016 | Convención de archivos | Claude propone nombres, usuario archiva | R2 | PRD §3 |
| DEC-017 | UNDO vs Confirmación en HIGH_IMPACT | Híbrido: FS→UNDO 30s / Terminal→Confirmación | PP §6 | PP §6-7 |

## 2.2 Decisiones Arquitectónicas (consenso de 3 modelos)

| DEC | Decisión | Detalle | Consenso | Doc Ref |
|-----|----------|---------|----------|---------|
| DEC-018 | Umbral de corte de sesión | 200K tokens (20%) con triple condición: tokens + 40 turnos + hito manual | 3/3 | PRD §5 |
| DEC-019 | Multi-Model Routing | Pro para foreground (chat/code), Flash para background (resúmenes/compresión) | 3/3 | PRD §7.3 |
| DEC-020 | Memoria pluggable | Interface MemoryProvider: NotebookLMProvider (primario) + LocalMarkdownProvider (fallback) | 3/3 | PRD §11 |
| DEC-021 | Token Budgeter por canales | Chat 55%, Terminal 15%, Diffs 13%, Recall 10%, System 2%, Buffer 5% | 3/3 | PRD §6 |
| DEC-022 | Motor de consolidación | Regla "40-1": al llegar a 40 fuentes, fusionar en Master Summary, eliminar antiguas | 3/3 | PRD §13 |
| DEC-023 | Modelo de datos SQLite | 7 tablas: PROJECTS, SESSIONS, MESSAGES, COMMAND_LOG, UPLOAD_QUEUE, ACCOUNTS, SETTINGS | 3/3 | PRD §15 |
| DEC-024 | Execution Broker 3 zonas | Verde (siempre OK), Amarilla (auto en automático), Roja (siempre bloqueada) | 3/3 | PRD §10 |
| DEC-025 | Workspace Sandbox | Agente solo opera dentro de project.folder_path. Fuera requiere confirmación siempre | 3/3 | PRD §10.1 |
| DEC-026 | Recall event-driven | 6 triggers: session_start, cambio_tarea, acción_crítica, cada_8_turnos, contradicción, manual | 3/3 | PRD §12 |
| DEC-027 | One-Shot Structured Planning | Plan integrado en tool-call JSON. Sin módulo separado. Sin classify intent previo | 3/3 | PP §2-4 |
| DEC-028 | Visibilidad UX | 2 niveles: Conciso (default) / Detallado (toggle). Matriz 2×2 con modos de ejecución | 3/3 | PP §3 |

**DEC-018 cierra el debate de Token Presets:** 200K es el default. Presets configurables: Conservador (120K), Balanceado (200K), Extenso (300K), Personalizado (100K-400K). NO hay debate abierto sobre esto.

**DEC-022 cierra el debate de Consolidación:** Regla "40-1" definida. Fusión con Flash (velocidad sobre calidad para tarea mecánica). NO hay debate abierto.

---

# 3. DEBATES ACTIVOS (DEB-XXX)

```
┌─────────────────────────────────────────────────────┐
│  DEBATES ACTIVOS: 0                                  │
│  Todos los debates se cerraron en Rondas 1 + 2.     │
│  Si surge un tema nuevo, se registra aquí como       │
│  DEB-001 y requiere evaluación de los 3 modelos.     │
└─────────────────────────────────────────────────────┘
```

**Protocolo para abrir un nuevo debate:**

```
1. El usuario o un modelo identifica un tema no cubierto
2. Se registra como DEB-XXX con:
   - Título
   - Descripción del conflicto
   - Impacto en el proyecto
   - Propuestas iniciales
3. Se comparte con los 3 modelos
4. Tras consenso → se convierte en DEC-XXX
5. Se elimina de la sección DEB
```

---

# 4. PETICIONES DE CAMBIO (RFC-XXX)

```
┌─────────────────────────────────────────────────────┐
│  RFCs ACTIVOS: 0                                     │
│  Un RFC se crea cuando alguien quiere MODIFICAR      │
│  una DEC congelada. Requiere justificación técnica   │
│  nueva y aprobación del usuario.                     │
└─────────────────────────────────────────────────────┘
```

**Protocolo para crear un RFC:**

```
1. Identificar la DEC que se quiere modificar
2. Documentar:
   - RFC-XXX — Título
   - DEC afectada: DEC-XXX
   - Cambio propuesto
   - Justificación técnica NUEVA (no repetir argumentos ya debatidos)
   - Impacto en el roadmap
   - Riesgo de no hacer el cambio
3. Evaluación por los 3 modelos
4. Si se aprueba:
   - DEC original → estado SUPERSEDED
   - Nueva DEC con el cambio
   - RFC marcado como APPROVED
5. Si se rechaza:
   - RFC marcado como REJECTED con razón
   - DEC original permanece intacta
```

---

# 5. DOCUMENTACIÓN DEL PROYECTO (INVENTARIO)

| # | Archivo | Contenido | Estado | Líneas |
|---|---------|-----------|--------|--------|
| 00 | `00_KAIRO_MASTER_GOVERNANCE.md` | Este documento. Governance Board. | ✅ Final | ~500 |
| 01 | `01_KAIRO_PRD_FINAL_v3.md` | PRD completo: 22 secciones, stack, arquitectura, ERD, roadmap | ✅ Final | 1,297 |
| 03 | `03_KAIRO_PLANNING_POLICY_v1.md` | Política de planificación, HIGH_IMPACT, UNDO, visibilidad UX | ✅ Final | 349 |
| 04 | `04_KAIRO_DB_SCHEMA.sql` | Schema SQL ejecutable para SQLite | 🔜 Fase 3 | — |
| 07 | `07_KAIRO_DEBATE_HISTORY.md` | Historial completo de debates R1+R2+Cierre | ✅ Final | ~300 |
| 08 | `08_KAIRO_SETUP_GUIDE.md` | Paso a paso para levantar entorno (Fase 0) | 🔜 Fase 0 | — |
| 09 | `09_KAIRO_MCP_INTEGRATION.md` | Guía de integración NotebookLM | 🔜 Fase 4 | — |
| 10 | `10_KAIRO_TESTING_PLAN.md` | Plan de testing detallado | 🔜 Fase 7 | — |

---

# 6. CHECKLIST DE EJECUCIÓN — FASE 0 (SETUP)

## 6.1 Pre-requisitos (verificar en máquina del usuario)

```
- [ ] 0.0  Repositorio Git inicializado en la raíz del proyecto (`.git` existe)
- [ ] 0.1  Windows 11 actualizado
- [ ] 0.2  Node.js 22 LTS instalado (node -v → v22.x.x)
- [ ] 0.3  npm actualizado (npm -v → 10.x.x)
- [ ] 0.4  Git instalado y configurado (git --version)
- [ ] 0.5  Visual Studio Build Tools (para native modules como better-sqlite3)
- [ ] 0.6  API Key de Gemini funcional (verificar en AI Studio)
- [ ] 0.7  Python 3.11+ instalado (para node-gyp, requerido por better-sqlite3)
```

## 6.2 Scaffold del Proyecto

```
- [ ] 0.8   Crear carpeta Kairo_Desktop/
- [ ] 0.9   Si no existe `.git`, inicializar repositorio: git init
- [ ] 0.10  Scaffold electron-vite: npm create @quick-start/electron@latest
             (seleccionar: React + TypeScript)
- [ ] 0.11  Verificar que compila: npm run dev → ventana Electron abre
- [ ] 0.12  Instalar dependencias core:
             npm install better-sqlite3 @google/generative-ai
- [ ] 0.13  Instalar dependencias UI:
             npm install monaco-editor xterm @xterm/addon-fit
- [ ] 0.14  Instalar dependencias terminal:
             npm install node-pty
             (NOTA: requiere VS Build Tools en Windows)
- [ ] 0.15  Instalar dependencias estado:
             npm install zustand
- [ ] 0.16  Instalar dependencias layout:
             npm install allotment (o split.js, decidir en implementación)
- [ ] 0.17  Instalar Tailwind CSS:
             npm install -D tailwindcss @tailwindcss/vite
```

## 6.3 Validaciones Técnicas

```
- [ ] 0.18  Test Gemini API: script que envía prompt y recibe respuesta
- [ ] 0.19  Test countTokens: verificar que el endpoint funciona con API key
- [ ] 0.20  Test node-pty: abrir PowerShell desde Node.js, ejecutar "echo hello"
- [ ] 0.21  Test better-sqlite3: crear DB, insertar fila, consultar
- [ ] 0.22  Test MCP: instalar notebooklm-mcp-cli, autenticar, verificar conexión
             (NOTA: Este es el item de mayor riesgo. Si falla, documentar error exacto)
```

## 6.4 Estructura Inicial de Carpetas

```
- [ ] 0.23  Crear estructura de carpetas según PRD v3 Sección 18
- [ ] 0.24  Crear archivos placeholder (.ts vacíos con export)
- [ ] 0.25  Verificar que todo compila sin errores
- [ ] 0.26  Primer commit: "feat: initial scaffold - Fase 0 complete"
```

**Criterio de completitud Fase 0:** Todos los items marcados ✅. Si 0.0 no está cumplido, la fase queda BLOQUEADA. Si 0.22 (MCP) falla, documentar y continuar — el fallback local cubre esa dependencia.

---

# 7. CHECKLISTS POR FASE (RESUMEN)

Detalle completo en PRD v3 Sección 19 (Gantt). Aquí solo los hitos clave:

## Fase 1: Esqueleto (Sem 1-2)
```
- [ ] 1.1  Layout 3 paneles funcional (resize con allotment/Split.js)
- [ ] 1.2  Chat envía mensaje a Gemini API y recibe respuesta
- [ ] 1.3  Context Meter muestra % de tokens usados
- [ ] 1.4  Model Selector funcional (Pro / Flash / 2.5 Pro)
```

## Fase 2: OS + Seguridad (Sem 3-4)
```
- [ ] 2.1  Terminal xterm.js conectada a node-pty (PowerShell real)
- [ ] 2.2  Execution Broker clasifica comandos en 3 zonas
- [ ] 2.3  Zona Roja bloquea en AMBOS modos
- [ ] 2.4  Mode Toggle (Auto/Supervisado) cambia comportamiento
- [ ] 2.5  Kill Switch (Ctrl+Shift+K) detiene ejecución
- [ ] 2.6  Workspace Sandbox valida paths
```

## Fase 3: Estado + Tokens (Sem 5)
```
- [ ] 3.1  SQLite schema implementado (7 tablas)
- [ ] 3.2  Crear proyecto vincula carpeta + DB
- [ ] 3.3  Token Budgeter respeta presupuestos por canal
- [ ] 3.4  Multi-cuenta: agregar/cambiar API keys
```

## Fase 4: NotebookLM + Memoria (Sem 6-8)
```
- [ ] 4.1  MCP como child_process funcional
- [ ] 4.2  MemoryProvider interface implementada
- [ ] 4.3  NotebookLMProvider sube snapshots
- [ ] 4.4  LocalMarkdownProvider como fallback
- [ ] 4.5  Upload queue con reintentos
- [ ] 4.6  Pipeline de corte (12 pasos) funcional end-to-end
```

## Fase 5: Recall + Consolidación (Sem 9-10)
```
- [ ] 5.1  Recall con 6 triggers implementados
- [ ] 5.2  Motor de consolidación (regla 40-1) funcional
- [ ] 5.3  Rate Limit Handler con backoff + fallback modelo
```

## Fase 6: Editor + Polish (Sem 11-14)
```
- [ ] 6.1  Monaco Editor integrado (abrir, editar, guardar archivos)
- [ ] 6.2  File Explorer funcional
- [ ] 6.3  Settings panel completo (presets, cuentas, visibilidad)
- [ ] 6.4  Impact Analyzer + UndoManager funcionales
```

## Fase 7: Ship (Sem 15-22)
```
- [ ] 7.1  Unit tests críticos (Broker, Classifier, Budgeter, Sandbox)
- [ ] 7.2  Integration tests (Gemini API, MCP, pipeline corte)
- [ ] 7.3  E2E tests (chat, terminal, kill switch)
- [ ] 7.4  electron-builder genera .exe installer
- [ ] 7.5  Documentación de setup + onboarding
- [ ] 7.6  Beta cerrada (2 semanas)
- [ ] 7.7  Fixes + iteración final
```

---

# 8. MÉTRICAS DE SALUD Y RIESGO

```
┌─────────────────────────────────────────────────────────────┐
│  MÉTRICAS DE SALUD — Actualizar cada 2 semanas              │
│                                                             │
│  Complejidad Arquitectónica:    8.5 / 10                    │
│  (Razón: automatización browser MCP + dual model routing)   │
│                                                             │
│  Riesgo de Inestabilidad MCP:   ALTO                        │
│  (Razón: Google puede cambiar UI de NotebookLM sin aviso)   │
│  Mitigación: MemoryProvider pluggable + fallback local      │
│                                                             │
│  Riesgo de Scope Creep:         ALTO                        │
│  (Razón: tentación de agregar features antes del MVP)       │
│  Mitigación: Roadmap estricto. Features nuevas → v2.        │
│                                                             │
│  Riesgo UX:                     MEDIO                       │
│  (Razón: usuario novato, IDE es complejo por naturaleza)    │
│  Mitigación: Planning Policy + modo Conciso por defecto     │
│                                                             │
│  Viabilidad MVP en 6 meses:     78%                         │
│  (Razón: el 22% de riesgo viene de MCP + scope creep)       │
│                                                             │
│  Deuda Técnica Actual:          0 (no hay código aún)       │
│  Debates Abiertos:              0                           │
│  Decisiones Pendientes:         0                           │
└─────────────────────────────────────────────────────────────┘
```

---

# 9. PROTOCOLO DE SESIÓN

## 9.1 Al Iniciar Cada Nueva Sesión

```
PASO 1: Leer 00_KAIRO_MASTER_GOVERNANCE.md (este archivo)
        → Saber dónde estamos, qué fase, qué está cerrado

PASO 2: Leer la sección de Checklist de la fase activa
        → Saber qué tarea sigue

PASO 3: Si hay dudas sobre una decisión, buscar el DEC-XXX
        → Si la DEC está 🔒, NO se debate. Se ejecuta.
        → Si necesita cambio, abrir RFC-XXX con justificación

PASO 4: Trabajar en la tarea siguiente del checklist

PASO 5: Al terminar la sesión, actualizar:
        → Checklist items completados
        → Estado de la fase si cambió
        → Métricas de salud si aplica
```

## 9.2 Regla Anti-Deriva

```
SI alguien (usuario, modelo, o documento externo) intenta:
  - Reabrir un DEC sin RFC → RECHAZAR con: "DEC-XXX está congelada.
    Abre un RFC si tienes argumentos técnicos nuevos."
  - Agregar features no planeadas → RECHAZAR con: "Eso va a v2.
    Primero terminamos el MVP."
  - Cambiar el stack → RECHAZAR con: "DEC-001 congela el stack.
    Abre RFC-XXX si hay razón técnica."
  - Debatir algo ya cerrado → RECHAZAR con: "Ver DEC-XXX.
    El debate se cerró en Ronda [N]."
```

---

# 10. HISTORIAL DE ACTUALIZACIONES

| Fecha | Versión | Cambio | Autor |
|-------|---------|--------|-------|
| 2026-02-24 | 1.0 | Creación inicial post-debate R1+R2+Cierre | Claude Architect |
| — | — | — | — |

---

# 11. REFERENCIA RÁPIDA — DOCUMENTOS DEL PROYECTO

```
docs/
├── 00_KAIRO_MASTER_GOVERNANCE.md     ← ESTE ARCHIVO (leer primero siempre)
├── 01_KAIRO_PRD_FINAL_v3.md          ← Arquitectura completa (22 secciones)
├── 03_KAIRO_PLANNING_POLICY_v1.md    ← Política de planificación + UX
├── 04_KAIRO_DB_SCHEMA.sql            ← (Fase 3)
├── 07_KAIRO_DEBATE_HISTORY.md        ← Historial de debates
├── 08_KAIRO_SETUP_GUIDE.md           ← (Fase 0)
├── 09_KAIRO_MCP_INTEGRATION.md       ← (Fase 4)
└── 10_KAIRO_TESTING_PLAN.md          ← (Fase 7)
```

---

*Documento generado por Claude Architect.*
*Corrige 7 errores identificados en las propuestas de Nexus y Gemini.*
*28 decisiones congeladas. 0 debates abiertos. Listo para Fase 0.*
