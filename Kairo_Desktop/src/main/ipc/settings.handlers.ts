import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type {
  SetSettingRequest,
  GetSettingRequest,
  CreateAccountRequest,
  SetActiveAccountRequest,
  DeleteAccountRequest,
  CreateSessionRequest,
  GetActiveSessionRequest,
} from '../../shared/types'
import type { SettingsService } from '../services/settings.service'
import type { SessionPersistenceService } from '../services/session-persistence.service'
import type { AccountService } from '../services/account.service'
import { validateSender } from './validate-sender'

// ─── Type Guards ─────────────────────────────────────────────

function isValidSetSettingRequest(data: unknown): data is SetSettingRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.key === 'string' && obj.key.trim().length > 0 && typeof obj.value === 'string'
}

function isValidGetSettingRequest(data: unknown): data is GetSettingRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.key === 'string' && obj.key.trim().length > 0
}

function isValidCreateAccountRequest(data: unknown): data is CreateAccountRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.label === 'string' &&
    obj.label.trim().length > 0 &&
    typeof obj.apiKey === 'string' &&
    obj.apiKey.trim().length > 0
  )
}

function isValidSetActiveAccountRequest(data: unknown): data is SetActiveAccountRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.accountId === 'string' && obj.accountId.length > 0
}

function isValidDeleteAccountRequest(data: unknown): data is DeleteAccountRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.accountId === 'string' && obj.accountId.length > 0
}

function isValidCreateSessionRequest(data: unknown): data is CreateSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.projectId === 'string' && obj.projectId.length > 0
}

function isValidGetActiveSessionRequest(data: unknown): data is GetActiveSessionRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.projectId === 'string' && obj.projectId.length > 0
}

// ─── Handler Registration ────────────────────────────────────

export function registerSettingsHandlers(
  settingsService: SettingsService,
  sessionPersistence: SessionPersistenceService,
  accountService: AccountService,
  onAccountChanged?: () => void,
  onSettingChanged?: (key: string, value: string) => void,
): void {
  // ── Settings ────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (data === undefined || data === null) {
      return settingsService.getAllSettings()
    }
    if (!isValidGetSettingRequest(data)) {
      return { success: false, error: 'Invalid get setting request: key required.' }
    }
    return settingsService.getSetting(data.key)
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidSetSettingRequest(data)) {
      return { success: false, error: 'Invalid set setting request: key and value required.' }
    }
    const result = settingsService.setSetting(data.key, data.value, data.description)
    if (result.success) {
      onSettingChanged?.(data.key, data.value)
    }
    return result
  })

  // ── Session Persistence ─────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidCreateSessionRequest(data)) {
      return { success: false, error: 'Invalid create session request: projectId required.' }
    }
    return sessionPersistence.createSession(data.projectId)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_GET_ACTIVE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidGetActiveSessionRequest(data)) {
      return { success: false, error: 'Invalid get active session request: projectId required.' }
    }
    return sessionPersistence.getActiveSession(data.projectId)
  })

  // ── Account Management ──────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_CREATE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidCreateAccountRequest(data)) {
      return { success: false, error: 'Invalid create account request: label and apiKey required.' }
    }
    return accountService.createAccount(data.label, data.apiKey, data.tier)
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_LIST, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    return accountService.listAccounts()
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_SET_ACTIVE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidSetActiveAccountRequest(data)) {
      return { success: false, error: 'Invalid set active account request: accountId required.' }
    }
    const result = accountService.setActiveAccount(data.accountId)
    if (result.success) {
      onAccountChanged?.()
    }
    return result
  })

  ipcMain.handle(IPC_CHANNELS.ACCOUNT_DELETE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidDeleteAccountRequest(data)) {
      return { success: false, error: 'Invalid delete account request: accountId required.' }
    }
    const result = accountService.deleteAccount(data.accountId)
    if (result.success) {
      onAccountChanged?.()
    }
    return result
  })
}
