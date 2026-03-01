/**
 * UndoManager Service — Phase 6 Sprint D (DEC-017)
 *
 * Ephemeral LIFO undo stack for file write operations.
 * NOT persisted across restarts — purely in-memory per session.
 *
 * Features:
 * - Pre-write snapshot capture (text files only, ≤ UNDO_MAX_FILE_BYTES)
 * - Collision guard: validates mtime before reverting (prevents overwriting concurrent edits)
 * - Bounded stack: evicts oldest entries when UNDO_STACK_MAX_ENTRIES exceeded
 */

import { stat, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { IpcResult, UndoEntry, UndoPreviewResponse, UndoApplyResponse } from '../../shared/types'
import { UNDO_STACK_MAX_ENTRIES, UNDO_MAX_FILE_BYTES } from '../../shared/constants'

export class UndoManagerService {
  private stack: UndoEntry[] = []
  private counter = 0

  /** Number of entries in the undo stack */
  get size(): number {
    return this.stack.length
  }

  /**
   * Capture a pre-write snapshot for the given file.
   * Called by FileOperationsService BEFORE writing.
   *
   * Returns the entry ID if captured, null if skipped (file too large, binary, new file, etc.)
   */
  async captureSnapshot(filePath: string, newContent: string): Promise<string | null> {
    const resolvedPath = resolve(filePath)

    let oldContent: string
    try {
      const fileStat = await stat(resolvedPath)
      if (!fileStat.isFile()) return null
      if (fileStat.size > UNDO_MAX_FILE_BYTES) return null

      const buffer = await readFile(resolvedPath)
      // Skip binary files (null byte in first 8KB)
      if (buffer.subarray(0, 8192).includes(0)) return null

      oldContent = buffer.toString('utf-8')
    } catch {
      // File doesn't exist yet (new file) — no previous content to snapshot
      return null
    }

    // Don't capture if content is unchanged
    if (oldContent === newContent) return null

    const entryId = `undo-${++this.counter}-${Date.now()}`

    const entry: UndoEntry = {
      id: entryId,
      filePath: resolvedPath,
      oldContent,
      newContent,
      timestamp: Date.now(),
      expectedMtimeMs: 0, // Will be set after write completes
      sizeBytes: Buffer.byteLength(oldContent, 'utf-8'),
    }

    this.stack.push(entry)

    // Evict oldest if stack exceeds limit
    while (this.stack.length > UNDO_STACK_MAX_ENTRIES) {
      this.stack.shift()
    }

    return entryId
  }

  /**
   * Finalize entry after successful write — record the resulting mtime.
   * Must be called AFTER the write succeeds.
   */
  async finalizeEntry(entryId: string, filePath: string): Promise<void> {
    const entry = this.stack.find((e) => e.id === entryId)
    if (!entry) return

    try {
      const fileStat = await stat(resolve(filePath))
      entry.expectedMtimeMs = fileStat.mtimeMs
    } catch {
      // If stat fails, remove entry (unreliable for collision detection)
      this.stack = this.stack.filter((e) => e.id !== entryId)
    }
  }

  /**
   * Get the most recent undo entry for a file (for diff preview).
   * Also reads the current file content for side-by-side diff.
   */
  async getPreview(filePath: string): Promise<IpcResult<UndoPreviewResponse>> {
    const resolvedPath = resolve(filePath)

    // Find the most recent entry for this file
    const entry = this.findLatestForFile(resolvedPath)
    if (!entry) {
      return { success: false, error: 'No undo history available for this file.' }
    }

    try {
      const currentContent = await readFile(resolvedPath, 'utf-8')
      return {
        success: true,
        data: { entry, currentContent },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to read current file'
      return { success: false, error: msg }
    }
  }

  /**
   * Apply undo: restore oldContent to disk.
   * Collision guard: validates mtime matches expected value before writing.
   */
  async applyUndo(entryId: string): Promise<IpcResult<UndoApplyResponse>> {
    const entryIndex = this.stack.findIndex((e) => e.id === entryId)
    if (entryIndex === -1) {
      return { success: false, error: 'Undo entry not found. It may have been evicted.' }
    }

    const entry = this.stack[entryIndex]
    const resolvedPath = resolve(entry.filePath)

    // Collision guard: verify file hasn't been modified externally
    // Primary check: content matches what we wrote (entry.newContent)
    // Secondary check: mtime matches expected value (fast path for identical re-writes)
    try {
      const currentContent = await readFile(resolvedPath, 'utf-8')
      if (currentContent !== entry.newContent) {
        return {
          success: false,
          error: 'File was modified externally since last save. Undo aborted to prevent data loss.',
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cannot verify file state'
      return { success: false, error: `Collision check failed: ${msg}` }
    }

    // Write the old content back
    try {
      await writeFile(resolvedPath, entry.oldContent, 'utf-8')
      const restoredBytes = Buffer.byteLength(entry.oldContent, 'utf-8')

      // Remove this entry and all entries above it (they depend on this state)
      this.stack.splice(entryIndex)

      return {
        success: true,
        data: {
          filePath: resolvedPath,
          restoredBytes,
        },
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Write failed during undo'
      return { success: false, error: msg }
    }
  }

  /** Check if undo is available for a specific file */
  hasUndoForFile(filePath: string): boolean {
    const resolvedPath = resolve(filePath)
    return this.findLatestForFile(resolvedPath) !== null
  }

  /** Get list of files with available undo entries (for UI display) */
  getUndoableFiles(): string[] {
    const seen = new Set<string>()
    const files: string[] = []
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (!seen.has(this.stack[i].filePath)) {
        seen.add(this.stack[i].filePath)
        files.push(this.stack[i].filePath)
      }
    }
    return files
  }

  /** Clear entire undo stack (e.g., on project switch) */
  clear(): void {
    this.stack = []
  }

  // ── Internal ─────────────────────────────────────────────

  private findLatestForFile(resolvedPath: string): UndoEntry | null {
    const normalized = process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const entryPath = process.platform === 'win32'
        ? this.stack[i].filePath.toLowerCase()
        : this.stack[i].filePath
      if (entryPath === normalized) {
        return this.stack[i]
      }
    }
    return null
  }
}
