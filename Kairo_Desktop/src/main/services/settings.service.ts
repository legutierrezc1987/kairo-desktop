import type Database from 'better-sqlite3'
import type {
  SettingEntry,
  IpcResult,
  GetSettingResponse,
  GetAllSettingsResponse,
} from '../../shared/types'

interface SettingRow {
  key: string
  value: string
  description: string | null
}

function rowToSettingEntry(row: SettingRow): SettingEntry {
  return {
    key: row.key,
    value: row.value,
    description: row.description,
  }
}

export class SettingsService {
  private stmtUpsert: Database.Statement
  private stmtSelectByKey: Database.Statement
  private stmtSelectAll: Database.Statement
  private stmtDeleteByKey: Database.Statement

  constructor(private db: Database.Database) {
    this.stmtUpsert = this.db.prepare(
      'INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, ?)'
    )
    this.stmtSelectByKey = this.db.prepare('SELECT * FROM settings WHERE key = ?')
    this.stmtSelectAll = this.db.prepare('SELECT * FROM settings ORDER BY key ASC')
    this.stmtDeleteByKey = this.db.prepare('DELETE FROM settings WHERE key = ?')
  }

  setSetting(key: string, value: string, description?: string): IpcResult<void> {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return { success: false, error: 'Setting key must be a non-empty string.' }
    }
    if (typeof value !== 'string') {
      return { success: false, error: 'Setting value must be a string.' }
    }

    try {
      this.stmtUpsert.run(key.trim(), value, description ?? null)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during setting write'
      return { success: false, error: msg }
    }
  }

  getSetting(key: string): IpcResult<GetSettingResponse> {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Setting key must be a non-empty string.' }
    }

    try {
      const row = this.stmtSelectByKey.get(key.trim()) as SettingRow | undefined
      return { success: true, data: { value: row ? row.value : null } }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during setting read'
      return { success: false, error: msg }
    }
  }

  getAllSettings(): IpcResult<GetAllSettingsResponse> {
    try {
      const rows = this.stmtSelectAll.all() as SettingRow[]
      return { success: true, data: { settings: rows.map(rowToSettingEntry) } }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during settings listing'
      return { success: false, error: msg }
    }
  }

  deleteSetting(key: string): IpcResult<void> {
    if (!key || typeof key !== 'string') {
      return { success: false, error: 'Setting key must be a non-empty string.' }
    }

    try {
      this.stmtDeleteByKey.run(key.trim())
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during setting deletion'
      return { success: false, error: msg }
    }
  }
}
