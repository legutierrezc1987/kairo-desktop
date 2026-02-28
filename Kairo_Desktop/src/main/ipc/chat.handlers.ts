import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { SendMessageRequest, ChatAbortResponse } from '../../shared/types'
import type { Orchestrator } from '../core/orchestrator'
import { validateSender } from './validate-sender'

function isValidSendMessageRequest(data: unknown): data is SendMessageRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.content === 'string' && obj.content.length > 0
}

export function registerChatHandlers(
  orchestrator: Orchestrator,
  getMainWindow: () => BrowserWindow | null,
): void {
  // ── CHAT_SEND_MESSAGE: streaming dispatch (Phase 4 Sprint C) ──
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

    // Stream chunks are pushed via event.sender (the webContents that sent the request)
    const sendChunk = (chunk: unknown): void => {
      try {
        event.sender.send(IPC_CHANNELS.CHAT_STREAM_CHUNK, chunk)
      } catch {
        // webContents may have been destroyed (window closed during stream)
      }
    }

    return orchestrator.handleStreamingChat(data, sendChunk)
  })

  // ── CHAT_ABORT: idempotent abort (Phase 4 Sprint C) ──
  ipcMain.handle(IPC_CHANNELS.CHAT_ABORT, (event): { success: boolean; data: ChatAbortResponse } => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, data: { aborted: false, reason: msg } }
    }

    if (orchestrator.isStreaming()) {
      orchestrator.abortStream()
      return { success: true, data: { aborted: true } }
    }
    return { success: true, data: { aborted: false, reason: 'No active generation' } }
  })

  // ── TOKEN_GET_BUDGET ──
  ipcMain.handle(IPC_CHANNELS.TOKEN_GET_BUDGET, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    return orchestrator.getTokenBudgetState()
  })

  // ── SESSION_GET_STATE ──
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
