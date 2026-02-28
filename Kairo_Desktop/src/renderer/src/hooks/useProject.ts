import { useEffect, useCallback } from 'react'
import { useProjectStore } from '@renderer/stores/projectStore'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  IpcResult,
  ListProjectsResponse,
  CreateProjectResponse,
  LoadProjectResponse,
  SelectFolderResponse,
} from '@shared/types'

export function useProject() {
  const {
    setProjects,
    setActiveProject,
    setLoading,
    setError,
    addProject,
  } = useProjectStore()

  // Fetch project list on mount
  useEffect(() => {
    if (!hasKairoApi()) return
    setLoading(true)
    getKairoApiOrThrow()
      .invoke(IPC_CHANNELS.PROJECT_LIST)
      .then((result) => {
        const res = result as IpcResult<ListProjectsResponse>
        if (res.success && res.data) {
          setProjects(res.data.projects)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [setProjects, setLoading])

  const createProject = useCallback(
    async (name: string, folderPath: string): Promise<boolean> => {
      const api = getKairoApiOrThrow()
      setError(null)
      setLoading(true)
      try {
        const result = (await api.invoke(
          IPC_CHANNELS.PROJECT_CREATE,
          { name, folderPath }
        )) as IpcResult<CreateProjectResponse>

        if (result.success && result.data) {
          addProject(result.data.project)
          setActiveProject(result.data.project)
          return true
        }
        setError(result.error ?? 'Failed to create project')
        return false
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to create project'
        setError(msg)
        return false
      } finally {
        setLoading(false)
      }
    },
    [addProject, setActiveProject, setError, setLoading]
  )

  const loadProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      const api = getKairoApiOrThrow()
      setError(null)
      setLoading(true)
      try {
        const result = (await api.invoke(
          IPC_CHANNELS.PROJECT_LOAD,
          { projectId }
        )) as IpcResult<LoadProjectResponse>

        if (result.success && result.data) {
          setActiveProject(result.data.project)
          return true
        }
        setError(result.error ?? 'Failed to load project')
        return false
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to load project'
        setError(msg)
        return false
      } finally {
        setLoading(false)
      }
    },
    [setActiveProject, setError, setLoading]
  )

  const selectFolder = useCallback(async (): Promise<string | null> => {
    try {
      const api = getKairoApiOrThrow()
      const result = (await api.invoke(
        IPC_CHANNELS.APP_SELECT_FOLDER
      )) as IpcResult<SelectFolderResponse>
      if (result.success && result.data) {
        return result.data.folderPath
      }
      return null
    } catch {
      return null
    }
  }, [])

  return { createProject, loadProject, selectFolder }
}
