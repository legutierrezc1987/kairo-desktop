import { resolve, normalize, relative, parse, sep, isAbsolute } from 'node:path'
import type { MemoryProvider } from './memory-provider.interface'
import { McpProcessService } from './mcp-process.service'
import { NotebookLmMemoryProvider } from './notebooklm.provider'
import { LocalMarkdownMemoryProvider } from './local-markdown.provider'
import type {
  IpcResult,
  MemoryProviderType,
  MemoryProviderChangedNotification,
  MemoryQueryResponse,
  MemoryIndexResponse,
  MemoryHealthResponse,
} from '../../shared/types'
import {
  MEMORY_QUERY_MAX_RESULTS_DEFAULT,
  MEMORY_QUERY_MAX_LENGTH,
  MEMORY_MAX_RESULTS_MIN,
  MEMORY_MAX_RESULTS_MAX,
} from '../../shared/constants'

export interface MemoryServiceOptions {
  mcpServerPath?: string
  mcpServerArgs?: string[]
  workspacePath: string
}

/**
 * MemoryService — DEC-020.
 * Orchestrates MemoryProvider selection and automatic fallback.
 *
 * Strategy:
 * 1. If mcpServerPath configured → try MCP provider
 * 2. If MCP fails to start or crashes → auto-fallback to LocalMarkdown
 * 3. Provider switch emits notification for UI
 *
 * SECURITY (Phase 4 Sprint A Hardening):
 * - Workspace binding follows active project folderPath, not process.cwd()
 * - memory:index rejects filePaths outside the active workspace
 * - query string and maxResults have strict payload limits
 */
export class MemoryService {
  private activeProvider: MemoryProvider | null = null
  private fallbackProvider: LocalMarkdownMemoryProvider
  private mcpProvider: NotebookLmMemoryProvider | null = null
  private mcpService: McpProcessService | null = null
  private workspacePath: string

  private onProviderChanged: ((notification: MemoryProviderChangedNotification) => void) | null = null

  constructor(options: MemoryServiceOptions) {
    this.workspacePath = options.workspacePath
    this.fallbackProvider = new LocalMarkdownMemoryProvider(options.workspacePath)

    if (options.mcpServerPath) {
      this.mcpService = new McpProcessService(options.mcpServerPath, options.mcpServerArgs)
      this.mcpProvider = new NotebookLmMemoryProvider(this.mcpService)

      this.mcpService.setOnCrash(() => {
        console.warn('[MEMORY] MCP crashed — switching to local fallback')
        this.switchToFallback('MCP process crashed')
      })

      this.mcpService.setOnStateChanged((state) => {
        if (state === 'failed') {
          console.error('[MEMORY] MCP failed — switching to local fallback')
          this.switchToFallback('MCP process failed after max restart attempts')
        }
      })
    }
  }

  setOnProviderChanged(cb: (notification: MemoryProviderChangedNotification) => void): void {
    this.onProviderChanged = cb
  }

  async initialize(): Promise<void> {
    if (this.mcpProvider) {
      try {
        await this.mcpProvider.initialize()
        this.activeProvider = this.mcpProvider
        console.log('[MEMORY] MCP provider active')
        return
      } catch (err) {
        console.warn(`[MEMORY] MCP failed to start: ${err instanceof Error ? err.message : String(err)}`)
        console.warn('[MEMORY] Falling back to local markdown provider')
      }
    }

    await this.fallbackProvider.initialize()
    this.activeProvider = this.fallbackProvider
    console.log('[MEMORY] Local markdown provider active (fallback)')
  }

  async shutdown(): Promise<void> {
    if (this.mcpProvider) {
      try { await this.mcpProvider.shutdown() } catch { /* best effort */ }
    }
    try { await this.fallbackProvider.shutdown() } catch { /* best effort */ }
    this.activeProvider = null
  }

  // ── Workspace Binding (Phase 4 Hardening) ──────────────────

  /**
   * Update the effective workspace path when the active project changes.
   *
   * SECURITY: Guarantees zero cross-project leakage:
   * - If MCP was active → force degradation to local-markdown (MCP has no
   *   workspace-rebind protocol; keeping it active would leak prior project context).
   * - Fallback provider is always re-created scoped to new workspace.
   * - Provider-changed notification emitted when MCP is degraded.
   */
  async updateWorkspace(newWorkspacePath: string): Promise<void> {
    // SECURITY: Reject filesystem root paths — makes entire filesystem indexable (DEC-025)
    const resolvedNew = resolve(newWorkspacePath)
    const parsedNew = parse(resolvedNew)
    if (resolvedNew === parsedNew.root) {
      throw new Error('Root path is not allowed as workspace. DEC-025 sandbox violation.')
    }

    const previous = this.workspacePath
    this.workspacePath = newWorkspacePath

    // SECURITY: If MCP was active, force degradation — MCP context is stale
    if (this.activeProvider?.type === 'mcp') {
      console.warn('[MEMORY] MCP active during workspace change — forcing degradation to local-markdown (zero cross-project leakage)')
      // Stop MCP process to prevent stale context queries
      if (this.mcpService) {
        try { await this.mcpService.stop() } catch { /* best effort */ }
      }
      this.mcpProvider = null
      this.mcpService = null
    }

    // Re-create fallback provider scoped to new workspace
    try { await this.fallbackProvider.shutdown() } catch { /* best effort */ }
    this.fallbackProvider = new LocalMarkdownMemoryProvider(newWorkspacePath)
    await this.fallbackProvider.initialize()
    const previousType = this.activeProvider?.type ?? 'local-markdown'
    this.activeProvider = this.fallbackProvider

    // Emit notification if provider changed
    if (previousType === 'mcp') {
      const notification: MemoryProviderChangedNotification = {
        previousProvider: 'mcp',
        currentProvider: 'local-markdown',
        reason: 'Workspace changed — MCP degraded for project isolation',
        timestamp: Date.now(),
      }
      this.onProviderChanged?.(notification)
    }

    console.log(`[MEMORY] Workspace updated: ${previous} → ${newWorkspacePath}`)
  }

  /** Current effective workspace path (for testing / diagnostics) */
  getWorkspacePath(): string {
    return this.workspacePath
  }

  // ── Public API (for IPC handlers) ─────────────────────────

  async query(query: string, maxResults?: number): Promise<IpcResult<MemoryQueryResponse>> {
    const provider = this.activeProvider
    if (!provider) {
      return { success: false, error: 'Memory service not initialized' }
    }

    // ── Payload validation (Phase 4 Hardening) ──
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return { success: false, error: 'Query must be a non-empty string.' }
    }
    if (query.length > MEMORY_QUERY_MAX_LENGTH) {
      return { success: false, error: `Query exceeds maximum length (${MEMORY_QUERY_MAX_LENGTH} chars).` }
    }

    const effectiveMaxResults = this.sanitizeMaxResults(maxResults)

    try {
      const results = await provider.query(query, effectiveMaxResults)
      return {
        success: true,
        data: { results, provider: provider.type },
      }
    } catch (err) {
      if (provider.type === 'mcp') {
        return this.queryWithFallback(query, effectiveMaxResults, err)
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Query failed',
      }
    }
  }

  async index(filePath: string): Promise<IpcResult<MemoryIndexResponse>> {
    const provider = this.activeProvider
    if (!provider) {
      return { success: false, error: 'Memory service not initialized' }
    }

    // ── Sandbox validation (Phase 4 Hardening — CRITICAL) ──
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'filePath must be a non-empty string.' }
    }

    if (!this.isInsideWorkspace(filePath)) {
      return {
        success: false,
        error: `Indexing rejected: path is outside the active workspace. DEC-025 sandbox violation.`,
      }
    }

    try {
      const result = await provider.index(filePath)
      return {
        success: true,
        data: { result, provider: provider.type },
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Index failed',
      }
    }
  }

  getHealth(): IpcResult<MemoryHealthResponse> {
    const provider = this.activeProvider
    if (!provider) {
      return {
        success: true,
        data: {
          health: { provider: 'local-markdown', status: 'stopped', lastCheckAt: Date.now() },
          activeProvider: 'local-markdown',
          fallbackAvailable: true,
        },
      }
    }

    return {
      success: true,
      data: {
        health: provider.health(),
        activeProvider: provider.type,
        fallbackAvailable: true,
      },
    }
  }

  getActiveProviderType(): MemoryProviderType {
    return this.activeProvider?.type ?? 'local-markdown'
  }

  /** Expose the active provider for consolidation deleteSource delegation (Phase 5 Sprint B). */
  getActiveProvider(): MemoryProvider | null {
    return this.activeProvider
  }

  // ── Private ───────────────────────────────────────────────

  /**
   * SECURITY: Validate that a path is strictly inside the current workspace.
   *
   * Uses relative() to compute the relationship between target and workspace.
   * This prevents the sibling-prefix attack where:
   *   workspace = /projects/my-app
   *   target    = /projects/my-app-evil/secrets.md
   *   startsWith would return TRUE (bypass!)
   *
   * The relative() approach checks:
   * 1. The relative path does NOT start with '..' (escape)
   * 2. The relative path is NOT an absolute path (cross-drive on Windows)
   * 3. The path separator ensures exact directory boundary matching
   */
  private isInsideWorkspace(targetPath: string): boolean {
    const resolvedTarget = normalize(resolve(targetPath))
    const resolvedWorkspace = normalize(resolve(this.workspacePath))

    // Exact match (target IS the workspace dir)
    const targetLower = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget
    const workspaceLower = process.platform === 'win32' ? resolvedWorkspace.toLowerCase() : resolvedWorkspace
    if (targetLower === workspaceLower) return true

    // Compute the relative path from workspace to target
    const rel = relative(resolvedWorkspace, resolvedTarget)

    // If relative path starts with '..', target is outside workspace
    if (rel.startsWith('..')) return false

    // If relative path is absolute, target is on a different drive (Windows)
    if (isAbsolute(rel)) return false

    // If relative path is empty, it's the same directory (already handled above)
    if (rel.length === 0) return true

    // Final check: ensure the first component after workspace is a proper child.
    // On Windows, relative() handles the separator correctly, but verify
    // by checking the resolved target starts with workspace + separator.
    const wsPrefix = workspaceLower.endsWith(sep) ? workspaceLower : workspaceLower + sep
    if (!targetLower.startsWith(wsPrefix)) return false

    return true
  }

  /**
   * Sanitize maxResults to a safe integer within allowed bounds.
   * Returns the default if the input is invalid.
   */
  private sanitizeMaxResults(maxResults: number | undefined): number {
    if (maxResults === undefined || maxResults === null) {
      return MEMORY_QUERY_MAX_RESULTS_DEFAULT
    }
    if (typeof maxResults !== 'number' || !Number.isFinite(maxResults)) {
      return MEMORY_QUERY_MAX_RESULTS_DEFAULT
    }
    const clamped = Math.floor(maxResults)
    if (clamped < MEMORY_MAX_RESULTS_MIN) return MEMORY_MAX_RESULTS_MIN
    if (clamped > MEMORY_MAX_RESULTS_MAX) return MEMORY_MAX_RESULTS_MAX
    return clamped
  }

  private async queryWithFallback(
    query: string,
    maxResults: number,
    originalError: unknown,
  ): Promise<IpcResult<MemoryQueryResponse>> {
    console.warn(`[MEMORY] MCP query failed, switching to fallback: ${originalError instanceof Error ? originalError.message : String(originalError)}`)
    await this.switchToFallback('MCP query failed')

    try {
      const results = await this.fallbackProvider.query(query, maxResults)
      return {
        success: true,
        data: { results, provider: 'local-markdown' },
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Fallback query failed',
      }
    }
  }

  private async switchToFallback(reason: string): Promise<void> {
    const previousType = this.activeProvider?.type ?? 'mcp'
    if (previousType === 'local-markdown') return

    if (this.fallbackProvider.health().status !== 'ready') {
      try {
        await this.fallbackProvider.initialize()
      } catch (err) {
        console.error(`[MEMORY] Fallback initialization failed: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    }

    this.activeProvider = this.fallbackProvider

    const notification: MemoryProviderChangedNotification = {
      previousProvider: previousType,
      currentProvider: 'local-markdown',
      reason,
      timestamp: Date.now(),
    }
    this.onProviderChanged?.(notification)
  }
}
