import type {
  MemoryResult,
  IndexResult,
  ProviderHealth,
  MemoryProviderType,
  DeleteSourceResult,
} from '../../shared/types'

/**
 * MemoryProvider — DEC-020.
 * Pluggable interface for memory query, indexing, and health.
 * Implementations: NotebookLmMemoryProvider (MCP), LocalMarkdownMemoryProvider (fallback).
 */
export interface MemoryProvider {
  readonly type: MemoryProviderType

  query(query: string, maxResults?: number): Promise<MemoryResult[]>

  index(filePath: string): Promise<IndexResult>

  health(): ProviderHealth

  initialize(): Promise<void>

  shutdown(): Promise<void>

  /**
   * Delete a source from the remote memory provider (DEC-022 consolidation).
   * Optional: local-markdown returns graceful no-op; only MCP provider deletes.
   */
  deleteSource?(sourceId: string): Promise<DeleteSourceResult>
}
