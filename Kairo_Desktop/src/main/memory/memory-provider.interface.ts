import type {
  MemoryResult,
  IndexResult,
  ProviderHealth,
  MemoryProviderType,
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
}
