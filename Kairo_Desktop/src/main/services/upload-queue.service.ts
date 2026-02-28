/**
 * UploadQueueService — PRD §5.3 Steps 5-6, DEC-023
 * Manages the upload_queue table for async file uploads to NotebookLM/MCP.
 * Handles enqueue, status transitions, retry logic, and escalation to MANUAL.
 */

import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { UPLOAD_MAX_RETRIES, UPLOAD_RETRY_BASE_MS } from '../../shared/constants'
import type { UploadQueueStatus, UploadFileType } from '../../shared/types'

export interface QueueEntry {
  id: string
  sessionId: string
  filePath: string
  fileType: UploadFileType
  retryCount: number
  status: UploadQueueStatus
  errorMessage: string | null
  createdAt: string
  nextRetryAt: string | null
  consolidatedInto: string | null
}

interface QueueRow {
  id: string
  session_id: string
  file_path: string
  file_type: string
  retry_count: number
  status: string
  error_message: string | null
  created_at: string
  next_retry_at: string | null
  consolidated_into: string | null
}

function rowToEntry(row: QueueRow): QueueEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    filePath: row.file_path,
    fileType: row.file_type as UploadFileType,
    retryCount: row.retry_count,
    status: row.status as UploadQueueStatus,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    nextRetryAt: row.next_retry_at,
    consolidatedInto: row.consolidated_into ?? null,
  }
}

export class UploadQueueService {
  private stmtInsert: Database.Statement
  private stmtSelectPending: Database.Statement
  private stmtSetStatus: Database.Statement
  private stmtRetry: Database.Statement
  private stmtEscalate: Database.Statement
  private stmtSelectSynced: Database.Statement
  private stmtCountSynced: Database.Statement
  private stmtMarkConsolidated: Database.Statement

  constructor(private db: Database.Database) {
    this.stmtInsert = this.db.prepare(
      `INSERT INTO upload_queue (id, session_id, file_path, file_type, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', datetime('now'))`
    )

    this.stmtSelectPending = this.db.prepare(
      `SELECT * FROM upload_queue
       WHERE status IN ('pending', 'failed')
         AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
       ORDER BY created_at ASC
       LIMIT ?`
    )

    this.stmtSetStatus = this.db.prepare(
      `UPDATE upload_queue SET status = ?, error_message = ? WHERE id = ?`
    )

    this.stmtRetry = this.db.prepare(
      `UPDATE upload_queue
       SET status = 'failed',
           retry_count = retry_count + 1,
           error_message = ?,
           next_retry_at = datetime('now', '+' || ? || ' seconds')
       WHERE id = ?`
    )

    this.stmtEscalate = this.db.prepare(
      `UPDATE upload_queue SET status = 'manual', error_message = ? WHERE id = ?`
    )

    // ── Consolidation queries (Phase 5 Sprint B, DEC-022) ──

    this.stmtSelectSynced = this.db.prepare(
      `SELECT * FROM upload_queue
       WHERE status = 'synced'
       ORDER BY created_at ASC
       LIMIT ?`
    )

    this.stmtCountSynced = this.db.prepare(
      `SELECT COUNT(*) as count FROM upload_queue WHERE status = 'synced'`
    )

    this.stmtMarkConsolidated = this.db.prepare(
      `UPDATE upload_queue SET status = 'consolidated', consolidated_into = ? WHERE id = ?`
    )
  }

  /**
   * Enqueue a file for async upload.
   */
  enqueue(sessionId: string, filePath: string, fileType: UploadFileType): QueueEntry {
    const id = randomUUID()
    this.stmtInsert.run(id, sessionId, filePath, fileType)
    return {
      id,
      sessionId,
      filePath,
      fileType,
      retryCount: 0,
      status: 'pending',
      errorMessage: null,
      createdAt: new Date().toISOString(),
      nextRetryAt: null,
      consolidatedInto: null,
    }
  }

  /**
   * Get the next batch of items ready for upload (pending or failed with expired backoff).
   */
  getReady(limit = 5): QueueEntry[] {
    const rows = this.stmtSelectPending.all(limit) as QueueRow[]
    return rows.map(rowToEntry)
  }

  /**
   * Mark an entry as currently uploading.
   */
  markUploading(id: string): void {
    this.stmtSetStatus.run('uploading', null, id)
  }

  /**
   * Mark an entry as successfully synced.
   */
  markSynced(id: string): void {
    this.stmtSetStatus.run('synced', null, id)
  }

  // ── Consolidation Methods (Phase 5 Sprint B, DEC-022) ─────

  /**
   * Get the oldest SYNCED entries for consolidation.
   * Hard Guard #3: ONLY returns entries with status = 'synced'.
   */
  getSyncedSources(limit: number): QueueEntry[] {
    const rows = this.stmtSelectSynced.all(limit) as QueueRow[]
    return rows.map(rowToEntry)
  }

  /**
   * Count total SYNCED entries (for threshold check).
   */
  countSynced(): number {
    const row = this.stmtCountSynced.get() as { count: number }
    return row.count
  }

  /**
   * Mark entries as consolidated (atomic transaction).
   * Hard Guard #2: wraps in transaction for atomicity.
   * Sets status = 'consolidated' and records the master entry ID.
   */
  markConsolidated(ids: string[], masterEntryId: string): void {
    const txn = this.db.transaction(() => {
      for (const id of ids) {
        this.stmtMarkConsolidated.run(masterEntryId, id)
      }
    })
    txn()
  }

  /**
   * Record a failed upload attempt with exponential backoff.
   * Escalates to 'manual' after MAX_RETRIES.
   */
  recordFailure(id: string, errorMessage: string, currentRetryCount: number): void {
    if (currentRetryCount + 1 >= UPLOAD_MAX_RETRIES) {
      this.stmtEscalate.run(`Max retries exceeded: ${errorMessage}`, id)
      console.warn(`[KAIRO_UPLOAD_QUEUE] Entry ${id} escalated to MANUAL after ${UPLOAD_MAX_RETRIES} retries`)
      return
    }

    // Exponential backoff: base * 2^retryCount (in seconds for SQLite)
    const backoffMs = UPLOAD_RETRY_BASE_MS * Math.pow(2, currentRetryCount)
    const backoffSeconds = Math.floor(backoffMs / 1000)
    this.stmtRetry.run(errorMessage, String(backoffSeconds), id)
  }
}
