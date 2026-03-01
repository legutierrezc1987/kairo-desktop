/**
 * FileExplorer — Phase 6 Sprint B (PRD §6.2)
 *
 * Lazy-loaded file tree with expand/collapse.
 * Click file → opens in Monaco via useEditor().openFile().
 */

import { useCallback } from 'react'
import { useFileExplorer } from '@renderer/hooks/useFileExplorer'
import { useEditor } from '@renderer/hooks/useEditor'
import { useProjectStore } from '@renderer/stores/projectStore'
import type { FsDirEntry } from '@shared/types'

export default function FileExplorer(): React.JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)
  const { entries, expandedPaths, isLoading, error, toggleExpand, refresh } = useFileExplorer()
  const { openFile } = useEditor()

  if (!activeProject) {
    return (
      <div style={{ padding: '12px', fontSize: '13px', color: '#a3a3a3' }}>
        <h3 style={headerStyle}>Files</h3>
        <p style={{ fontStyle: 'italic' }}>No project open</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px 4px',
        flexShrink: 0,
      }}>
        <h3 style={headerStyle}>Files</h3>
        <button
          onClick={refresh}
          disabled={isLoading}
          title="Refresh file tree"
          style={{
            background: 'none',
            border: 'none',
            color: '#737373',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '0 2px',
            opacity: isLoading ? 0.4 : 1,
          }}
        >
          &#x21BB;
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '4px 12px',
          color: '#f48771',
          fontSize: '11px',
          flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && entries.length === 0 && (
        <div style={{ padding: '8px 12px', color: '#569cd6', fontSize: '12px' }}>
          Loading...
        </div>
      )}

      {/* Tree */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0 4px 8px',
      }}>
        {entries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            expandedPaths={expandedPaths}
            onToggle={toggleExpand}
            onFileClick={openFile}
          />
        ))}
      </div>
    </div>
  )
}

// ── Tree Node ──────────────────────────────────────────────

interface TreeNodeProps {
  entry: FsDirEntry
  depth: number
  expandedPaths: Set<string>
  onToggle: (entry: FsDirEntry) => void
  onFileClick: (filePath: string) => void
}

function TreeNode({ entry, depth, expandedPaths, onToggle, onFileClick }: TreeNodeProps): React.JSX.Element {
  const isExpanded = expandedPaths.has(entry.path)
  const indent = 12 + depth * 16

  const handleClick = useCallback(() => {
    if (entry.isDirectory) {
      onToggle(entry)
    } else {
      onFileClick(entry.path)
    }
  }, [entry, onToggle, onFileClick])

  return (
    <>
      <div
        onClick={handleClick}
        title={entry.path}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '2px 4px',
          paddingLeft: `${indent}px`,
          cursor: 'pointer',
          fontSize: '12px',
          color: entry.isDirectory ? '#c5c5c5' : '#a3a3a3',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderRadius: '3px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#2a2d2e' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        {/* Icon */}
        <span style={{ marginRight: '4px', fontSize: '10px', width: '12px', textAlign: 'center', flexShrink: 0 }}>
          {entry.isDirectory ? (isExpanded ? '\u25BE' : '\u25B8') : '\u00B7'}
        </span>
        {/* Name */}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.name}
        </span>
      </div>
      {/* Children (expanded directories) */}
      {entry.isDirectory && isExpanded && entry.children && entry.children.map((child) => (
        <TreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          expandedPaths={expandedPaths}
          onToggle={onToggle}
          onFileClick={onFileClick}
        />
      ))}
    </>
  )
}

const headerStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#737373',
  margin: 0,
}
