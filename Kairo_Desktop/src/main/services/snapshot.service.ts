/**
 * SnapshotService — PRD §5.3 Steps 3-4
 * Generates structured session summaries and saves transcript + summary to disk.
 * Uses Gemini Flash (DEC-019 background model) for LLM summarisation,
 * with a mechanical fallback if LLM is unavailable or times out.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Content } from '@google/generative-ai'
import { generateContent, isInitialized } from './gemini-gateway'
import { SNAPSHOT_GENERATION_TIMEOUT_MS, MODEL_ROUTING } from '../../shared/constants'
import type { ModelId } from '../../shared/types'

/** DEC-019: background model for snapshot generation */
const SNAPSHOT_MODEL: ModelId = MODEL_ROUTING.background

const SUMMARY_PROMPT = `You are a session summariser for the Kairo AI assistant.
Given the following conversation transcript, produce a structured summary with these sections:
1. KEY TOPICS — Bullet list of main subjects discussed
2. DECISIONS MADE — Any concrete decisions or conclusions
3. CODE CHANGES — Files or code areas modified (if any)
4. OPEN ITEMS — Unresolved questions or pending work
5. CONTEXT FOR NEXT SESSION — What the next session needs to know to continue

Be concise. Use markdown formatting.`

export interface SnapshotResult {
  transcriptPath: string
  summaryPath: string
  summaryText: string
}

/**
 * Format a Content[] history into a human-readable transcript.
 */
function formatTranscript(history: Content[]): string {
  const lines: string[] = []
  for (const turn of history) {
    const role = turn.role === 'user' ? 'USER' : 'MODEL'
    const text = turn.parts?.map(p => ('text' in p ? p.text : '')).join('') ?? ''
    lines.push(`## ${role}\n${text}\n`)
  }
  return lines.join('\n')
}

/**
 * Mechanical fallback: extract last N messages as a plain-text summary.
 * Used when LLM is unavailable, quota-blocked, or times out.
 */
function mechanicalSummary(history: Content[]): string {
  const lastTurns = history.slice(-6) // last 3 exchanges
  const lines = ['# Session Summary (mechanical fallback)\n']
  for (const turn of lastTurns) {
    const role = turn.role === 'user' ? 'USER' : 'MODEL'
    const text = turn.parts?.map(p => ('text' in p ? p.text : '')).join('') ?? ''
    const truncated = text.length > 500 ? text.slice(0, 500) + '...' : text
    lines.push(`**${role}**: ${truncated}\n`)
  }
  return lines.join('\n')
}

/**
 * Generate structured summary via LLM with timeout + fallback.
 */
async function generateSummary(transcript: string): Promise<string> {
  if (!isInitialized()) {
    return mechanicalSummary([])
  }

  const prompt = `${SUMMARY_PROMPT}\n\n---\n\n${transcript}`

  try {
    const result = await Promise.race([
      generateContent(prompt, SNAPSHOT_MODEL),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Snapshot generation timed out')), SNAPSHOT_GENERATION_TIMEOUT_MS)
      ),
    ])
    return result.text
  } catch (err) {
    console.warn(`[KAIRO_SNAPSHOT] LLM summary failed, using mechanical fallback: ${err instanceof Error ? err.message : String(err)}`)
    return `# Session Summary (mechanical fallback — LLM error)\n\nError: ${err instanceof Error ? err.message : 'unknown'}\n\n(Full transcript saved separately)`
  }
}

/**
 * Create the snapshot directory for a project session.
 * Returns the directory path.
 */
function snapshotDir(projectFolderPath: string): string {
  return join(projectFolderPath, '.kairo', 'sessions')
}

/**
 * Save transcript and summary to disk, returning file paths and summary text.
 *
 * @param projectFolderPath - The project's root folder (workspace)
 * @param sessionNumber - Current session number (for file naming)
 * @param history - Full chat history (Content[])
 * @returns SnapshotResult with paths and summary text
 */
export async function createSnapshot(
  projectFolderPath: string,
  sessionNumber: number,
  history: Content[],
): Promise<SnapshotResult> {
  const dir = snapshotDir(projectFolderPath)
  await mkdir(dir, { recursive: true })

  const transcript = formatTranscript(history)

  // Generate LLM summary (with timeout + mechanical fallback)
  const summaryText = transcript.length > 0
    ? await generateSummary(transcript)
    : mechanicalSummary(history)

  const prefix = `session_${String(sessionNumber).padStart(3, '0')}`
  const transcriptPath = join(dir, `${prefix}_transcript.md`)
  const summaryPath = join(dir, `${prefix}_summary.md`)

  await Promise.all([
    writeFile(transcriptPath, transcript, 'utf-8'),
    writeFile(summaryPath, summaryText, 'utf-8'),
  ])

  console.log(`[KAIRO_SNAPSHOT] Saved transcript (${transcriptPath}) and summary (${summaryPath})`)

  return { transcriptPath, summaryPath, summaryText }
}
