import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { Orchestrator } from './core/orchestrator'
import { registerChatHandlers } from './ipc/chat.handlers'
import { initGeminiGateway } from './services/gemini-gateway'

const icon = join(__dirname, '../../resources/icon.png')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
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

  // Initialize orchestrator and register IPC handlers
  const orchestrator = new Orchestrator()
  registerChatHandlers(orchestrator)

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
