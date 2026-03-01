/**
 * CodeEditor — Phase 6 Sprint A+D (PRD §6.1, DEC-017)
 *
 * Monaco-based code editor with sandboxed file I/O.
 * Single file at a time, Ctrl+S save, dirty indicator.
 * Phase 6 Sprint D: Diff/Undo panel via Monaco DiffEditor.
 */

// Monaco workers MUST be configured before any monaco-editor import
import '@renderer/lib/monaco-workers'
import * as monaco from 'monaco-editor'
import { useRef, useEffect, useState, useCallback } from 'react'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useEditor } from '@renderer/hooks/useEditor'
import { useProjectStore } from '@renderer/stores/projectStore'

export default function CodeEditor(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const diffContainerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null)
  const [filePathInput, setFilePathInput] = useState('')

  const {
    activeFilePath, content, languageId, isDirty, isSaving, isLoading, error,
    undoAvailable, undoEntry, undoCurrentContent, showDiff, isUndoing,
  } = useEditorStore()
  const activeProject = useProjectStore((s) => s.activeProject)
  const { openFile, saveFile, requestUndoPreview, applyUndo, closeDiff } = useEditor()

  // Track whether we are programmatically updating the model to avoid loops
  const isSettingValueRef = useRef(false)

  // ── Mount Monaco editor ──────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const editor = monaco.editor.create(containerRef.current, {
      value: '',
      language: 'plaintext',
      theme: 'vs-dark',
      automaticLayout: true,
      fontSize: 13,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
    })

    editorRef.current = editor

    // Ctrl+S save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile()
    })

    // Content change listener → update store (only if not programmatic)
    editor.onDidChangeModelContent(() => {
      if (isSettingValueRef.current) return
      const value = editor.getValue()
      useEditorStore.getState().setContent(value)
    })

    return () => {
      editor.dispose()
      editorRef.current = null
    }
  }, []) // Mount once — saveFile is stable via useCallback

  // ── Sync content from store to editor on file change ─────
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    isSettingValueRef.current = true
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, languageId)
      model.setValue(content)
    }
    isSettingValueRef.current = false
  }, [activeFilePath]) // Only when the file changes, NOT on every keystroke

  // ── Mount/update DiffEditor when showDiff + undoEntry ────
  useEffect(() => {
    if (!showDiff || !undoEntry || undoCurrentContent === null) {
      // Cleanup diff editor if it exists
      if (diffEditorRef.current) {
        diffEditorRef.current.dispose()
        diffEditorRef.current = null
      }
      return
    }

    if (!diffContainerRef.current) return

    // Dispose previous diff editor if any
    if (diffEditorRef.current) {
      diffEditorRef.current.dispose()
    }

    const diffEditor = monaco.editor.createDiffEditor(diffContainerRef.current, {
      theme: 'vs-dark',
      automaticLayout: true,
      readOnly: true,
      fontSize: 13,
      renderSideBySide: true,
      scrollBeyondLastLine: false,
    })

    const originalModel = monaco.editor.createModel(undoEntry.oldContent, languageId)
    const modifiedModel = monaco.editor.createModel(undoCurrentContent, languageId)

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    })

    diffEditorRef.current = diffEditor

    return () => {
      diffEditor.dispose()
      originalModel.dispose()
      modifiedModel.dispose()
      diffEditorRef.current = null
    }
  }, [showDiff, undoEntry, undoCurrentContent, languageId])

  // ── Handle open button ───────────────────────────────────
  const handleOpen = useCallback(() => {
    if (filePathInput.trim()) {
      openFile(filePathInput.trim())
    }
  }, [filePathInput, openFile])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleOpen()
      }
    },
    [handleOpen],
  )

  // ── No project guard ─────────────────────────────────────
  if (!activeProject) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#737373',
          fontSize: '13px',
        }}
      >
        <p>Open a project to start editing</p>
      </div>
    )
  }

  // ── Derive display filename ──────────────────────────────
  const fileName = activeFilePath?.split(/[\\/]/).pop() ?? null
  const dirtyMark = isDirty ? ' *' : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          background: '#1e1e1e',
          borderBottom: '1px solid #333',
          fontSize: '12px',
          color: '#ccc',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={filePathInput}
          onChange={(e) => setFilePathInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="File path..."
          style={{
            flex: 1,
            background: '#2d2d2d',
            color: '#ccc',
            border: '1px solid #444',
            borderRadius: '3px',
            padding: '3px 6px',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleOpen}
          disabled={isLoading || !filePathInput.trim()}
          style={{
            background: '#0e639c',
            color: '#fff',
            border: 'none',
            borderRadius: '3px',
            padding: '3px 10px',
            fontSize: '12px',
            cursor: 'pointer',
            opacity: isLoading || !filePathInput.trim() ? 0.5 : 1,
          }}
        >
          Open
        </button>
        {fileName && (
          <span style={{ color: '#e0e0e0', marginLeft: '8px' }}>
            {fileName}
            {dirtyMark}
          </span>
        )}
        {isSaving && (
          <span style={{ color: '#569cd6', marginLeft: '4px' }}>Saving...</span>
        )}
        {isLoading && (
          <span style={{ color: '#569cd6', marginLeft: '4px' }}>Loading...</span>
        )}

        {/* Undo/Diff button (Phase 6 Sprint D) */}
        {undoAvailable && !showDiff && (
          <button
            onClick={requestUndoPreview}
            disabled={isUndoing}
            title="Show diff and undo last save"
            style={{
              background: '#4e4e4e',
              color: '#e0e0e0',
              border: '1px solid #666',
              borderRadius: '3px',
              padding: '3px 8px',
              fontSize: '12px',
              cursor: 'pointer',
              marginLeft: '4px',
            }}
          >
            Diff/Undo
          </button>
        )}
      </div>

      {/* Error bar */}
      {error && (
        <div
          style={{
            padding: '4px 8px',
            background: '#5a1d1d',
            color: '#f48771',
            fontSize: '12px',
            borderBottom: '1px solid #6b2e2e',
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* Diff panel (Phase 6 Sprint D) */}
      {showDiff && undoEntry && (
        <div style={{ flexShrink: 0, borderBottom: '1px solid #444' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 8px',
              background: '#2d2d2d',
              fontSize: '12px',
              color: '#ccc',
            }}
          >
            <span style={{ color: '#569cd6' }}>Diff Preview</span>
            <span style={{ color: '#888' }}>
              (old {'\u2190'} | {'\u2192'} current)
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={applyUndo}
              disabled={isUndoing}
              style={{
                background: '#c24a35',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                padding: '3px 10px',
                fontSize: '12px',
                cursor: isUndoing ? 'not-allowed' : 'pointer',
                opacity: isUndoing ? 0.5 : 1,
              }}
            >
              {isUndoing ? 'Reverting...' : 'Revert to Previous'}
            </button>
            <button
              onClick={closeDiff}
              style={{
                background: 'none',
                color: '#a3a3a3',
                border: '1px solid #555',
                borderRadius: '3px',
                padding: '3px 8px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          <div ref={diffContainerRef} style={{ height: '250px' }} />
        </div>
      )}

      {/* Monaco container */}
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  )
}
