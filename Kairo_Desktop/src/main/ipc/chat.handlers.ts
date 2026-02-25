import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { SendMessageRequest } from '../../shared/types'
import type { Orchestrator } from '../core/orchestrator'
import { validateSender } from './validate-sender'

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
