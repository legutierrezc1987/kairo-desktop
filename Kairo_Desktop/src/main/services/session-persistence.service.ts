import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type {
  SessionRecord,
  SessionStatus,
  CutReason,
  IpcResult,
  CreateSessionResponse,
  GetActiveSessionResponse,
} from '../../shared/types'

interface SessionRow {
  id: string
  project_id: string
  session_number: number
  total_tokens: number
  interaction_count: number
  cut_reason: string | null
  status: string
  transcript_path: string | null
  summary_path: string | null
  started_at: string
  ended_at: string | null
}

function rowToSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    sessionNumber: row.session_number,
    totalTokens: row.total_tokens,
    interactionCount: row.interaction_count,
    cutReason: row.cut_reason as CutReason | null,
    status: row.status as SessionStatus,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

export class SessionPersistenceService {
  private stmtInsert: Database.Statement
  private stmtSelectById: Database.Statement
  private stmtSelectActive: Database.Statement
  private stmtCountByProject: Database.Statement
  private stmtAddTokens: Database.Statement
  private stmtArchive: Database.Statement
  private stmtUpdatePaths: Database.Statement

  constructor(private db: Database.Database) {
    this.stmtInsert = this.db.prepare(
      "INSERT INTO sessions (id, project_id, session_number, status, started_at) VALUES (?, ?, ?, 'active', datetime('now'))"
    )
    this.stmtSelectById = this.db.prepare('SELECT * FROM sessions WHERE id = ?')
    this.stmtSelectActive = this.db.prepare(
      "SELECT * FROM sessions WHERE project_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1"
    )
    this.stmtCountByProject = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM sessions WHERE project_id = ?'
    )
    this.stmtAddTokens = this.db.prepare(
      'UPDATE sessions SET total_tokens = total_tokens + ?, interaction_count = interaction_count + 1 WHERE id = ?'
    )
    this.stmtArchive = this.db.prepare(
      "UPDATE sessions SET status = 'archived', cut_reason = ?, ended_at = datetime('now') WHERE id = ?"
    )
    this.stmtUpdatePaths = this.db.prepare(
      'UPDATE sessions SET transcript_path = ?, summary_path = ? WHERE id = ?'
    )
  }

  createSession(projectId: string): IpcResult<CreateSessionResponse> {
    if (!projectId || typeof projectId !== 'string') {
      return { success: false, error: 'Project ID must be a non-empty string.' }
    }

    const countRow = this.stmtCountByProject.get(projectId) as { cnt: number } | undefined
    const sessionNumber = (countRow?.cnt ?? 0) + 1
    const id = randomUUID()

    try {
      this.stmtInsert.run(id, projectId, sessionNumber)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('FOREIGN KEY constraint failed')) {
        return { success: false, error: `Project not found: ${projectId}` }
      }
      const msg = err instanceof Error ? err.message : 'Database error during session creation'
      return { success: false, error: msg }
    }

    const row = this.stmtSelectById.get(id) as SessionRow | undefined
    if (!row) {
      return { success: false, error: 'Session created but could not be retrieved.' }
    }

    console.log(`[KAIRO_SESSION] Created session #${sessionNumber} (${id}) for project ${projectId}`)
    return { success: true, data: { session: rowToSession(row) } }
  }

  getActiveSession(projectId: string): IpcResult<GetActiveSessionResponse> {
    if (!projectId || typeof projectId !== 'string') {
      return { success: false, error: 'Project ID must be a non-empty string.' }
    }

    try {
      const row = this.stmtSelectActive.get(projectId) as SessionRow | undefined
      return { success: true, data: { session: row ? rowToSession(row) : null } }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during session lookup'
      return { success: false, error: msg }
    }
  }

  addTokens(sessionId: string, tokensToAdd: number): IpcResult<{ session: SessionRecord }> {
    if (!sessionId || typeof sessionId !== 'string') {
      return { success: false, error: 'Session ID must be a non-empty string.' }
    }
    if (typeof tokensToAdd !== 'number' || tokensToAdd < 0) {
      return { success: false, error: 'tokensToAdd must be a non-negative number.' }
    }

    try {
      const result = this.stmtAddTokens.run(tokensToAdd, sessionId)
      if (result.changes === 0) {
        return { success: false, error: `Session not found: ${sessionId}` }
      }

      const row = this.stmtSelectById.get(sessionId) as SessionRow | undefined
      if (!row) {
        return { success: false, error: 'Session updated but could not be retrieved.' }
      }
      return { success: true, data: { session: rowToSession(row) } }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during token update'
      return { success: false, error: msg }
    }
  }

  archiveSession(sessionId: string, cutReason: CutReason): IpcResult<{ session: SessionRecord }> {
    if (!sessionId || typeof sessionId !== 'string') {
      return { success: false, error: 'Session ID must be a non-empty string.' }
    }

    try {
      const result = this.stmtArchive.run(cutReason, sessionId)
      if (result.changes === 0) {
        return { success: false, error: `Session not found: ${sessionId}` }
      }

      const row = this.stmtSelectById.get(sessionId) as SessionRow | undefined
      if (!row) {
        return { success: false, error: 'Session archived but could not be retrieved.' }
      }

      console.log(`[KAIRO_SESSION] Archived session ${sessionId} (reason: ${cutReason})`)
      return { success: true, data: { session: rowToSession(row) } }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during session archive'
      return { success: false, error: msg }
    }
  }

  /** Update transcript and summary file paths for a session (Sprint D). */
  updatePaths(sessionId: string, transcriptPath: string, summaryPath: string): void {
    this.stmtUpdatePaths.run(transcriptPath, summaryPath, sessionId)
  }
}
