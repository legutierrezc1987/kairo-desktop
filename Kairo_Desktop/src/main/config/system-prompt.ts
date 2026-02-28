/**
 * System Prompt Builder — PRD §5.3 Step 11 (build new context)
 * Assembles the system instruction injected at session start and after each cut.
 */

const BASE_PROMPT = `You are Kairo, an AI assistant with persistent memory.
You help users with software development, analysis, and technical tasks.
You operate under structured governance and maintain session continuity.`

/**
 * Build the system prompt for a new or resumed session.
 * @param projectName - Current project name (may be empty if no project loaded)
 * @param recallContext - Memory recall text injected after a session cut (empty string = first session)
 * @param bridgeSummary - Plain-text bridge buffer summary from previous session (empty = none)
 */
export function buildSystemPrompt(
  projectName: string,
  recallContext: string,
  bridgeSummary: string,
): string {
  const parts: string[] = [BASE_PROMPT]

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
