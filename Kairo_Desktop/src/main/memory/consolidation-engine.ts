/**
 * Consolidation Engine — Phase 5 Sprint B (DEC-022, PRD §13)
 *
 * Implements the "40-1 Rule": when the notebook accumulates 40+ SYNCED sources,
 * merge the oldest 20 into a single Master Summary, upload it, and delete the
 * 20 originals from the remote provider.
 *
 * Architecture: pure function module — stateless, receives dependencies via ConsolidationPort.
 *
 * Hard Guards:
 * 1. _isConsolidating lock (caller responsibility — SyncWorker)
 * 2. Atomic source claiming (SYNCED-only, transactional in DB)
 * 3. Never delete non-SYNCED sources (DB query filters)
 * 4. Consolidation input cap (CONSOLIDATION_INPUT_CAP_CHARS)
 * 5. Keep local summary files on disk (never delete .kairo/sessions/ files)
 */

import type { QueueEntry } from '../services/upload-queue.service'
import type { DeleteSourceResult, ConsolidationPhase } from '../../shared/types'
import {
  CONSOLIDATION_SOURCE_THRESHOLD,
  CONSOLIDATION_MERGE_COUNT,
  CONSOLIDATION_INPUT_CAP_CHARS,
  CONSOLIDATION_TIMEOUT_MS,
} from '../../shared/constants'

// ─── Port Interface (dependency injection for testability) ────

export interface ConsolidationPort {
  /** Count SYNCED entries in upload queue */
  getSyncedCount(): number
  /** Get the N oldest SYNCED entries (Hard Guard #3: only status='synced') */
  getOldestSynced(limit: number): QueueEntry[]
  /** Read a source file from disk (Hard Guard #5: files stay on disk) */
  readSourceFile(filePath: string): Promise<string>
  /** Generate a Master Summary from merged content via LLM */
  generateMasterSummary(mergedContent: string, sourceCount: number): Promise<string>
  /** Save Master Summary to disk and return its file path */
  saveMasterSummary(projectFolder: string, content: string): Promise<string>
  /** Enqueue the Master Summary for upload */
  enqueueMasterSummary(sessionId: string, filePath: string): string
  /** Mark entries as consolidated in DB (Hard Guard #2: atomic transaction) */
  markConsolidated(ids: string[], masterEntryId: string): void
  /** Delete a source from the remote memory provider */
  deleteRemoteSource(sourceId: string): Promise<DeleteSourceResult>
}

// ─── Result Types ─────────────────────────────────────────────

export interface ConsolidationResult {
  consolidated: boolean
  mergedCount: number
  masterSummaryPath?: string
  masterEntryId?: string
  deletedSources: string[]
  failedDeletes: string[]
  error?: string
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Check whether consolidation should be triggered.
 * Returns true when SYNCED source count >= CONSOLIDATION_SOURCE_THRESHOLD.
 */
export function shouldConsolidate(syncedCount: number): boolean {
  return syncedCount >= CONSOLIDATION_SOURCE_THRESHOLD
}

/**
 * Execute the full consolidation pipeline.
 *
 * @param port - Dependency injection port for all I/O operations
 * @param projectFolder - Active project folder path
 * @param sessionId - Current DB session ID (for enqueue)
 * @param emitStatus - Callback to push phase updates to renderer
 * @returns ConsolidationResult with details of what was consolidated
 */
export async function executeConsolidation(
  port: ConsolidationPort,
  projectFolder: string,
  sessionId: string,
  emitStatus: (phase: ConsolidationPhase) => void,
): Promise<ConsolidationResult> {
  const result: ConsolidationResult = {
    consolidated: false,
    mergedCount: 0,
    deletedSources: [],
    failedDeletes: [],
  }

  try {
    // ── Step 1: Claim oldest SYNCED sources ────────────────────
    emitStatus('claiming')

    const syncedCount = port.getSyncedCount()
    if (!shouldConsolidate(syncedCount)) {
      emitStatus('skipped')
      return result
    }

    const sources = port.getOldestSynced(CONSOLIDATION_MERGE_COUNT)
    if (sources.length === 0) {
      emitStatus('skipped')
      return result
    }

    // Validate all claimed sources are still SYNCED (Hard Guard #2)
    const validSources = sources.filter(s => s.status === 'synced')
    if (validSources.length === 0) {
      emitStatus('skipped')
      return result
    }

    // ── Step 2: Read source files and merge with input cap ─────
    emitStatus('merging')

    const sourceContents: string[] = []
    for (const source of validSources) {
      try {
        const content = await port.readSourceFile(source.filePath)
        sourceContents.push(content)
      } catch (err) {
        // Skip unreadable files — don't fail entire consolidation
        console.warn(`[KAIRO_CONSOLIDATION] Could not read ${source.filePath}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if (sourceContents.length === 0) {
      emitStatus('error')
      result.error = 'No source files could be read'
      return result
    }

    const mergedContent = truncateConsolidationInput(sourceContents)

    // Generate Master Summary via LLM (with timeout + mechanical fallback)
    let masterSummaryText: string
    try {
      masterSummaryText = await Promise.race([
        port.generateMasterSummary(mergedContent, sourceContents.length),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Consolidation LLM generation timed out')), CONSOLIDATION_TIMEOUT_MS)
        ),
      ])
    } catch {
      // Mechanical fallback: use truncated merged content with header
      masterSummaryText = mechanicalFallback(mergedContent, sourceContents.length)
    }

    // ── Step 3: Save + enqueue Master Summary ──────────────────
    emitStatus('uploading')

    const masterPath = await port.saveMasterSummary(projectFolder, masterSummaryText)
    const masterEntryId = port.enqueueMasterSummary(sessionId, masterPath)

    result.masterSummaryPath = masterPath
    result.masterEntryId = masterEntryId

    // ── Step 4: Delete remote sources ──────────────────────────
    emitStatus('deleting')

    for (const source of validSources) {
      try {
        const deleteResult = await port.deleteRemoteSource(source.filePath)
        if (deleteResult.deleted) {
          result.deletedSources.push(source.id)
        } else {
          result.failedDeletes.push(source.id)
        }
      } catch {
        result.failedDeletes.push(source.id)
      }
    }

    // ── Step 5: Mark consolidated in DB (atomic transaction) ───
    const idsToMark = validSources.map(s => s.id)
    port.markConsolidated(idsToMark, masterEntryId)

    result.consolidated = true
    result.mergedCount = validSources.length

    emitStatus('done')
    console.log(`[KAIRO_CONSOLIDATION] Merged ${validSources.length} sources → ${masterPath} (${result.deletedSources.length} deleted, ${result.failedDeletes.length} failed)`)
    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    emitStatus('error')
    result.error = msg
    console.error(`[KAIRO_CONSOLIDATION] Pipeline error: ${msg}`)
    return result
  }
}

// ─── Internal Helpers ─────────────────────────────────────────

/**
 * Truncate merged source content to fit within CONSOLIDATION_INPUT_CAP_CHARS.
 * Hard Guard #4: prevents LLM context overflow.
 */
export function truncateConsolidationInput(sources: string[]): string {
  let result = ''
  for (const source of sources) {
    if (result.length + source.length > CONSOLIDATION_INPUT_CAP_CHARS) {
      const remaining = CONSOLIDATION_INPUT_CAP_CHARS - result.length
      if (remaining > 0) {
        result += source.slice(0, remaining)
      }
      break
    }
    result += source + '\n---\n'
  }
  return result
}

/**
 * Mechanical fallback for Master Summary when LLM is unavailable.
 * Produces a structured header + truncated merged content.
 */
function mechanicalFallback(mergedContent: string, sourceCount: number): string {
  const maxLen = 20_000 // ~5K tokens for mechanical fallback
  const truncated = mergedContent.length > maxLen
    ? mergedContent.slice(0, maxLen) + '\n\n[Content truncated — mechanical fallback]'
    : mergedContent
  return `# Master Summary (mechanical fallback)\n\nConsolidated from ${sourceCount} session summaries.\n\n---\n\n${truncated}`
}

/** LLM prompt template for Master Summary generation */
export const MASTER_SUMMARY_PROMPT = `You are consolidating session summaries for the Kairo AI assistant into a single Master Summary.

Given the following merged session summaries, produce a comprehensive Master Summary with these sections:
1. KEY DECISIONS — Important architectural and technical decisions made across sessions
2. CODE CHANGES — Major files and code areas modified
3. CURRENT STATE — Where the project stands right now
4. OPEN ITEMS — Unresolved questions or pending work
5. PATTERNS & CONVENTIONS — Established patterns that must be followed
6. RISKS — Known risks and their mitigations

Preserve all actionable information. Remove redundant context and resolved items.
Be comprehensive but concise. Use markdown formatting.`
