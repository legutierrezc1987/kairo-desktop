import { app, shell, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { Orchestrator } from './core/orchestrator'
import { registerChatHandlers } from './ipc/chat.handlers'
import { registerTerminalHandlers } from './ipc/terminal.handlers'
import { registerBrokerHandlers } from './ipc/broker.handlers'
import { registerProjectHandlers } from './ipc/project.handlers'
import { registerSettingsHandlers } from './ipc/settings.handlers'
import { validateSender } from './ipc/validate-sender'
import { DatabaseService } from './services/database.service'
import { initGeminiGateway, resetGeminiGateway } from './services/gemini-gateway'
import { ProjectService } from './services/project.service'
import { SessionPersistenceService } from './services/session-persistence.service'
import { AccountService } from './services/account.service'
import { SettingsService } from './services/settings.service'
import { ExecutionBroker } from './execution/execution-broker'
import { TerminalService } from './services/terminal.service'
import { MemoryService } from './memory/memory.service'
import { registerMemoryHandlers } from './ipc/memory.handlers'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { KILL_SWITCH_ACCELERATOR, DEFAULT_BUDGET, BUDGET_PRESETS, MEMORY_SETTINGS_KEY_MCP_PATH } from '../shared/constants'
import type { BrokerMode } from '../shared/types'

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

app.whenReady().then(() => {
  app.setAppUserModelId('com.orionocg.kairo-desktop')

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

  // ── Initialize orchestrator with persistence + resolved budget ──
  const orchestrator = new Orchestrator({
    sessionPersistence,
    totalBudget,
  })
  registerChatHandlers(orchestrator)

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

  // ── Create window and register handlers ─────────────────────
  mainWindow = createWindow()
  registerTerminalHandlers(terminalService, () => mainWindow)
  registerBrokerHandlers(broker, () => mainWindow, settingsService)
  registerProjectHandlers(projectService, (projectId, folderPath) => {
    orchestrator.setActiveProject(projectId)
    // SECURITY: Bind memory workspace to active project (Phase 4 Hardening)
    memoryService.updateWorkspace(folderPath).catch((err) => {
      console.error(`[KAIRO] Memory workspace update failed: ${err instanceof Error ? err.message : String(err)}`)
    })
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
  })
  registerMemoryHandlers(memoryService, () => mainWindow)

  // ── Kill switch — Ctrl+Shift+K emergency stop (DEC-025) ────
  const registered = globalShortcut.register(KILL_SWITCH_ACCELERATOR, () => {
    console.log('[KAIRO_KILLSWITCH] Emergency stop activated!')
    const killedCount = terminalService.killAll()
    broker.emergencyReset()
    orchestrator.requestArchive('emergency')
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

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })

  // Cleanup before quit
  app.on('before-quit', () => {
    broker.destroy()
    terminalService.killAll()
    memoryService.shutdown().catch(() => {})
    dbService.close()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
