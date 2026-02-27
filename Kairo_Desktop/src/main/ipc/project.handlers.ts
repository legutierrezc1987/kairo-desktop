import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { CreateProjectRequest, LoadProjectRequest } from '../../shared/types'
import type { ProjectService } from '../services/project.service'
import { validateSender } from './validate-sender'

function isValidCreateProjectRequest(data: unknown): data is CreateProjectRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.name === 'string' &&
    obj.name.trim().length > 0 &&
    typeof obj.folderPath === 'string' &&
    obj.folderPath.length > 0
  )
}

function isValidLoadProjectRequest(data: unknown): data is LoadProjectRequest {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return typeof obj.projectId === 'string' && obj.projectId.length > 0
}

export function registerProjectHandlers(
  projectService: ProjectService,
  onProjectLoaded?: (projectId: string, folderPath: string) => void,
): void {
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidCreateProjectRequest(data)) {
      return { success: false, error: 'Invalid create project request: name and folderPath required.' }
    }
    return projectService.createProject(data.name, data.folderPath)
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, (event) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    return projectService.listProjects()
  })

  ipcMain.handle(IPC_CHANNELS.PROJECT_LOAD, (event, data: unknown) => {
    try {
      validateSender(event)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sender validation failed'
      return { success: false, error: msg }
    }
    if (!isValidLoadProjectRequest(data)) {
      return { success: false, error: 'Invalid load project request: projectId required.' }
    }
    const result = projectService.loadProject(data.projectId)
    if (result.success && result.data) {
      onProjectLoaded?.(data.projectId, result.data.project.folderPath)
    }
    return result
  })
}
