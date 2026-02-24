# KAIRO_03_PLANNING_POLICY_v1.md
## Política de Planificación, Ejecución y UX del Agente
## Consenso: Claude Architect + Gemini Architect + Nexus (ChatGPT)
### Fecha: 24 de Febrero 2026 | Estado: ✅ CERRADO

---

# 1. OBJETIVO UX

Diseñar una ejecución fluida y confiable para usuario no técnico:

- Evitar "agente poseído" (acciones silenciosas sin intención visible)
- Evitar "agente lento" (planes enormes antes de actuar)
- Mantener latencia mínima (no multi-llamadas previas al LLM)
- Narrativa natural: **intención → acción → resultado → siguiente**

---

# 2. REGLA BASE: PLANNER INTERNO SIEMPRE ACTIVO (SIN OVERHEAD)

El agente siempre produce un plan interno, pero:

- **NO** como módulo separado
- **NO** con una llamada extra "classify intent"
- Se integra en **One-Shot Structured Planning**: el plan viaja dentro del tool-call JSON
- El model razona y planea MIENTRAS genera su respuesta (cero latencia extra)
- Instrucción vía system prompt: "Cuando recibas una tarea compleja, primero describe tu plan de acción en 1-5 pasos. Luego ejecuta paso por paso."

**Origen del consenso:**
- Claude rechazó "classify intent" separado (agrega 1-3s de latencia por turno)
- Gemini validó que la latencia es el enemigo #1 en un IDE
- Nexus aceptó integrar clasificación en el planning nativo del modelo

---

# 3. VISIBILIDAD UX: 2 NIVELES (NO 3)

Se adopta reducción de 3→2 modos para MVP (menos combinaciones, menos bugs).

## Nivel A — Conciso (DEFAULT)

El usuario ve: intención corta + progreso + resultado.
No se muestra razonamiento interno.

```
Ejemplo en Chat:
  🤖 "Instalando dependencias..."
  🤖 "✅ Instaladas. Creando servidor..."
  🤖 "✅ server.js creado. Probando..."
  🤖 "✅ Servidor corriendo en puerto 3000."
```

## Nivel B — Detallado (toggle en Settings)

Muestra: plan en pasos + comando/acción + resultado por paso.
Puede mostrar JSON de tool-calls y logs resumidos.

```
Ejemplo en Chat:
  🤖 "Plan (4 pasos):
      1. npm init -y
      2. npm install express
      3. Crear src/server.ts
      4. Probar con node src/server.ts

      Ejecutando paso 1..."
  🤖 "Paso 1: [run_command: npm init -y] → exit 0 ✅"
  🤖 "Paso 2: [run_command: npm install express] → exit 0 ✅"
  ...
```

## Matriz de combinaciones resultante: 4 (no 6)

```
                  Conciso      Detallado
Supervisado       Combo 1      Combo 2
Automático        Combo 3      Combo 4
```

**Origen:**
- Claude propuso 2 niveles (Conciso/Detallado) en lugar de 3
- Nexus aceptó que Simple y Guiado son casi lo mismo
- Gemini no objetó

---

# 4. ONE-SHOT STRUCTURED PLANNING (JSON Estricto)

Las herramientas incluyen campos de UX y de impacto en el JSON.
El backend decide qué renderizar según el nivel de visibilidad activo.

## 4.1 Campos UX en el Tool Call

Cada tool call incluye:

```json
{
  "tool": "run_command",
  "user_facing_message": "Instalando dependencias...",
  "command": "npm install express",
  "impact": {
    "is_high_impact": false,
    "reason": ""
  }
}
```

- `user_facing_message`: Lo que ve el usuario en modo Conciso (1 línea)
- `impact.is_high_impact`: Evaluación del modelo (PERO el Broker verifica independientemente)
- `impact.reason`: Explicación (solo visible en modo Detallado)

## 4.2 Campo opcional: `internal_thought`

```json
{
  "internal_thought": "Necesito instalar express antes de crear el servidor porque..."
}
```

- NO renderizado por defecto
- Visible solo en modo Detallado si el usuario lo activa
- NO es requisito para la UX — es para debugging

---

# 5. HIGH_IMPACT: REGLA CUANTITATIVA (BROKER, NO LLM)

El Execution Broker calcula HIGH_IMPACT **independientemente** del modelo.
Es determinista y "a prueba de alucinaciones".

## 5.1 Condiciones de HIGH_IMPACT

Se marca HIGH_IMPACT si el plan (en un solo turno) incluye:

```
CUALQUIERA de estas condiciones activa HIGH_IMPACT:

  ✅ write_file + apply_patch en >5 archivos
  ✅ Eliminar cualquier archivo (delete_count >= 1)
  ✅ Crear >10 archivos nuevos
  ✅ Toca archivos de configuración raíz:
     package.json, tsconfig.json, .env, vite.config.*,
     electron.vite.config.*, tailwind.config.*, eslintrc.*
  ✅ Moves/renames masivos (>3 archivos)
  ✅ Comandos con: "migrate", "deploy", "publish"
```

## 5.2 Implementación

```typescript
// src/main/execution/impact-analyzer.ts

function analyzeImpact(toolCalls: ToolCall[]): ImpactResult {
  const writeCount = toolCalls.filter(t => 
    t.tool === 'write_file' || t.tool === 'apply_patch'
  ).length;
  
  const deleteCount = toolCalls.filter(t => 
    t.tool === 'run_command' && /\b(rm|del|rmdir)\b/.test(t.args.command)
  ).length;
  
  const configFiles = ['package.json', 'tsconfig.json', '.env', 
    'vite.config', 'electron.vite', 'tailwind.config', 'eslintrc'];
  const touchesConfig = toolCalls.some(t => 
    configFiles.some(cf => t.args?.path?.includes(cf))
  );
  
  const dangerousCommands = /\b(migrate|deploy|publish)\b/;
  const hasDangerousCmd = toolCalls.some(t => 
    t.tool === 'run_command' && dangerousCommands.test(t.args.command)
  );

  return {
    isHighImpact: writeCount > 5 || deleteCount >= 1 || 
                  touchesConfig || hasDangerousCmd,
    writeCount,
    deleteCount,
    touchesConfig,
    hasDangerousCmd
  };
}
```

---

# 6. RESOLUCIÓN: UNDO vs CONFIRMACIÓN (MODELO HÍBRIDO)

## Diferencia clave: reversibilidad

| Tipo de acción | ¿Es reversible? | Política |
|---------------|-----------------|----------|
| File System (write/patch/delete/move) | ✅ Sí (snapshot local) | UNDO 30s |
| Terminal/PTY (npm/pip/migrate/scripts) | ❌ No (muta estado externo) | Confirmación explícita |

## 6.1 HIGH_IMPACT de File System → UNDO 30s (modo Automático)

```
1. Broker detecta HIGH_IMPACT en plan de archivos
2. ANTES de ejecutar: snapshot archivos afectados
   → .kairo/undo/{timestamp}/
3. Ejecutar el plan completo
4. UI muestra notificación persistente:
   "⚠️ Modificados 8 archivos. [Ver cambios] [Deshacer 🔄 28s]"
5. Si usuario clickea Undo → restaurar desde snapshot
6. Si no → eliminar snapshot tras 5 minutos
```

**¿Por qué no countdown de 5 segundos?**
- Anti-pattern de UX (si el usuario no está mirando, se ejecuta)
- UNDO es superior: ejecutar rápido + dar opción de revertir
- Patrón validado por Gmail, Slack, Notion

## 6.2 HIGH_IMPACT de Terminal → Confirmación Explícita (modo Automático)

```
1. Broker detecta HIGH_IMPACT en comando de terminal
   (migrate, deploy, publish, o Broker lo marca)
2. UI muestra modal de confirmación:
   "⚠️ Este comando puede tener efectos irreversibles:
    npm run migrate
    ¿Ejecutar?"
   [Ejecutar] [Cancelar]
3. NO hay countdown. El usuario decide sin presión.
4. Si aprueba → ejecutar + log
5. Si cancela → informar al agente
```

**¿Por qué no UNDO para terminal?**
- Un `npm install` muta `node_modules/` y `package-lock.json`
- Un `pip install` muta el entorno global o venv
- Un script de migración muta la base de datos
- NO existe un "Ctrl+Z" confiable para estas acciones
- Prometer UNDO sería mentirle al usuario

## 6.3 En Modo Supervisado

Todo sigue igual: cualquier tool call pide aprobación.
HIGH_IMPACT simplemente agrega un **warning visual** más prominente:

```
Modo Supervisado + HIGH_IMPACT:
  "⚠️ ALTO IMPACTO: Este plan modifica 8 archivos y borra 2.
   [Ver plan detallado]
   [Aprobar] [Rechazar]"
```

---

# 7. EJECUCIÓN MULTI-PASO: SECUENCIAL CON FLASH

Cuando el plan tiene varios pasos:

```
REGLA: Paso N depende del resultado de Paso N-1.
No se avanza al Paso 2 hasta resolver Paso 1.

Si el output del Paso N es largo (>50 líneas):
  1. Truncar a últimas 50 líneas + exit code
  2. Opcional: Gemini Flash resume en background
  3. El Orchestrator espera el resumen SI afecta la decisión del siguiente paso
  4. Si NO afecta (ej: output informativo) → continuar sin esperar

Kill Switch (Ctrl+Shift+K): Interrumpe la ejecución en CUALQUIER paso.
```

---

# 8. RENDERIZADO EN UI (QUÉ VE EL USUARIO)

```
CONCISO (default):
  Chat muestra → user_facing_message de cada tool call
  Progreso → indicador de paso actual (ej: "Paso 2/4...")
  Resultado → ✅ Éxito / ❌ Error (con mensaje corto)

DETALLADO (toggle):
  Chat muestra → plan completo con bullets numerados
  Cada paso → comando exacto + output resumido
  Resultado → exit code + output relevante
  Opcional → JSON de tool calls visible
```

---

# 9. CAMBIOS AL SYSTEM PROMPT (Adición al Bloque BASE)

```markdown
## PLANIFICACIÓN
- Cuando recibas una tarea que requiera múltiples acciones, primero
  describe tu plan en 1-5 pasos breves. Luego ejecuta paso por paso.
- Cada tool call debe incluir un `user_facing_message` claro y conciso
  que explique al usuario qué estás haciendo.
- Evalúa el impacto de tu plan: si afectas >5 archivos, borras archivos,
  o tocas archivos de configuración raíz, indica `is_high_impact: true`.
- SIEMPRE espera el resultado de un paso antes de ejecutar el siguiente.
- Si un paso falla, analiza el error y decide: reintentar, modificar
  el plan, o pedir ayuda al usuario.
```

---

# 10. CHECKLIST DE IMPLEMENTACIÓN

```
□ Actualizar Tool Schema JSON (agregar user_facing_message + impact)
□ ImpactAnalyzer en Broker (src/main/execution/impact-analyzer.ts)
□ UndoManager FS (src/main/execution/undo-manager.ts)
  - snapshot antes de HIGH_IMPACT FS
  - restore si Undo clickeado
  - TTL de 5 min para limpieza
□ Terminal HIGH_IMPACT gate: confirmación explícita
□ PlanRunner secuencial (paso a paso, espera resultados)
□ UI: Toggle Conciso/Detallado en Settings
□ UI: Banner/Toast "Undo 30s" + botón "Ver cambios"
□ UI: Modal de confirmación para HIGH_IMPACT terminal
□ Agregar instrucciones de planificación al System Prompt
□ Unit Tests: ImpactAnalyzer (>5 archivos, deletes, config)
□ Unit Tests: UndoManager (snapshot + restore + TTL)
```

---

# 11. ARCHIVOS NUEVOS EN LA ESTRUCTURA

```
src/main/execution/
  ├── impact-analyzer.ts      # Calcula HIGH_IMPACT cuantitativamente
  └── undo-manager.ts         # Snapshot + restore + TTL para FS

src/renderer/components/
  ├── Chat/
  │   └── PlanProgress.tsx    # Indicador de paso actual (1/4, 2/4...)
  ├── Notifications/
  │   ├── UndoToast.tsx       # Banner "Deshacer 30s" para HIGH_IMPACT FS
  │   └── HighImpactModal.tsx # Modal confirmación HIGH_IMPACT terminal
  └── Settings/
      └── VisibilityToggle.tsx # Switch Conciso / Detallado

Datos locales por proyecto:
  /proyectos/{nombre}/.kairo/
    └── undo/
        └── {timestamp}/      # Snapshots temporales (TTL 5 min)
```

---

*Documento consolidado por Nexus (ChatGPT), validado por Claude y Gemini.*
*Consenso total de los 3 modelos. Sin discrepancias abiertas.*
