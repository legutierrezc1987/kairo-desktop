import { useState, useCallback } from 'react'
import { useProjectStore } from '@renderer/stores/projectStore'
import { getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { IpcResult, MemoryQueryResponse, MemoryResult } from '@shared/types'

export default function RecallButton(): React.JSX.Element | null {
  const activeProject = useProjectStore((s) => s.activeProject)
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemoryResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setIsSearching(true)
    setError(null)
    try {
      const result = (await getKairoApiOrThrow().invoke(
        IPC_CHANNELS.MEMORY_QUERY,
        { query: query.trim(), maxResults: 3 }
      )) as IpcResult<MemoryQueryResponse>

      if (result.success && result.data) {
        setResults(result.data.results)
      } else {
        setError(result.error ?? 'Memory query failed')
        setResults([])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Memory query failed'
      setError(msg)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [query])

  // Only show when a project is active
  if (!activeProject) return null

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          background: 'none', border: '1px solid #404040', borderRadius: '4px',
          color: '#a3a3a3', cursor: 'pointer', fontSize: '12px', padding: '4px 8px',
        }}
        title="Search memory"
      >
        Recall
      </button>
    )
  }

  return (
    <div style={{
      position: 'absolute', bottom: '60px', right: '12px', zIndex: 100,
      backgroundColor: '#1a1a1a', border: '1px solid #404040', borderRadius: '8px',
      padding: '12px', width: '320px', maxHeight: '300px', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#e5e5e5' }}>Memory Recall</span>
        <button
          onClick={() => { setIsOpen(false); setResults([]); setQuery(''); setError(null) }}
          style={{ background: 'none', border: 'none', color: '#a3a3a3', cursor: 'pointer', fontSize: '14px' }}
        >
          {'\u00d7'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <input
          type="text"
          placeholder="Search memory..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
          style={{
            flex: 1, padding: '4px 8px',
            backgroundColor: '#262626', border: '1px solid #404040', borderRadius: '4px',
            color: '#e5e5e5', fontSize: '12px',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          style={{
            padding: '4px 8px', backgroundColor: '#3b82f6', border: 'none',
            borderRadius: '4px', color: '#fff', fontSize: '12px', cursor: 'pointer',
            opacity: (isSearching || !query.trim()) ? 0.5 : 1,
          }}
        >
          {isSearching ? '...' : 'Go'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#fca5a5', fontSize: '11px', marginBottom: '6px' }}>{error}</div>
      )}

      {results.length === 0 && !isSearching && !error && query.trim() && (
        <p style={{ color: '#737373', fontSize: '11px', fontStyle: 'italic', margin: 0 }}>No results</p>
      )}

      {results.map((item, idx) => (
        <div key={idx} style={{
          padding: '6px 8px', marginBottom: '4px', borderRadius: '4px',
          backgroundColor: '#262626', fontSize: '11px', color: '#d4d4d4',
        }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.content.slice(0, 120)}
          </div>
          <div style={{ color: '#737373', fontSize: '10px', marginTop: '2px' }}>
            {item.source} | {Math.round(item.relevance * 100)}%
          </div>
        </div>
      ))}
    </div>
  )
}
