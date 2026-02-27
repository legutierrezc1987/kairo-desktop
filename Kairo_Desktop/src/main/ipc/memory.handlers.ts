import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { MemoryQueryRequest, MemoryIndexRequest } from '../../shared/types'
import type { MemoryService } from '../memory/memory.service'
import { validateSender } from './validate-sender'
import {
  MEMORY_QUERY_MAX_LENGTH,
  MEMORY_MAX_RESULTS_MIN,
  MEMORY_MAX_RESULTS_MAX,
} from '../../shared/constants'

// ─── Type Guards (hardened — Phase 4 Sprint A) ──────────────

function isValidMemoryQueryRequest(data: unknown): data is MemoryQueryRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.query !== 'string' || obj.query.trim().length === 0) return false
  if (obj.query.length > MEMORY_QUERY_MAX_LENGTH) return false
  if (obj.maxResults !== undefined) {
    if (typeof obj.maxResults !== 'number') return false
    if (!Number.isFinite(obj.maxResults)) return false
    if (obj.maxResults < MEMORY_MAX_RESULTS_MIN || obj.maxResults > MEMORY_MAX_RESULTS_MAX) return false
  }
  return true
}

function isValidMemoryIndexRequest(data: unknown): data is MemoryIndexRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.filePath !== 'string' || obj.filePath.length === 0) return false
  // Reject obviously malicious patterns at the gate
  if (obj.filePath.includes('\0')) return false
  return true
}

// ─── Handler Registration ──────────────────────────────────

export function registerMemoryHandlers(
  memoryService: MemoryService,
  getMainWindow: () => BrowserWindow | null,
): void {
  // Push event: provider changed notification
  memoryService.setOnProviderChanged((notification) => {
    const win = getMainWindow()
    win?.webContents.send(IPC_CHANNELS.MEMORY_PROVIDER_CHANGED, notification)
  })

  // memory:query
  ipcMain.handle(IPC_CHANNELS.MEMORY_QUERY, async (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidMemoryQueryRequest(data)) {
      return {
        success: false,
        error: `Invalid memory query request: query must be a non-empty string (max ${MEMORY_QUERY_MAX_LENGTH} chars), maxResults must be ${MEMORY_MAX_RESULTS_MIN}-${MEMORY_MAX_RESULTS_MAX} if provided.`,
      }
    }
    return memoryService.query(data.query, data.maxResults)
  })

  // memory:index
  ipcMain.handle(IPC_CHANNELS.MEMORY_INDEX, async (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidMemoryIndexRequest(data)) {
      return { success: false, error: 'Invalid memory index request: filePath must be a non-empty string without null bytes.' }
    }
    return memoryService.index(data.filePath)
  })

  // memory:health
  ipcMain.handle(IPC_CHANNELS.MEMORY_HEALTH, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    return memoryService.getHealth()
  })
}
