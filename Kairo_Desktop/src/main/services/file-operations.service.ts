/**
 * FileOperationsService — Phase 6 Sprint A (PRD §6.1)
 *
 * Sandboxed file read/write operations for Monaco editor integration.
 * All paths are validated against the active project workspace (DEC-025).
 *
 * Security constraints:
 *   - Robust isInsideWorkspace() — same algorithm as MemoryService (relative + isAbsolute + wsPrefix + sep)
 *   - Null-byte rejection in paths
 *   - Root path rejection (C:\, D:\, /)
 *   - Binary file detection (first 8KB scanned for \0)
 *   - 5MB file size limit
 *   - No mkdir on write (parent must exist)
 */

import { resolve, normalize, relative, parse, sep, isAbsolute, extname, join } from 'node:path'
import { stat, readFile, writeFile, readdir } from 'node:fs/promises'
import type { IpcResult, FsReadFileResponse, FsWriteFileResponse, FsListDirResponse, FsDirEntry } from '../../shared/types'
import { FS_READ_FILE_MAX_BYTES, FS_BINARY_DETECTION_BYTES, FS_LIST_DIR_MAX_DEPTH, FS_LIST_DIR_MAX_ENTRIES, FS_LIST_DIR_EXCLUDED } from '../../shared/constants'

export class FileOperationsService {
  private workspacePath: string | null = null

  /** Called on project load to bind file operations to the active workspace. */
  setWorkspacePath(path: string): void {
    const resolved = resolve(path)
    const parsed = parse(resolved)
    if (resolved === parsed.root) {
      throw new Error('Root path is not allowed as workspace. DEC-025 sandbox violation.')
    }
    this.workspacePath = path
  }

  getWorkspacePath(): string | null {
    return this.workspacePath
  }

  // ── Read File ─────────────────────────────────────────────

  async readFile(filePath: string): Promise<IpcResult<FsReadFileResponse>> {
    const validation = this.validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const resolvedPath = resolve(filePath)

    try {
      const fileStat = await stat(resolvedPath)
      if (!fileStat.isFile()) {
        return { success: false, error: 'Path is not a regular file.' }
      }
      if (fileStat.size > FS_READ_FILE_MAX_BYTES) {
        return {
          success: false,
          error: `File exceeds maximum size (${FS_READ_FILE_MAX_BYTES} bytes). Size: ${fileStat.size} bytes.`,
        }
      }

      // Binary detection: read first N bytes and scan for null bytes
      const buffer = await readFile(resolvedPath)
      const detectionSlice = buffer.subarray(0, FS_BINARY_DETECTION_BYTES)
      if (detectionSlice.includes(0)) {
        return { success: false, error: 'Binary files are not supported.' }
      }

      const content = buffer.toString('utf-8')
      const languageId = detectLanguage(filePath)

      return {
        success: true,
        data: {
          content,
          filePath: resolvedPath,
          sizeBytes: fileStat.size,
          languageId,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Read failed'
      if (message.includes('ENOENT')) {
        return { success: false, error: 'File not found.' }
      }
      if (message.includes('EACCES')) {
        return { success: false, error: 'Permission denied.' }
      }
      return { success: false, error: message }
    }
  }

  // ── Write File ────────────────────────────────────────────

  async writeFile(filePath: string, content: string): Promise<IpcResult<FsWriteFileResponse>> {
    const validation = this.validatePath(filePath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    if (typeof content !== 'string') {
      return { success: false, error: 'Content must be a string.' }
    }

    const resolvedPath = resolve(filePath)

    try {
      // No mkdir — parent must already exist (security: prevent directory traversal + creation)
      await writeFile(resolvedPath, content, 'utf-8')
      const bytesWritten = Buffer.byteLength(content, 'utf-8')

      return {
        success: true,
        data: {
          filePath: resolvedPath,
          bytesWritten,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Write failed'
      if (message.includes('ENOENT')) {
        return { success: false, error: 'Parent directory does not exist.' }
      }
      if (message.includes('EACCES')) {
        return { success: false, error: 'Permission denied.' }
      }
      return { success: false, error: message }
    }
  }

  // ── List Directory (Phase 6 Sprint B, PRD §6.2) ──────────

  async listDir(dirPath: string, depth: number = 1): Promise<IpcResult<FsListDirResponse>> {
    const validation = this.validatePath(dirPath)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const clampedDepth = Math.max(1, Math.min(depth, FS_LIST_DIR_MAX_DEPTH))
    const resolvedDir = resolve(dirPath)

    try {
      const dirStat = await stat(resolvedDir)
      if (!dirStat.isDirectory()) {
        return { success: false, error: 'Path is not a directory.' }
      }

      let entryCount = 0
      let truncated = false

      const walk = async (currentPath: string, currentDepth: number): Promise<FsDirEntry[]> => {
        if (truncated) return []

        let dirents
        try {
          dirents = await readdir(currentPath, { withFileTypes: true })
        } catch {
          return []
        }

        // Sort: directories first, then alphabetical (case-insensitive)
        dirents.sort((a, b) => {
          const aDir = a.isDirectory() ? 0 : 1
          const bDir = b.isDirectory() ? 0 : 1
          if (aDir !== bDir) return aDir - bDir
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        })

        const entries: FsDirEntry[] = []

        for (const dirent of dirents) {
          if (truncated) break

          // Skip excluded directories
          if (dirent.isDirectory() && FS_LIST_DIR_EXCLUDED.includes(dirent.name)) {
            continue
          }

          // Skip hidden files/dirs (starting with .) except exclusion already handled above
          if (dirent.name.startsWith('.') && dirent.isDirectory()) {
            continue
          }

          entryCount++
          if (entryCount > FS_LIST_DIR_MAX_ENTRIES) {
            truncated = true
            break
          }

          const entryPath = join(currentPath, dirent.name)
          const isDir = dirent.isDirectory()

          const entry: FsDirEntry = {
            name: dirent.name,
            path: entryPath,
            isDirectory: isDir,
          }

          if (!isDir) {
            try {
              const fileStat = await stat(entryPath)
              entry.sizeBytes = fileStat.size
            } catch {
              // Permission error or race condition — omit size
            }
          }

          // Recurse into subdirectories if depth allows
          if (isDir && currentDepth < clampedDepth) {
            entry.children = await walk(entryPath, currentDepth + 1)
          }

          entries.push(entry)
        }

        return entries
      }

      const entries = await walk(resolvedDir, 1)

      return {
        success: true,
        data: {
          entries,
          dirPath: resolvedDir,
          truncated,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'List directory failed'
      if (message.includes('ENOENT')) {
        return { success: false, error: 'Directory not found.' }
      }
      if (message.includes('EACCES')) {
        return { success: false, error: 'Permission denied.' }
      }
      return { success: false, error: message }
    }
  }

  // ── Path Validation ───────────────────────────────────────

  private validatePath(filePath: string): { valid: true } | { valid: false; error: string } {
    if (!this.workspacePath) {
      return { valid: false, error: 'No workspace configured. Open a project first.' }
    }
    if (!filePath || typeof filePath !== 'string' || filePath.trim().length === 0) {
      return { valid: false, error: 'filePath must be a non-empty string.' }
    }
    if (filePath.includes('\0')) {
      return { valid: false, error: 'filePath contains null bytes. Rejected.' }
    }
    if (!this.isInsideWorkspace(filePath)) {
      return { valid: false, error: 'Path is outside the active workspace. DEC-025 sandbox violation.' }
    }
    return { valid: true }
  }

  /**
   * SECURITY: Validate that a path is strictly inside the current workspace.
   *
   * Same robust algorithm as MemoryService.isInsideWorkspace():
   * - relative() to compute relationship between target and workspace
   * - Prevents sibling-prefix attack (/my-app vs /my-app-evil)
   * - Handles cross-drive detection on Windows (isAbsolute check)
   * - Case-insensitive comparison on Windows
   */
  isInsideWorkspace(targetPath: string): boolean {
    if (!this.workspacePath) return false

    const resolvedTarget = normalize(resolve(targetPath))
    const resolvedWorkspace = normalize(resolve(this.workspacePath))

    const targetLower = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget
    const workspaceLower = process.platform === 'win32' ? resolvedWorkspace.toLowerCase() : resolvedWorkspace

    // Exact match (target IS the workspace dir)
    if (targetLower === workspaceLower) return true

    // Compute relative path from workspace to target
    const rel = relative(resolvedWorkspace, resolvedTarget)

    // If relative path starts with '..', target is outside workspace
    if (rel.startsWith('..')) return false

    // If relative path is absolute, target is on a different drive (Windows)
    if (isAbsolute(rel)) return false

    // If relative path is empty, it's the same directory
    if (rel.length === 0) return true

    // Final check: ensure proper child via wsPrefix + sep
    const wsPrefix = workspaceLower.endsWith(sep) ? workspaceLower : workspaceLower + sep
    if (!targetLower.startsWith(wsPrefix)) return false

    return true
  }
}

// ── Language Detection ──────────────────────────────────────

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.jsonc': 'json',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.sql': 'sql',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'ini',
  '.ini': 'ini',
  '.xml': 'xml',
  '.svg': 'xml',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.dockerfile': 'dockerfile',
  '.bat': 'bat',
  '.cmd': 'bat',
  '.lua': 'lua',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.r': 'r',
}

/** Detect Monaco language ID from file extension. Defaults to 'plaintext'. */
export function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  // Special case: Dockerfile without extension
  const base = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? ''
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) return 'dockerfile'
  return EXTENSION_TO_LANGUAGE[ext] ?? 'plaintext'
}
