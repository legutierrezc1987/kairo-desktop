import { useCallback } from 'react'
import { useEditorStore } from '@renderer/stores/editorStore'
import { getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { IpcResult, FsReadFileResponse, FsWriteFileResponse, UndoPreviewResponse, UndoApplyResponse } from '@shared/types'

export function useEditor() {
  const { setFile, setLoading, setError, setSaving, markClean, content, activeFilePath } =
    useEditorStore()

  const openFile = useCallback(
    async (filePath: string): Promise<boolean> => {
      const api = getKairoApiOrThrow()
      setError(null)
      setLoading(true)
      try {
        const result = (await api.invoke(
          IPC_CHANNELS.FS_READ_FILE,
          { filePath },
        )) as IpcResult<FsReadFileResponse>

        if (result.success && result.data) {
          setFile(result.data.filePath, result.data.content, result.data.languageId)
          // Check undo availability for the newly opened file
          checkUndoAvailable(result.data.filePath)
          return true
        }
        setError(result.error ?? 'Failed to read file')
        return false
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to read file'
        setError(msg)
        return false
      } finally {
        setLoading(false)
      }
    },
    [setFile, setLoading, setError],
  )

  const saveFile = useCallback(async (): Promise<boolean> => {
    const currentPath = useEditorStore.getState().activeFilePath
    const currentContent = useEditorStore.getState().content
    if (!currentPath) {
      setError('No file open to save')
      return false
    }

    const api = getKairoApiOrThrow()
    setError(null)
    setSaving(true)
    try {
      const result = (await api.invoke(
        IPC_CHANNELS.FS_WRITE_FILE,
        { filePath: currentPath, content: currentContent },
      )) as IpcResult<FsWriteFileResponse>

      if (result.success) {
        markClean()
        // After save, undo becomes available for this file
        useEditorStore.getState().setUndoAvailable(true)
        return true
      }
      setError(result.error ?? 'Failed to save file')
      return false
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to save file'
      setError(msg)
      return false
    } finally {
      setSaving(false)
    }
  }, [setError, setSaving, markClean])

  // ── Undo functions (Phase 6 Sprint D) ─────────────────────

  const requestUndoPreview = useCallback(async (): Promise<boolean> => {
    const currentPath = useEditorStore.getState().activeFilePath
    if (!currentPath) return false

    const api = getKairoApiOrThrow()
    try {
      const result = (await api.invoke(
        IPC_CHANNELS.FS_UNDO_PREVIEW,
        { filePath: currentPath },
      )) as IpcResult<UndoPreviewResponse>

      if (result.success && result.data) {
        useEditorStore.getState().setUndoPreview(result.data.entry, result.data.currentContent)
        return true
      }
      useEditorStore.getState().setError(result.error ?? 'No undo available')
      return false
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Undo preview failed'
      useEditorStore.getState().setError(msg)
      return false
    }
  }, [])

  const applyUndo = useCallback(async (): Promise<boolean> => {
    const entry = useEditorStore.getState().undoEntry
    if (!entry) return false

    const api = getKairoApiOrThrow()
    useEditorStore.getState().setIsUndoing(true)
    try {
      const result = (await api.invoke(
        IPC_CHANNELS.FS_UNDO_APPLY,
        { entryId: entry.id },
      )) as IpcResult<UndoApplyResponse>

      if (result.success && result.data) {
        // Re-read the file to get the restored content into the editor
        const readResult = (await api.invoke(
          IPC_CHANNELS.FS_READ_FILE,
          { filePath: result.data.filePath },
        )) as IpcResult<FsReadFileResponse>

        if (readResult.success && readResult.data) {
          useEditorStore.getState().setFile(
            readResult.data.filePath,
            readResult.data.content,
            readResult.data.languageId,
          )
        }

        useEditorStore.getState().clearUndoPreview()
        // Check if more undo history exists
        checkUndoAvailable(result.data.filePath)
        return true
      }
      useEditorStore.getState().setError(result.error ?? 'Undo failed')
      return false
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Undo failed'
      useEditorStore.getState().setError(msg)
      return false
    } finally {
      useEditorStore.getState().setIsUndoing(false)
    }
  }, [])

  const closeDiff = useCallback(() => {
    useEditorStore.getState().clearUndoPreview()
  }, [])

  return { openFile, saveFile, requestUndoPreview, applyUndo, closeDiff }
}

/** Check undo availability for a file (fire-and-forget) */
function checkUndoAvailable(filePath: string): void {
  try {
    const api = getKairoApiOrThrow()
    api.invoke(IPC_CHANNELS.FS_UNDO_PREVIEW, { filePath }).then((result: unknown) => {
      const r = result as IpcResult<UndoPreviewResponse>
      useEditorStore.getState().setUndoAvailable(r.success === true)
    }).catch(() => {
      useEditorStore.getState().setUndoAvailable(false)
    })
  } catch {
    useEditorStore.getState().setUndoAvailable(false)
  }
}
