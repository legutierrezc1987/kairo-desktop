import type { MemoryProvider } from './memory-provider.interface'
import type { McpProcessService } from './mcp-process.service'
import type {
  MemoryResult,
  IndexResult,
  ProviderHealth,
  MemoryProviderType,
  MemoryProviderStatus,
  McpProcessState,
} from '../../shared/types'
import { MEMORY_QUERY_MAX_RESULTS_DEFAULT } from '../../shared/constants'

const STATE_TO_STATUS: Record<McpProcessState, MemoryProviderStatus> = {
  stopped: 'stopped',
  starting: 'starting',
  running: 'ready',
  crashed: 'degraded',
  failed: 'failed',
}

/**
 * NotebookLmMemoryProvider — DEC-020, DEC-003.
 * Primary memory provider. Delegates to MCP server via JSON-RPC over stdio.
 *
 * SECURITY: No API keys in query/index payloads.
 */
export class NotebookLmMemoryProvider implements MemoryProvider {
  readonly type: MemoryProviderType = 'mcp'
  private mcpService: McpProcessService
  private lastHealth: ProviderHealth

  constructor(mcpService: McpProcessService) {
    this.mcpService = mcpService
    this.lastHealth = {
      provider: 'mcp',
      status: 'stopped',
      lastCheckAt: Date.now(),
    }
  }

  async initialize(): Promise<void> {
    this.lastHealth = { provider: 'mcp', status: 'starting', lastCheckAt: Date.now() }
    try {
      await this.mcpService.start()
      this.lastHealth = { provider: 'mcp', status: 'ready', lastCheckAt: Date.now() }
    } catch (err) {
      this.lastHealth = {
        provider: 'mcp',
        status: 'failed',
        lastCheckAt: Date.now(),
        error: err instanceof Error ? err.message : 'MCP start failed',
      }
      throw err
    }
  }

  async shutdown(): Promise<void> {
    await this.mcpService.stop()
    this.lastHealth = { provider: 'mcp', status: 'stopped', lastCheckAt: Date.now() }
  }

  async query(query: string, maxResults?: number): Promise<MemoryResult[]> {
    const response = await this.mcpService.sendRequest('memory/query', {
      query,
      maxResults: maxResults ?? MEMORY_QUERY_MAX_RESULTS_DEFAULT,
    })

    if (response.error) {
      throw new Error(`[MCP_QUERY] ${response.error.message}`)
    }

    const results = response.result as Array<{
      content: string
      source: string
      relevance: number
      timestamp?: number
    }> | undefined

    if (!Array.isArray(results)) return []

    return results.map(r => ({
      content: r.content,
      source: r.source,
      relevance: r.relevance,
      timestamp: r.timestamp ?? Date.now(),
    }))
  }

  async index(filePath: string): Promise<IndexResult> {
    const response = await this.mcpService.sendRequest('memory/index', {
      filePath,
    })

    if (response.error) {
      return {
        indexed: false,
        filePath,
        chunksIndexed: 0,
        error: response.error.message,
      }
    }

    const result = response.result as { chunksIndexed?: number } | undefined

    return {
      indexed: true,
      filePath,
      chunksIndexed: result?.chunksIndexed ?? 0,
    }
  }

  health(): ProviderHealth {
    const mcpState = this.mcpService.getState()
    this.lastHealth = {
      provider: 'mcp',
      status: STATE_TO_STATUS[mcpState] ?? 'failed',
      lastCheckAt: Date.now(),
    }
    return this.lastHealth
  }
}
