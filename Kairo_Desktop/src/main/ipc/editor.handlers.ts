/**
 * Editor IPC Handlers — Phase 6 Sprint A+B (PRD §6.1, §6.2)
 *
 * Registers FS_READ_FILE, FS_WRITE_FILE, and FS_LIST_DIR handlers following
 * the memory.handlers.ts pattern: validateSender → type guard → service → IpcResult.
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { FsReadFileRequest, FsWriteFileRequest, FsListDirRequest } from '../../shared/types'
import type { FileOperationsService } from '../services/file-operations.service'
import { validateSender } from './validate-sender'

// ─── Type Guards ─────────────────────────────────────────────

function isValidFsReadRequest(data: unknown): data is FsReadFileRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.filePath !== 'string' || obj.filePath.trim().length === 0) return false
  if (obj.filePath.includes('\0')) return false
  return true
}

function isValidFsWriteRequest(data: unknown): data is FsWriteFileRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.filePath !== 'string' || obj.filePath.trim().length === 0) return false
  if (obj.filePath.includes('\0')) return false
  if (typeof obj.content !== 'string') return false
  return true
}

function isValidFsListDirRequest(data: unknown): data is FsListDirRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  if (typeof obj.dirPath !== 'string' || obj.dirPath.trim().length === 0) return false
  if (obj.dirPath.includes('\0')) return false
  if (obj.depth !== undefined && (typeof obj.depth !== 'number' || obj.depth < 1)) return false
  return true
}

// ─── Handler Registration ───────────────────────────────────

export function registerEditorHandlers(fileOps: FileOperationsService): void {
  // fs:read-file
  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, async (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidFsReadRequest(data)) {
      return { success: false, error: 'Invalid read request: filePath must be a non-empty string without null bytes.' }
    }
    return fileOps.readFile(data.filePath)
  })

  // fs:write-file
  ipcMain.handle(IPC_CHANNELS.FS_WRITE_FILE, async (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidFsWriteRequest(data)) {
      return { success: false, error: 'Invalid write request: filePath (non-empty, no null bytes) and content (string) are required.' }
    }
    return fileOps.writeFile(data.filePath, data.content)
  })

  // fs:list-dir (Phase 6 Sprint B)
  ipcMain.handle(IPC_CHANNELS.FS_LIST_DIR, async (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidFsListDirRequest(data)) {
      return { success: false, error: 'Invalid list-dir request: dirPath must be a non-empty string without null bytes.' }
    }
    return fileOps.listDir(data.dirPath, data.depth)
  })
}
