/**
 * System Prompt Builder — PRD §5.3 Step 11 (build new context)
 * Assembles the system instruction injected at session start and after each cut.
 */

import type { VisibilityMode } from '../../shared/types'

const BASE_PROMPT = `You are Kairo, an AI assistant with persistent memory.
You help users with software development, analysis, and technical tasks.
You operate under structured governance and maintain session continuity.`

const VISIBILITY_INSTRUCTIONS: Record<VisibilityMode, string> = {
  concise: 'Be concise and direct. Prioritize brevity. Omit verbose explanations unless asked.',
  detailed: 'Provide thorough, detailed explanations. Include context, reasoning, and examples when helpful.',
}

/**
 * Build the system prompt for a new or resumed session.
 * @param projectName - Current project name (may be empty if no project loaded)
 * @param recallContext - Memory recall text injected after a session cut (empty string = first session)
 * @param bridgeSummary - Plain-text bridge buffer summary from previous session (empty = none)
 * @param visibilityMode - Response style preference (concise or detailed)
 */
export function buildSystemPrompt(
  projectName: string,
  recallContext: string,
  bridgeSummary: string,
  visibilityMode?: VisibilityMode,
): string {
  const parts: string[] = [BASE_PROMPT]

  if (visibilityMode) {
    parts.push(`\n## Response Style\n${VISIBILITY_INSTRUCTIONS[visibilityMode]}`)
  }

  if (projectName) {
    parts.push(`\n## Active Project\n${projectName}`)
  }

  if (bridgeSummary) {
    parts.push(`\n## Previous Session Context\n${bridgeSummary}`)
  }

  if (recallContext) {
    parts.push(`\n## Memory Recall\n${recallContext}`)
  }

  return parts.join('\n')
}
