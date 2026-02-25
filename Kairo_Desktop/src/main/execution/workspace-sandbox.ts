import { resolve, normalize } from 'node:path'

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
