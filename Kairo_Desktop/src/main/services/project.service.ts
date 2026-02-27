import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { accessSync, realpathSync, constants } from 'node:fs'
import { resolve, parse } from 'node:path'
import type {
  Project,
  IpcResult,
  CreateProjectResponse,
  LoadProjectResponse,
  ListProjectsResponse,
  AgentMode,
} from '../../shared/types'

interface ProjectRow {
  id: string
  name: string
  folder_path: string
  notebook_id: string | null
  notebook_url: string | null
  model: string
  token_threshold_soft: number
  token_threshold_hard: number
  turn_limit: number
  agent_mode: string
  created_at: string
  updated_at: string
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    folderPath: row.folder_path,
    notebookId: row.notebook_id,
    notebookUrl: row.notebook_url,
    model: row.model,
    tokenThresholdSoft: row.token_threshold_soft,
    tokenThresholdHard: row.token_threshold_hard,
    turnLimit: row.turn_limit,
    agentMode: row.agent_mode as AgentMode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class ProjectService {
  private stmtInsert: Database.Statement
  private stmtSelectById: Database.Statement
  private stmtSelectAll: Database.Statement

  constructor(private db: Database.Database) {
    this.stmtInsert = this.db.prepare(
      "INSERT INTO projects (id, name, folder_path, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))"
    )
    this.stmtSelectById = this.db.prepare('SELECT * FROM projects WHERE id = ?')
    this.stmtSelectAll = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC')
  }

  createProject(name: string, folderPath: string): IpcResult<CreateProjectResponse> {
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      return { success: false, error: 'Project name must be a non-empty string.' }
    }

    const canonicalPath = resolve(folderPath)

    // SECURITY: Reject filesystem root paths — makes entire filesystem writable scope (DEC-025)
    const parsed = parse(canonicalPath)
    if (canonicalPath === parsed.root) {
      return { success: false, error: 'Root path is not allowed as project workspace.' }
    }

    let realPath: string
    try {
      realPath = realpathSync(canonicalPath)
    } catch {
      return { success: false, error: `Folder does not exist or is not accessible: ${canonicalPath}` }
    }

    // SECURITY: Also check the resolved real path (symlink could point to root)
    const parsedReal = parse(realPath)
    if (realPath === parsedReal.root) {
      return { success: false, error: 'Root path is not allowed as project workspace.' }
    }

    try {
      accessSync(realPath, constants.R_OK | constants.W_OK)
    } catch {
      return { success: false, error: `Folder lacks required read/write permissions: ${realPath}` }
    }

    const id = randomUUID()

    try {
      this.stmtInsert.run(id, trimmedName, realPath)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: `A project already exists for folder: ${realPath}` }
      }
      const msg = err instanceof Error ? err.message : 'Database error during project creation'
      return { success: false, error: msg }
    }

    const row = this.stmtSelectById.get(id) as ProjectRow | undefined
    if (!row) {
      return { success: false, error: 'Project created but could not be retrieved.' }
    }

    const project = rowToProject(row)
    console.log(`[KAIRO_PROJECT] Created project "${trimmedName}" (${id}) at ${realPath}`)
    return { success: true, data: { project } }
  }

  listProjects(): IpcResult<ListProjectsResponse> {
    try {
      const rows = this.stmtSelectAll.all() as ProjectRow[]
      const projects = rows.map(rowToProject)
      return { success: true, data: { projects } }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during project listing'
      return { success: false, error: msg }
    }
  }

  loadProject(projectId: string): IpcResult<LoadProjectResponse> {
    if (!projectId || typeof projectId !== 'string') {
      return { success: false, error: 'Project ID must be a non-empty string.' }
    }

    try {
      const row = this.stmtSelectById.get(projectId) as ProjectRow | undefined
      if (!row) {
        return { success: false, error: `Project not found: ${projectId}` }
      }

      const project = rowToProject(row)
      return { success: true, data: { project } }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during project load'
      return { success: false, error: msg }
    }
  }
}
