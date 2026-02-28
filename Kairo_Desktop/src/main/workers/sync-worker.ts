/**
 * SyncWorker — PRD §5.3 Step 6 (async upload)
 * Background setTimeout-based loop that processes the upload queue.
 * Single-flight: one upload at a time. Uses Promise.race for timeout.
 *
 * Phase 5 Sprint B: After successful upload, checks consolidation threshold.
 */

import { readFile } from 'node:fs/promises'
import type { UploadQueueService, QueueEntry } from '../services/upload-queue.service'
import { UPLOAD_TIMEOUT_MS, SYNC_WORKER_INTERVAL_MS } from '../../shared/constants'
import { shouldConsolidate, executeConsolidation, type ConsolidationPort, type ConsolidationResult } from '../memory/consolidation-engine'
import type { ConsolidationPhase } from '../../shared/types'

/**
 * Port for the memory/upload provider so SyncWorker doesn't depend on concrete MemoryService.
 */
export interface UploadPort {
  index(filePath: string): Promise<{ indexed: boolean; error?: string }>
}

/**
 * Callback for emitting consolidation status to renderer via IPC push.
 */
export type ConsolidationStatusEmitter = (phase: ConsolidationPhase) => void

export class SyncWorker {
  private timer: ReturnType<typeof setTimeout> | null = null
  private _isProcessing = false
  private _isConsolidating = false
  private _stopped = false
  private _consolidationPort: ConsolidationPort | null = null
  private _consolidationEmitter: ConsolidationStatusEmitter | null = null
  private _projectFolder = ''
  private _activeSessionId = ''

  constructor(
    private uploadQueue: UploadQueueService,
    private uploadPort: UploadPort,
  ) {}

  // ── Consolidation wiring (Phase 5 Sprint B) ─────────────────

  setConsolidationPort(port: ConsolidationPort): void {
    this._consolidationPort = port
  }

  setConsolidationEmitter(emitter: ConsolidationStatusEmitter): void {
    this._consolidationEmitter = emitter
  }

  setProjectContext(projectFolder: string, sessionId: string): void {
    this._projectFolder = projectFolder
    this._activeSessionId = sessionId
  }

  isConsolidating(): boolean {
    return this._isConsolidating
  }

  /**
   * Start the background tick loop.
   */
  start(): void {
    if (this._stopped) return
    this.scheduleTick()
    console.log('[KAIRO_SYNC_WORKER] Started')
  }

  /**
   * Stop the worker and cancel pending tick.
   */
  stop(): void {
    this._stopped = true
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    console.log('[KAIRO_SYNC_WORKER] Stopped')
  }

  isProcessing(): boolean {
    return this._isProcessing
  }

  /**
   * Process one item from the queue. Exposed for direct invocation during pipeline.
   * Returns true if an item was processed (success or failure), false if queue was empty.
   */
  async processOne(): Promise<boolean> {
    const ready = this.uploadQueue.getReady(1)
    if (ready.length === 0) return false

    const entry = ready[0]
    this._isProcessing = true

    try {
      await this.uploadEntry(entry)
    } finally {
      this._isProcessing = false
    }

    return true
  }

  // ── Private ──────────────────────────────────────────────────

  private scheduleTick(): void {
    if (this._stopped) return
    this.timer = setTimeout(async () => {
      await this.tick()
      this.scheduleTick()
    }, SYNC_WORKER_INTERVAL_MS)
  }

  private async tick(): Promise<void> {
    if (this._isProcessing) return

    const ready = this.uploadQueue.getReady(5)
    for (const entry of ready) {
      if (this._stopped) break
      this._isProcessing = true
      try {
        await this.uploadEntry(entry)
      } finally {
        this._isProcessing = false
      }
    }
  }

  private async uploadEntry(entry: QueueEntry): Promise<void> {
    this.uploadQueue.markUploading(entry.id)

    try {
      // Promise.race: mandatory timeout per Codex guard #3
      const result = await Promise.race([
        this.uploadPort.index(entry.filePath),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Upload timed out')), UPLOAD_TIMEOUT_MS)
        ),
      ])

      if (result.indexed) {
        this.uploadQueue.markSynced(entry.id)
        console.log(`[KAIRO_SYNC_WORKER] Uploaded ${entry.filePath} (${entry.fileType})`)

        // Phase 5 Sprint B: Check consolidation threshold after successful upload
        this.maybeConsolidate()
      } else {
        this.uploadQueue.recordFailure(entry.id, result.error ?? 'Index returned false', entry.retryCount)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.uploadQueue.recordFailure(entry.id, msg, entry.retryCount)
      console.warn(`[KAIRO_SYNC_WORKER] Upload failed for ${entry.filePath}: ${msg}`)
    }
  }

  /**
   * Fire-and-forget consolidation check after a successful upload.
   * Hard Guard #1: _isConsolidating prevents concurrent consolidation runs.
   */
  private maybeConsolidate(): void {
    if (this._isConsolidating) return
    if (!this._consolidationPort) return
    if (!this._projectFolder || !this._activeSessionId) return

    const syncedCount = this.uploadQueue.countSynced()
    if (!shouldConsolidate(syncedCount)) return

    this._isConsolidating = true
    const emitter = this._consolidationEmitter ?? (() => {})

    executeConsolidation(
      this._consolidationPort,
      this._projectFolder,
      this._activeSessionId,
      emitter,
    ).then((result: ConsolidationResult) => {
      if (result.consolidated) {
        console.log(`[KAIRO_SYNC_WORKER] Consolidation complete: merged ${result.mergedCount} sources`)
      }
    }).catch((err: unknown) => {
      console.error(`[KAIRO_SYNC_WORKER] Consolidation error: ${err instanceof Error ? err.message : String(err)}`)
    }).finally(() => {
      this._isConsolidating = false
    })
  }
}
