import { app, shell, BrowserWindow, ipcMain, globalShortcut, dialog } from 'electron'
import { join } from 'path'
import { Orchestrator } from './core/orchestrator'
import { registerChatHandlers } from './ipc/chat.handlers'
import { registerTerminalHandlers } from './ipc/terminal.handlers'
import { registerBrokerHandlers } from './ipc/broker.handlers'
import { registerProjectHandlers } from './ipc/project.handlers'
import { registerSettingsHandlers } from './ipc/settings.handlers'
import { validateSender } from './ipc/validate-sender'
import { initGeminiGateway, resetGeminiGateway, generateContent, isInitialized as isGeminiInitialized } from './services/gemini-gateway'
import { ProjectService } from './services/project.service'
import { SessionPersistenceService } from './services/session-persistence.service'
import { AccountService } from './services/account.service'
import { SettingsService } from './services/settings.service'
import { ExecutionBroker } from './execution/execution-broker'
import { TerminalService } from './services/terminal.service'
import { MemoryService } from './memory/memory.service'
import { registerMemoryHandlers } from './ipc/memory.handlers'
import { FileOperationsService } from './services/file-operations.service'
import { registerEditorHandlers } from './ipc/editor.handlers'
import { UploadQueueService } from './services/upload-queue.service'
import { SyncWorker } from './workers/sync-worker'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { KILL_SWITCH_ACCELERATOR, DEFAULT_BUDGET, BUDGET_PRESETS, MEMORY_SETTINGS_KEY_MCP_PATH, CUT_PIPELINE_TIMEOUT_MS } from '../shared/constants'
import type { BrokerMode, CutReason, CutPipelineEvent, RecallStatusEvent, ConsolidationStatusEvent, RateLimitStatus } from '../shared/types'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { MASTER_SUMMARY_PROMPT, type ConsolidationPort } from './memory/consolidation-engine'

// ── Startup guard: bail early if Electron is not running as a proper app ──
if (process.env['ELECTRON_RUN_AS_NODE']) {
  console.error(
    '[KAIRO] ELECTRON_RUN_AS_NODE is set — Electron app module is unavailable.\n' +
    'Unset this variable before launching Kairo Desktop.'
  )
  process.exit(1)
}

if (typeof app === 'undefined' || app === null) {
  console.error('[KAIRO] Electron app module failed to load. Aborting.')
  process.exit(1)
}

const icon = join(__dirname, '../../resources/icon.png')

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.orionocg.kairo-desktop')

  try {
    // Load native DB service lazily so startup failures are handled deterministically.
    const { DatabaseService } = await import('./services/database.service')

    // ── Initialize SQLite database (DEC-023) ────────────────────
    const dbService = new DatabaseService(app.getPath('userData'))
  const projectService = new ProjectService(dbService.getDb())
  const sessionPersistence = new SessionPersistenceService(dbService.getDb())
  const accountService = new AccountService(dbService.getDb())
  const settingsService = new SettingsService(dbService.getDb())

  // ── Account→Gateway bridge: resolve API key from DB or env ──
  const dbApiKey = accountService.getActiveApiKey()
  const apiKey = dbApiKey ?? process.env['GEMINI_API_KEY'] ?? ''
  if (apiKey) {
    initGeminiGateway(apiKey)
    console.log(`[KAIRO] Gemini gateway initialized (source: ${dbApiKey ? 'account' : 'env'})`)
  } else {
    console.warn('[KAIRO] No API key available. Chat disabled until account is configured.')
  }

  // ── Settings bridge: read persisted budget/mode on startup ──
  const budgetSetting = settingsService.getSetting('budget_preset')
  const customBudgetSetting = settingsService.getSetting('custom_budget')

  let totalBudget = DEFAULT_BUDGET
  if (budgetSetting.success && budgetSetting.data?.value) {
    const preset = budgetSetting.data.value
    if (preset in BUDGET_PRESETS) {
      totalBudget = BUDGET_PRESETS[preset as keyof typeof BUDGET_PRESETS]
    } else if (preset === 'custom' && customBudgetSetting.success && customBudgetSetting.data?.value) {
      const parsed = parseInt(customBudgetSetting.data.value, 10)
      if (!isNaN(parsed) && parsed > 0) totalBudget = parsed
    }
  }

  // ── Initialize upload queue + sync worker ──────────────────
  const uploadQueue = new UploadQueueService(dbService.getDb())

  // ── Initialize orchestrator with persistence + resolved budget ──
  const orchestrator = new Orchestrator({
    sessionPersistence,
    totalBudget,
  })
  registerChatHandlers(orchestrator, () => mainWindow)

  // ── Initialize execution broker + terminal service ──────────
  // SECURITY: workspacePath anchors sandbox validation for all terminal spawns (DEC-025)
  const workspacePath = process.cwd()
  const broker = new ExecutionBroker()
  const terminalService = new TerminalService(broker, workspacePath)

  // Apply persisted broker mode (safe defaults if missing)
  const brokerModeSetting = settingsService.getSetting('broker_mode')
  if (brokerModeSetting.success && brokerModeSetting.data?.value) {
    const mode = brokerModeSetting.data.value
    if (mode === 'auto' || mode === 'supervised') {
      broker.setMode(mode as BrokerMode)
    }
  }

  // ── Initialize Memory Service (DEC-020) ────────────────────
  const mcpPathSetting = settingsService.getSetting(MEMORY_SETTINGS_KEY_MCP_PATH)
  const mcpServerPath = (mcpPathSetting.success && mcpPathSetting.data?.value)
    ? mcpPathSetting.data.value
    : undefined

  const memoryService = new MemoryService({
    mcpServerPath,
    workspacePath,
  })

  memoryService.initialize().catch((err) => {
    console.error(`[KAIRO] Memory service init failed: ${err instanceof Error ? err.message : String(err)}`)
  })

  // ── Initialize FileOperationsService (Phase 6 Sprint A, PRD §6.1) ──
  const fileOps = new FileOperationsService()

  // ── Wire orchestrator ports (Sprint D) ────────────────────
  orchestrator.setMemoryPort(memoryService)
  orchestrator.setUploadQueuePort(uploadQueue)

  // ── Initialize SyncWorker (background upload) ─────────────
  const syncWorker = new SyncWorker(uploadQueue, {
    async index(filePath: string) {
      const result = await memoryService.index(filePath)
      if (result.success && result.data) {
        return { indexed: result.data.result.indexed, error: result.data.result.error }
      }
      return { indexed: false, error: result.error ?? 'Memory index failed' }
    },
  })
  syncWorker.start()

  // ── Wire Consolidation Port into SyncWorker (Phase 5 Sprint B, DEC-022) ──
  const consolidationPort: ConsolidationPort = {
    getSyncedCount: () => uploadQueue.countSynced(),
    getOldestSynced: (limit: number) => uploadQueue.getSyncedSources(limit),
    readSourceFile: (filePath: string) => readFile(filePath, 'utf-8'),
    generateMasterSummary: async (mergedContent: string, sourceCount: number) => {
      if (!isGeminiInitialized()) {
        return `# Master Summary (no LLM available)\n\nConsolidated from ${sourceCount} sources.\n\n${mergedContent.slice(0, 20_000)}`
      }
      const prompt = `${MASTER_SUMMARY_PROMPT}\n\nNumber of sessions: ${sourceCount}\n\n---\n\n${mergedContent}`
      const result = await generateContent(prompt, 'gemini-2.0-flash')
      return result.text
    },
    saveMasterSummary: async (projectFolder: string, content: string) => {
      const dir = join(projectFolder, '.kairo', 'sessions')
      await mkdir(dir, { recursive: true })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filePath = join(dir, `master_summary_${timestamp}.md`)
      await writeFile(filePath, content, 'utf-8')
      return filePath
    },
    enqueueMasterSummary: (sessionId: string, filePath: string) => {
      const entry = uploadQueue.enqueue(sessionId, filePath, 'master_summary')
      return entry.id
    },
    markConsolidated: (ids: string[], masterEntryId: string) => {
      uploadQueue.markConsolidated(ids, masterEntryId)
    },
    deleteRemoteSource: async (sourceId: string) => {
      const provider = memoryService.getActiveProvider()
      if (provider?.deleteSource) {
        return provider.deleteSource(sourceId)
      }
      return { deleted: false, sourceId, error: 'Active provider does not support deleteSource' }
    },
  }
  syncWorker.setConsolidationPort(consolidationPort)

  // ── Create window and register handlers ─────────────────────
  mainWindow = createWindow()
  registerTerminalHandlers(terminalService, () => mainWindow)
  registerBrokerHandlers(broker, () => mainWindow, settingsService)
  registerProjectHandlers(projectService, (projectId, folderPath, projectName) => {
    orchestrator.setActiveProject(projectId, folderPath, projectName)
    // SECURITY: Bind memory workspace to active project (Phase 4 Hardening)
    memoryService.updateWorkspace(folderPath).catch((err) => {
      console.error(`[KAIRO] Memory workspace update failed: ${err instanceof Error ? err.message : String(err)}`)
    })
    // Phase 6 Sprint A: Bind file operations workspace
    fileOps.setWorkspacePath(folderPath)
    // Phase 5 Sprint B: update SyncWorker project context for consolidation
    syncWorker.setProjectContext(folderPath, projectId)
  })
  registerSettingsHandlers(settingsService, sessionPersistence, accountService, () => {
    const newKey = accountService.getActiveApiKey()
    const resolvedKey = newKey ?? process.env['GEMINI_API_KEY'] ?? ''
    if (resolvedKey) {
      initGeminiGateway(resolvedKey)
      console.log(`[KAIRO] Gemini gateway re-initialized (source: ${newKey ? 'account' : 'env'})`)
    } else {
      resetGeminiGateway()
      console.warn('[KAIRO] No API key available after account change. Gateway reset.')
    }
  }, (key, value) => {
    // Phase 6 Sprint C: propagate visibility_mode changes to orchestrator in real-time
    if (key === 'visibility_mode' && (value === 'concise' || value === 'detailed')) {
      orchestrator.setVisibilityMode(value)
    }
  })
  registerMemoryHandlers(memoryService, () => mainWindow)
  registerEditorHandlers(fileOps)

  // ── Register cut pipeline state push (Sprint D) ───────────
  orchestrator.setCutStateSender((event: CutPipelineEvent) => {
    mainWindow?.webContents.send(IPC_CHANNELS.CUT_PIPELINE_STATE, event)
  })

  // ── Register recall status push (Phase 5 Sprint A, DEC-026) ───
  orchestrator.setRecallStatusSender((event: RecallStatusEvent) => {
    mainWindow?.webContents.send(IPC_CHANNELS.RECALL_STATUS, event)
  })

  // ── Register consolidation status push (Phase 5 Sprint B, DEC-022) ───
  syncWorker.setConsolidationEmitter((phase) => {
    const event: ConsolidationStatusEvent = { phase }
    mainWindow?.webContents.send(IPC_CHANNELS.CONSOLIDATION_STATUS, event)
  })

  // ── Register rate-limit status push (Phase 5 Sprint C, PRD §14) ───
  orchestrator.setRateLimitEmitter((status: RateLimitStatus) => {
    mainWindow?.webContents.send(IPC_CHANNELS.RATE_LIMIT_STATUS, status)
  })

  // ── Hydrate visibility mode from settings (Phase 6 Sprint C) ───
  const visSetting = settingsService.getSetting('visibility_mode')
  if (visSetting.success && visSetting.data?.value) {
    const mode = visSetting.data.value
    if (mode === 'concise' || mode === 'detailed') {
      orchestrator.setVisibilityMode(mode)
    }
  }

  // ── Kill switch — Ctrl+Shift+K emergency stop (DEC-025) ────
  // Codex guard #4: fire-and-forget with timeout — never blocks indefinitely
  const registered = globalShortcut.register(KILL_SWITCH_ACCELERATOR, () => {
    console.log('[KAIRO_KILLSWITCH] Emergency stop activated!')
    const killedCount = terminalService.killAll()
    broker.emergencyReset()
    // Fire-and-forget: async pipeline with timeout guard
    Promise.race([
      orchestrator.requestArchive('emergency'),
      new Promise<void>(resolve => setTimeout(resolve, CUT_PIPELINE_TIMEOUT_MS)),
    ]).catch(() => {})
    memoryService.shutdown().catch(() => {})
    mainWindow?.webContents.send(IPC_CHANNELS.KILLSWITCH_ACTIVATED, {
      timestamp: Date.now(),
      killedCount,
    })
    console.log(`[KAIRO_KILLSWITCH] Killed ${killedCount} terminals, pending queue cleared.`)
  })
  if (!registered) {
    console.warn(`[KAIRO_KILLSWITCH] Failed to register ${KILL_SWITCH_ACCELERATOR} — shortcut may be in use.`)
  }

  // App CWD handler (renderer needs this for terminal spawn)
  ipcMain.handle(IPC_CHANNELS.APP_GET_CWD, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    return { success: true, data: process.cwd() }
  })

  // Execution classify handler (on-demand classification for UI)
  ipcMain.handle(IPC_CHANNELS.EXECUTION_CLASSIFY, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'Invalid classify request.' }
    }
    const obj = data as Record<string, unknown>
    if (typeof obj.command !== 'string') {
      return { success: false, error: 'Invalid classify request: command required.' }
    }
    const { classifyCommand } = require('./execution/command-classifier') as {
      classifyCommand: (cmd: string) => unknown
    }
    return { success: true, data: classifyCommand(obj.command) }
  })

  // Session archive handler — triggers 12-step cut pipeline (Sprint D)
  ipcMain.handle(IPC_CHANNELS.SESSION_ARCHIVE, async (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    const VALID_REASONS: CutReason[] = ['tokens', 'turns', 'manual', 'emergency']
    let reason: CutReason = 'manual'
    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>
      if (typeof obj.reason === 'string' && VALID_REASONS.includes(obj.reason as CutReason)) {
        reason = obj.reason as CutReason
      }
    }
    // Codex guard #4: await with timeout — never blocks renderer indefinitely
    try {
      await Promise.race([
        orchestrator.requestArchive(reason),
        new Promise<void>(resolve => setTimeout(resolve, CUT_PIPELINE_TIMEOUT_MS)),
      ])
    } catch {
      // Pipeline errors are logged internally; don't fail the IPC response
    }
    return { success: true, data: { archived: true } }
  })

  // Folder picker handler — native OS dialog (Phase 4 Sprint B)
  ipcMain.handle(IPC_CHANNELS.APP_SELECT_FOLDER, async (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!mainWindow) {
      return { success: false, error: 'No window available' }
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: { folderPath: null } }
    }
    return { success: true, data: { folderPath: result.filePaths[0] } }
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })

  // Cleanup before quit
  app.on('before-quit', () => {
    syncWorker.stop()
    orchestrator.shutdown()
    broker.destroy()
    terminalService.killAll()
    memoryService.shutdown().catch(() => {})
    dbService.close()
  })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isNativeAbiError = message.includes('better_sqlite3.node') && message.includes('NODE_MODULE_VERSION')
    const hint = isNativeAbiError
      ? 'Run: npx electron-builder install-app-deps'
      : 'Check terminal logs for details.'
    const details = `Kairo failed during startup.\n\n${message}\n\n${hint}`
    console.error(`[KAIRO] Startup failure: ${details}`)
    dialog.showErrorBox('Kairo startup error', details)
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
