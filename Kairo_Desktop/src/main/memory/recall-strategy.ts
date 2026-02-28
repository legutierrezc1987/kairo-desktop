/**
 * Recall Strategy — Phase 5 Sprint A (DEC-026, PRD §12)
 *
 * Determines WHEN to query long-term memory and WHAT to query.
 * 6 triggers per DEC-026:
 *   1. session_start  — after a cut pipeline completes
 *   2. task_change    — user explicitly switches context
 *   3. critical_action — before destructive/high-impact operations
 *   4. periodic       — every N turns (configurable, default 8)
 *   5. contradiction  — agent output conflicts with prior recalled fact
 *   6. manual         — user presses Recall button
 *
 * Codex guard: recall must stay inside single-flight chat lifecycle.
 * Budget guard: recall result truncated to RECALL_BUDGET_TOKENS.
 */

import type { RecallTrigger } from '../../shared/types'
import { RECALL_PERIODIC_INTERVAL, RECALL_BUDGET_TOKENS } from '../../shared/constants'

export interface RecallContext {
  /** Turns since last recall was executed */
  turnsSinceLastRecall: number
  /** Whether a session cut just completed */
  isPostCut: boolean
  /** The user's latest message content (for query building) */
  lastUserMessage: string
  /** Current total tokens used in session */
  currentTokensUsed: number
  /** Total budget for session */
  totalBudget: number
  /** Project name for contextualized queries */
  projectName: string
  /** Whether memory port is available */
  hasMemoryPort: boolean
}

/**
 * Decide whether a recall should be triggered for the given trigger type.
 * Returns false if recall would be pointless (no memory port, budget exhausted, etc).
 */
export function shouldRecall(trigger: RecallTrigger, context: RecallContext): boolean {
  // No memory port → never recall
  if (!context.hasMemoryPort) return false

  // Budget overflow guard: if current usage + recall budget > 80% of total, skip
  // This prevents the infinite cut loop (P0 risk)
  const recallCeilingTokens = context.totalBudget * 0.80
  if (context.currentTokensUsed + RECALL_BUDGET_TOKENS > recallCeilingTokens) {
    return false
  }

  switch (trigger) {
    case 'session_start':
      // Always recall after a cut (context rebuild)
      return context.isPostCut

    case 'task_change':
      // Recall when user explicitly changes task context
      return true

    case 'critical_action':
      // Recall before destructive operations to check prior decisions
      return true

    case 'periodic':
      // Every RECALL_PERIODIC_INTERVAL turns
      return context.turnsSinceLastRecall >= RECALL_PERIODIC_INTERVAL

    case 'contradiction':
      // Only trigger when contradiction detection flags it
      // For MVP: this is gated by the caller who detects the contradiction
      return true

    case 'manual':
      // User explicitly asked — always recall
      return true

    default:
      return false
  }
}

/**
 * Build the query string for a given recall trigger.
 * The query is sent to MemoryPort.query() to search long-term memory.
 */
export function buildQuery(trigger: RecallTrigger, context: RecallContext): string {
  const project = context.projectName || 'current project'

  switch (trigger) {
    case 'session_start':
      return `Current state of ${project}: active decisions, recent changes, pending tasks, known issues`

    case 'task_change':
      return context.lastUserMessage
        ? `Previous decisions and context about: ${context.lastUserMessage.slice(0, 300)}`
        : `Recent decisions and active tasks for ${project}`

    case 'critical_action':
      return context.lastUserMessage
        ? `Restrictions, constraints, and prior decisions related to: ${context.lastUserMessage.slice(0, 300)}`
        : `Critical restrictions and constraints for ${project}`

    case 'periodic':
      return context.lastUserMessage
        ? `Delta and pending items since last check. Current topic: ${context.lastUserMessage.slice(0, 200)}`
        : `Recent changes and pending items for ${project}`

    case 'contradiction':
      return context.lastUserMessage
        ? `Last decision about: ${context.lastUserMessage.slice(0, 300)}`
        : `Recent decisions for ${project}`

    case 'manual':
      // For manual recall, the user's message IS the query
      return context.lastUserMessage || `Summary of ${project} state`

    default:
      return `Current state of ${project}`
  }
}

/**
 * Truncate recall results to fit within the recall budget (DEC-021: 10% = 20K tokens).
 * Uses ~4 chars/token heuristic.
 */
export function truncateToRecallBudget(text: string): string {
  const maxChars = RECALL_BUDGET_TOKENS * 4 // ~4 chars per token
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + '\n\n[Recall truncated to budget limit]'
}
