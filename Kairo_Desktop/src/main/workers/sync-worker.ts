/**
 * SyncWorker — PRD §5.3 Step 6 (async upload)
 * Background setTimeout-based loop that processes the upload queue.
 * Single-flight: one upload at a time. Uses Promise.race for timeout.
 */

import { readFile } from 'node:fs/promises'
import type { UploadQueueService, QueueEntry } from '../services/upload-queue.service'
import { UPLOAD_TIMEOUT_MS, SYNC_WORKER_INTERVAL_MS } from '../../shared/constants'

/**
 * Port for the memory/upload provider so SyncWorker doesn't depend on concrete MemoryService.
 */
export interface UploadPort {
  index(filePath: string): Promise<{ indexed: boolean; error?: string }>
}

export class SyncWorker {
  private timer: ReturnType<typeof setTimeout> | null = null
  private _isProcessing = false
  private _stopped = false

  constructor(
    private uploadQueue: UploadQueueService,
    private uploadPort: UploadPort,
  ) {}

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
      } else {
        this.uploadQueue.recordFailure(entry.id, result.error ?? 'Index returned false', entry.retryCount)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.uploadQueue.recordFailure(entry.id, msg, entry.retryCount)
      console.warn(`[KAIRO_SYNC_WORKER] Upload failed for ${entry.filePath}: ${msg}`)
    }
  }
}
