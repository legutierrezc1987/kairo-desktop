import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { Orchestrator } from './core/orchestrator'
import { registerChatHandlers } from './ipc/chat.handlers'
import { registerTerminalHandlers } from './ipc/terminal.handlers'
import { registerBrokerHandlers } from './ipc/broker.handlers'
import { validateSender } from './ipc/validate-sender'
import { initGeminiGateway } from './services/gemini-gateway'
import { ExecutionBroker } from './execution/execution-broker'
import { TerminalService } from './services/terminal.service'
import { IPC_CHANNELS } from '../shared/ipc-channels'

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

  // Initialize Gemini gateway (API key from env — settings UI in later phase)
  const apiKey = process.env['GEMINI_API_KEY'] ?? ''
  if (apiKey) {
    initGeminiGateway(apiKey)
  } else {
    console.warn('[KAIRO] GEMINI_API_KEY not set. Chat will return initialization errors.')
  }

  // Initialize orchestrator and register chat IPC handlers
  const orchestrator = new Orchestrator()
  registerChatHandlers(orchestrator)

  // Initialize execution broker + terminal service
  // SECURITY: workspacePath anchors sandbox validation for all terminal spawns (DEC-025)
  const workspacePath = process.cwd()
  const broker = new ExecutionBroker()
  const terminalService = new TerminalService(broker, workspacePath)

  // Create window and register terminal handlers (needs window reference)
  mainWindow = createWindow()
  registerTerminalHandlers(terminalService, () => mainWindow)
  registerBrokerHandlers(broker, () => mainWindow)

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
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
