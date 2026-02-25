import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  TerminalSpawnRequest,
  TerminalInputRequest,
  TerminalResizeRequest,
} from '../../shared/types'
import type { TerminalService } from '../services/terminal.service'
import { validateSender } from './validate-sender'

function isValidSpawnRequest(data: unknown): data is TerminalSpawnRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.cwd === 'string' && obj.cwd.length > 0
}

function isValidInputRequest(data: unknown): data is TerminalInputRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.terminalId === 'string' && typeof obj.data === 'string'
}

function isValidResizeRequest(data: unknown): data is TerminalResizeRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.terminalId === 'string' &&
    typeof obj.cols === 'number' &&
    typeof obj.rows === 'number' &&
    obj.cols > 0 &&
    obj.rows > 0
  )
}

export function registerTerminalHandlers(
  terminalService: TerminalService,
  getMainWindow: () => BrowserWindow | null
): void {
  // Wire pty output → renderer push
  terminalService.setOnData((terminalId, data) => {
    const win = getMainWindow()
    win?.webContents.send(IPC_CHANNELS.TERMINAL_DATA, { terminalId, data })
  })

  terminalService.setOnExit((terminalId, exitCode) => {
    const win = getMainWindow()
    win?.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, { terminalId, exitCode })
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_SPAWN, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidSpawnRequest(data)) {
      return { success: false, error: 'Invalid spawn request: cwd must be a non-empty string.' }
    }
    return terminalService.spawn(data)
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_INPUT, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidInputRequest(data)) {
      return { success: false, error: 'Invalid input request.' }
    }
    return terminalService.write(data.terminalId, data.data)
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidResizeRequest(data)) {
      return { success: false, error: 'Invalid resize request.' }
    }
    return terminalService.resize(data.terminalId, data.cols, data.rows)
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_KILL, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'Invalid kill request.' }
    }
    const obj = data as Record<string, unknown>
    if (typeof obj.terminalId !== 'string') {
      return { success: false, error: 'Invalid kill request: terminalId required.' }
    }
    return terminalService.kill(obj.terminalId)
  })
}
