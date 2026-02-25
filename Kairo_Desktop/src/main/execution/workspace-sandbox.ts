import { resolve, normalize } from 'node:path'
import { YELLOW_FILE_COMMANDS } from '../config/command-zones'

/**
 * Workspace sandbox validation — DEC-025.
 * Ensures a path is inside the project workspace folder.
 * SECURITY: Uses resolved absolute paths to prevent traversal attacks (../../).
 */
export function isInsideWorkspace(targetPath: string, workspacePath: string): boolean {
  const resolvedTarget = normalize(resolve(targetPath))
  const resolvedWorkspace = normalize(resolve(workspacePath))

  // Case-insensitive on Windows
  if (process.platform === 'win32') {
    return resolvedTarget.toLowerCase().startsWith(resolvedWorkspace.toLowerCase())
  }
  return resolvedTarget.startsWith(resolvedWorkspace)
}

/**
 * Validate that a CWD for terminal spawn is inside the workspace.
 */
export function validateWorkspaceCwd(
  cwd: string,
  workspacePath: string
): { valid: boolean; reason: string } {
  if (!workspacePath) {
    return { valid: false, reason: 'No workspace path configured.' }
  }
  if (!cwd) {
    return { valid: false, reason: 'No working directory specified.' }
  }
  if (!isInsideWorkspace(cwd, workspacePath)) {
    return {
      valid: false,
      reason: `Path "${cwd}" is outside workspace "${workspacePath}". DEC-025 requires confirmation.`,
    }
  }
  return { valid: true, reason: 'Path is inside workspace.' }
}

// ─── Command Path Validation (Sprint C — DEC-025) ───────────

/**
 * Tokenize a command string into an array of tokens.
 * Respects double-quoted and single-quoted strings.
 */
export function tokenizeCommand(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (const ch of input) {
    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null
      } else {
        current += ch
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens
}

/**
 * Heuristic: does a token look like a filesystem path?
 * Returns true for absolute paths, relative paths, and Windows drive paths.
 */
export function isLikelyPath(token: string): boolean {
  // Relative paths
  if (token.startsWith('./') || token.startsWith('../') || token.startsWith('~')) return true
  // Unix absolute
  if (token.startsWith('/')) return true
  // Windows drive letter (e.g. C:\)
  if (/^[a-zA-Z]:[/\\]/.test(token)) return true
  // UNC path
  if (token.startsWith('\\\\')) return true
  // Contains path separators (e.g. subdir/file or subdir\file)
  if (token.includes('/') || token.includes('\\')) return true
  return false
}

/**
 * Validate that all path-like arguments in a YELLOW file-mutation command
 * are inside the workspace boundary.
 *
 * SECURITY: Only checks YELLOW_FILE_COMMANDS (rm, del, rmdir, cp, mv, chmod).
 * Non-file commands and flags (starting with `-`) are skipped.
 * Uses workspace-relative resolution for relative paths.
 */
export function validateCommandPaths(
  command: string,
  workspacePath: string
): { valid: boolean; reason: string; violatingPath?: string } {
  const tokens = tokenizeCommand(command.trim())
  if (tokens.length < 2) return { valid: true, reason: 'No arguments to validate.' }

  const baseCmd = tokens[0].toLowerCase()
  if (!YELLOW_FILE_COMMANDS.includes(baseCmd)) {
    return { valid: true, reason: 'Command not in file-mutation list.' }
  }

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.startsWith('-')) continue // skip flags
    if (!isLikelyPath(token)) continue // skip non-path args

    // Resolve relative paths against workspace (not Node.js CWD)
    const resolvedToken = resolve(workspacePath, token)
    if (!isInsideWorkspace(resolvedToken, workspacePath)) {
      return {
        valid: false,
        reason: `Path "${token}" is outside workspace "${workspacePath}". DEC-025 sandbox violation.`,
        violatingPath: token,
      }
    }
  }
  return { valid: true, reason: 'All paths are inside workspace.' }
}
