import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import type { MemoryProvider } from './memory-provider.interface'
import type {
  MemoryResult,
  IndexResult,
  ProviderHealth,
  MemoryProviderType,
  DeleteSourceResult,
} from '../../shared/types'
import { MEMORY_QUERY_MAX_RESULTS_DEFAULT } from '../../shared/constants'

interface MarkdownChunk {
  filePath: string
  relativePath: string
  heading: string
  content: string
  lineStart: number
}

/**
 * LocalMarkdownMemoryProvider — DEC-020.
 * Fallback provider. Reads .md files from the project workspace.
 * Keyword-based search — no embeddings, fully deterministic.
 */
export class LocalMarkdownMemoryProvider implements MemoryProvider {
  readonly type: MemoryProviderType = 'local-markdown'
  private workspacePath: string
  private chunks: MarkdownChunk[] = []
  private _initialized = false
  private lastHealth: ProviderHealth

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath
    this.lastHealth = {
      provider: 'local-markdown',
      status: 'stopped',
      lastCheckAt: Date.now(),
    }
  }

  async initialize(): Promise<void> {
    this.lastHealth = { provider: 'local-markdown', status: 'starting', lastCheckAt: Date.now() }
    try {
      this.chunks = this.scanWorkspace()
      this._initialized = true
      this.lastHealth = { provider: 'local-markdown', status: 'ready', lastCheckAt: Date.now() }
    } catch (err) {
      this.lastHealth = {
        provider: 'local-markdown',
        status: 'failed',
        lastCheckAt: Date.now(),
        error: err instanceof Error ? err.message : 'Workspace scan failed',
      }
      throw err
    }
  }

  async shutdown(): Promise<void> {
    this.chunks = []
    this._initialized = false
    this.lastHealth = { provider: 'local-markdown', status: 'stopped', lastCheckAt: Date.now() }
  }

  async query(query: string, maxResults?: number): Promise<MemoryResult[]> {
    if (!this._initialized) return []

    const limit = maxResults ?? MEMORY_QUERY_MAX_RESULTS_DEFAULT
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1)
    if (terms.length === 0) return []

    const scored: Array<{ chunk: MarkdownChunk; score: number }> = []

    for (const chunk of this.chunks) {
      const lowerContent = chunk.content.toLowerCase()
      const lowerHeading = chunk.heading.toLowerCase()

      let score = 0
      for (const term of terms) {
        if (lowerHeading.includes(term)) score += 3
        const contentMatches = lowerContent.split(term).length - 1
        score += contentMatches
      }

      if (score > 0) {
        scored.push({ chunk, score })
      }
    }

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map(({ chunk, score }) => ({
      content: chunk.content,
      source: `${chunk.relativePath}#${chunk.heading}`,
      relevance: Math.min(score / (terms.length * 5), 1.0),
      timestamp: Date.now(),
    }))
  }

  async index(filePath: string): Promise<IndexResult> {
    try {
      const ext = extname(filePath).toLowerCase()
      if (ext !== '.md' && ext !== '.markdown') {
        return { indexed: false, filePath, chunksIndexed: 0, error: 'Only .md files supported by local provider' }
      }

      const content = readFileSync(filePath, 'utf-8')
      const newChunks = this.parseMarkdown(filePath, content)

      this.chunks = this.chunks.filter(c => c.filePath !== filePath)
      this.chunks.push(...newChunks)

      return { indexed: true, filePath, chunksIndexed: newChunks.length }
    } catch (err) {
      return {
        indexed: false,
        filePath,
        chunksIndexed: 0,
        error: err instanceof Error ? err.message : 'Index failed',
      }
    }
  }

  async deleteSource(sourceId: string): Promise<DeleteSourceResult> {
    // Local-markdown has no remote source concept — graceful no-op (Hard Guard #5)
    return { deleted: false, sourceId, error: 'Delete not supported by local provider' }
  }

  health(): ProviderHealth {
    return this.lastHealth
  }

  // ── Private ───────────────────────────────────────────────

  private scanWorkspace(): MarkdownChunk[] {
    const allChunks: MarkdownChunk[] = []
    this.walkDirectory(this.workspacePath, allChunks)
    console.log(`[MEMORY_LOCAL] Indexed ${allChunks.length} chunks from ${this.workspacePath}`)
    return allChunks
  }

  private walkDirectory(dir: string, chunks: MarkdownChunk[], depth = 0): void {
    if (depth > 5) return

    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue

        const fullPath = join(dir, entry)
        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            this.walkDirectory(fullPath, chunks, depth + 1)
          } else if (stat.isFile()) {
            const ext = extname(entry).toLowerCase()
            if (ext === '.md' || ext === '.markdown') {
              const content = readFileSync(fullPath, 'utf-8')
              chunks.push(...this.parseMarkdown(fullPath, content))
            }
          }
        } catch {
          // Permission error or broken symlink — skip
        }
      }
    } catch {
      // Directory unreadable — skip
    }
  }

  private parseMarkdown(filePath: string, content: string): MarkdownChunk[] {
    const relativePath = relative(this.workspacePath, filePath).replace(/\\/g, '/')
    const lines = content.split('\n')
    const chunks: MarkdownChunk[] = []

    let currentHeading = '(top)'
    let currentContent: string[] = []
    let lineStart = 1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)

      if (headingMatch) {
        if (currentContent.length > 0) {
          const text = currentContent.join('\n').trim()
          if (text.length > 0) {
            chunks.push({ filePath, relativePath, heading: currentHeading, content: text, lineStart })
          }
        }
        currentHeading = headingMatch[2].trim()
        currentContent = []
        lineStart = i + 1
      } else {
        currentContent.push(line)
      }
    }

    if (currentContent.length > 0) {
      const text = currentContent.join('\n').trim()
      if (text.length > 0) {
        chunks.push({ filePath, relativePath, heading: currentHeading, content: text, lineStart })
      }
    }

    return chunks
  }
}
