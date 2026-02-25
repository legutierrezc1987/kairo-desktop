import { ipcMain, type IpcMainInvokeEvent, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { SendMessageRequest } from '../../shared/types'
import type { Orchestrator } from '../core/orchestrator'

/**
 * Validates that an IPC event originates from a trusted frame.
 * SECURITY: Rejects requests from devtools, external URLs, or non-main frames.
 */
function validateSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame
  if (!frame) {
    throw new Error('[KAIRO_SECURITY] IPC rejected: no sender frame.')
  }

  // Reject if the frame's URL scheme is not the expected one.
  // In dev: electron renderer URL (http://localhost:*). In prod: file:// or app://.
  const url = frame.url
  const isDevServer = url.startsWith('http://localhost')
  const isFileProtocol = url.startsWith('file://')
  const isAppProtocol = url.startsWith('app://')

  if (!isDevServer && !isFileProtocol && !isAppProtocol) {
    throw new Error(
      `[KAIRO_SECURITY] IPC rejected: untrusted origin "${url}".`
    )
  }

  // Reject if the sender is a WebContents that doesn't belong to any known window.
  // This catches devtools frames and rogue webviews.
  const { BrowserWindow: BW } = require('electron') as { BrowserWindow: typeof BrowserWindow }
  const senderWindow = BW.fromWebContents(event.sender)
  if (!senderWindow) {
    throw new Error(
      '[KAIRO_SECURITY] IPC rejected: sender is not a known BrowserWindow.'
    )
  }
}

/**
 * Handler-side data shape validation (defense in depth).
 * Preload validates the channel; handler validates the data shape.
 */
function isValidSendMessageRequest(data: unknown): data is SendMessageRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.content === 'string' && obj.content.length > 0
}

export function registerChatHandlers(orchestrator: Orchestrator): void {
  ipcMain.handle(IPC_CHANNELS.CHAT_SEND_MESSAGE, async (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }

    if (!isValidSendMessageRequest(data)) {
      return { success: false, error: 'Invalid request: content must be a non-empty string.' }
    }
    return orchestrator.handleChatMessage(data)
  })

  ipcMain.handle(IPC_CHANNELS.TOKEN_GET_BUDGET, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    return orchestrator.getTokenBudgetState()
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_GET_STATE, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    return orchestrator.getSessionState()
  })
}
