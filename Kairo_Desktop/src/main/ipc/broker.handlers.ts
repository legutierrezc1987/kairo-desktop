import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { ApprovalRequest, BrokerMode } from '../../shared/types'
import type { ExecutionBroker } from '../execution/execution-broker'
import type { SettingsService } from '../services/settings.service'
import { validateSender } from './validate-sender'

function isValidApprovalRequest(data: unknown): data is ApprovalRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.commandId === 'string' && obj.commandId.length > 0
}

function isValidModeRequest(data: unknown): data is { mode: BrokerMode } {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return obj.mode === 'auto' || obj.mode === 'supervised'
}

export function registerBrokerHandlers(
  broker: ExecutionBroker,
  getMainWindow: () => BrowserWindow | null,
  settingsService?: SettingsService,
): void {
  // Wire push events: pending-added
  broker.setOnPendingAdded((pending) => {
    const win = getMainWindow()
    win?.webContents.send(IPC_CHANNELS.BROKER_PENDING_ADDED, {
      id: pending.id,
      terminalId: pending.terminalId,
      command: pending.command,
      zone: pending.classification.zone,
      reason: pending.classification.reason,
      expiresAt: pending.expiresAt,
    })
  })

  // Wire push events: pending-resolved
  broker.setOnPendingResolved((id, decision, reason) => {
    const win = getMainWindow()
    win?.webContents.send(IPC_CHANNELS.BROKER_PENDING_RESOLVED, {
      id, decision, reason,
    })
  })

  // Get current mode
  ipcMain.handle(IPC_CHANNELS.BROKER_GET_MODE, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    return { success: true, data: { mode: broker.getMode() } }
  })

  // Set mode
  ipcMain.handle(IPC_CHANNELS.BROKER_SET_MODE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidModeRequest(data)) {
      return { success: false, error: 'Invalid mode. Must be "auto" or "supervised".' }
    }
    broker.setMode(data.mode)
    settingsService?.setSetting('broker_mode', data.mode, 'Execution broker mode')
    return { success: true, data: { mode: broker.getMode() } }
  })

  // Approve pending command
  ipcMain.handle(IPC_CHANNELS.BROKER_APPROVE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidApprovalRequest(data)) {
      return { success: false, error: 'Invalid approval request: commandId required.' }
    }
    const result = broker.approve(data.commandId)
    return { success: true, data: result }
  })

  // Reject pending command
  ipcMain.handle(IPC_CHANNELS.BROKER_REJECT, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidApprovalRequest(data)) {
      return { success: false, error: 'Invalid rejection request: commandId required.' }
    }
    const result = broker.reject(data.commandId)
    return { success: true, data: result }
  })

  // Get all pending commands
  ipcMain.handle(IPC_CHANNELS.BROKER_GET_PENDING, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    const pending = broker.getPendingCommands()
    return {
      success: true,
      data: pending.map((p) => ({
        id: p.id,
        terminalId: p.terminalId,
        command: p.command,
        zone: p.classification.zone,
        reason: p.classification.reason,
        expiresAt: p.expiresAt,
      })),
    }
  })
}
