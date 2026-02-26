import Database from 'better-sqlite3'
import { join } from 'node:path'

/**
 * DatabaseService — Singleton SQLite manager.
 * DEC-023: 7 tables, better-sqlite3 v12.6.2, synchronous API.
 *
 * Must be instantiated AFTER app.whenReady() because
 * app.getPath('userData') is only valid after the ready event.
 */

const SCHEMA_VERSION = 1

export class DatabaseService {
  private db: Database.Database

  constructor(userDataPath: string) {
    const dbPath = join(userDataPath, 'kairo_memory.db')
    this.db = new Database(dbPath)
    this.configurePragmas()
    this.bootstrap()
  }

  getDb(): Database.Database {
    return this.db
  }

  close(): void {
    if (this.db.open) {
      this.db.close()
    }
  }

  private configurePragmas(): void {
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
  }

  private bootstrap(): void {
    const currentVersion = this.db.pragma('user_version', { simple: true }) as number

    if (currentVersion >= SCHEMA_VERSION) {
      return
    }

    this.db.exec(this.getSchemaSQL())
    this.db.pragma(`user_version = ${SCHEMA_VERSION}`)

    console.log(`[KAIRO_DB] Schema bootstrapped to version ${SCHEMA_VERSION}`)
  }

  private getSchemaSQL(): string {
    return `
      CREATE TABLE IF NOT EXISTS projects (
        id                   TEXT PRIMARY KEY NOT NULL,
        name                 TEXT NOT NULL,
        folder_path          TEXT NOT NULL UNIQUE,
        notebook_id          TEXT,
        notebook_url         TEXT,
        model                TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
        token_threshold_soft INTEGER NOT NULL DEFAULT 150000,
        token_threshold_hard INTEGER NOT NULL DEFAULT 200000,
        turn_limit           INTEGER NOT NULL DEFAULT 40,
        agent_mode           TEXT NOT NULL DEFAULT 'supervised'
                             CHECK (agent_mode IN ('supervised', 'auto')),
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id                TEXT PRIMARY KEY NOT NULL,
        project_id        TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        session_number    INTEGER NOT NULL,
        total_tokens      INTEGER NOT NULL DEFAULT 0,
        interaction_count INTEGER NOT NULL DEFAULT 0,
        cut_reason        TEXT CHECK (cut_reason IN ('tokens', 'turns', 'manual', 'emergency')),
        status            TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'archived', 'failed')),
        transcript_path   TEXT,
        summary_path      TEXT,
        started_at        TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at          TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id          TEXT PRIMARY KEY NOT NULL,
        session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content     TEXT NOT NULL,
        token_count INTEGER NOT NULL DEFAULT 0,
        channel     TEXT NOT NULL DEFAULT 'chat'
                    CHECK (channel IN ('chat', 'terminal', 'diff', 'recall')),
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS command_log (
        id             TEXT PRIMARY KEY NOT NULL,
        session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        command        TEXT NOT NULL,
        zone           TEXT NOT NULL CHECK (zone IN ('green', 'yellow', 'red')),
        mode           TEXT NOT NULL CHECK (mode IN ('automatic', 'supervised')),
        user_action    TEXT NOT NULL
                       CHECK (user_action IN ('approved', 'rejected', 'edited', 'auto', 'blocked')),
        output_summary TEXT,
        exit_code      INTEGER,
        created_at     TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS upload_queue (
        id            TEXT PRIMARY KEY NOT NULL,
        session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        file_path     TEXT NOT NULL,
        file_type     TEXT NOT NULL CHECK (file_type IN ('transcript', 'summary', 'master_summary')),
        retry_count   INTEGER NOT NULL DEFAULT 0,
        status        TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'uploading', 'synced', 'failed', 'manual')),
        error_message TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now')),
        next_retry_at TEXT
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id                TEXT PRIMARY KEY NOT NULL,
        label             TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        is_active         INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
        tier              TEXT NOT NULL DEFAULT 'free'
                          CHECK (tier IN ('free', 'tier1', 'tier2')),
        created_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key         TEXT PRIMARY KEY NOT NULL,
        value       TEXT NOT NULL,
        description TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_project_id    ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_session_id    ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_command_log_session_id ON command_log(session_id);
      CREATE INDEX IF NOT EXISTS idx_upload_queue_session_id ON upload_queue(session_id);
      CREATE INDEX IF NOT EXISTS idx_upload_queue_status     ON upload_queue(status);
      CREATE INDEX IF NOT EXISTS idx_accounts_is_active      ON accounts(is_active);
    `
  }
}
