import { useCallback } from 'react'
import { useEditorStore } from '@renderer/stores/editorStore'
import { getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { IpcResult, FsReadFileResponse, FsWriteFileResponse } from '@shared/types'

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

  return { openFile, saveFile }
}
