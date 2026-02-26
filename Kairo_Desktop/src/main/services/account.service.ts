import type Database from 'better-sqlite3'
import { safeStorage } from 'electron'
import { randomUUID } from 'node:crypto'
import type {
  Account,
  AccountTier,
  IpcResult,
  CreateAccountResponse,
  ListAccountsResponse,
  SetActiveAccountResponse,
} from '../../shared/types'

interface AccountRow {
  id: string
  label: string
  api_key_encrypted: string
  is_active: number
  tier: string
  created_at: string
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    label: row.label,
    isActive: row.is_active === 1,
    tier: row.tier as AccountTier,
    createdAt: row.created_at,
  }
}

export class AccountService {
  private stmtInsert: Database.Statement
  private stmtSelectById: Database.Statement
  private stmtSelectAll: Database.Statement
  private stmtDeactivateAll: Database.Statement
  private stmtActivate: Database.Statement
  private stmtDelete: Database.Statement
  private stmtSelectActiveKey: Database.Statement
  private encryptionAvailable: boolean

  constructor(private db: Database.Database) {
    this.stmtInsert = this.db.prepare(
      "INSERT INTO accounts (id, label, api_key_encrypted, is_active, tier, created_at) VALUES (?, ?, ?, 0, ?, datetime('now'))"
    )
    this.stmtSelectById = this.db.prepare('SELECT * FROM accounts WHERE id = ?')
    this.stmtSelectAll = this.db.prepare('SELECT * FROM accounts ORDER BY created_at DESC')
    this.stmtDeactivateAll = this.db.prepare('UPDATE accounts SET is_active = 0')
    this.stmtActivate = this.db.prepare('UPDATE accounts SET is_active = 1 WHERE id = ?')
    this.stmtDelete = this.db.prepare('DELETE FROM accounts WHERE id = ?')
    this.stmtSelectActiveKey = this.db.prepare(
      'SELECT api_key_encrypted FROM accounts WHERE is_active = 1 LIMIT 1'
    )

    this.encryptionAvailable = safeStorage.isEncryptionAvailable()
    if (!this.encryptionAvailable) {
      console.warn('[KAIRO_SECURITY] safeStorage unavailable — API keys will be stored with PLAINTEXT fallback!')
    }
  }

  private encryptKey(plainKey: string): string {
    if (this.encryptionAvailable) {
      const encrypted = safeStorage.encryptString(plainKey)
      return encrypted.toString('base64')
    }
    return `PLAINTEXT:${plainKey}`
  }

  private decryptKey(stored: string): string {
    if (stored.startsWith('PLAINTEXT:')) {
      return stored.slice('PLAINTEXT:'.length)
    }
    const buffer = Buffer.from(stored, 'base64')
    return safeStorage.decryptString(buffer)
  }

  createAccount(label: string, apiKey: string, tier: AccountTier = 'free'): IpcResult<CreateAccountResponse> {
    const trimmedLabel = label.trim()
    if (trimmedLabel.length === 0) {
      return { success: false, error: 'Account label must be a non-empty string.' }
    }
    if (!apiKey || apiKey.trim().length === 0) {
      return { success: false, error: 'API key must be a non-empty string.' }
    }

    const id = randomUUID()
    const encryptedKey = this.encryptKey(apiKey.trim())

    try {
      this.stmtInsert.run(id, trimmedLabel, encryptedKey, tier)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during account creation'
      return { success: false, error: msg }
    }

    const row = this.stmtSelectById.get(id) as AccountRow | undefined
    if (!row) {
      return { success: false, error: 'Account created but could not be retrieved.' }
    }

    console.log(`[KAIRO_ACCOUNT] Created account "${trimmedLabel}" (${id})`)
    return { success: true, data: { account: rowToAccount(row) } }
  }

  listAccounts(): IpcResult<ListAccountsResponse> {
    try {
      const rows = this.stmtSelectAll.all() as AccountRow[]
      const accounts = rows.map(rowToAccount)
      return { success: true, data: { accounts } }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during account listing'
      return { success: false, error: msg }
    }
  }

  setActiveAccount(accountId: string): IpcResult<SetActiveAccountResponse> {
    if (!accountId || typeof accountId !== 'string') {
      return { success: false, error: 'Account ID must be a non-empty string.' }
    }

    const setActive = this.db.transaction(() => {
      this.stmtDeactivateAll.run()
      const result = this.stmtActivate.run(accountId)
      if (result.changes === 0) {
        throw new Error(`Account not found: ${accountId}`)
      }
    })

    try {
      setActive()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during account activation'
      return { success: false, error: msg }
    }

    const row = this.stmtSelectById.get(accountId) as AccountRow | undefined
    if (!row) {
      return { success: false, error: 'Account activated but could not be retrieved.' }
    }

    console.log(`[KAIRO_ACCOUNT] Activated account "${row.label}" (${accountId})`)
    return { success: true, data: { account: rowToAccount(row) } }
  }

  deleteAccount(accountId: string): IpcResult<void> {
    if (!accountId || typeof accountId !== 'string') {
      return { success: false, error: 'Account ID must be a non-empty string.' }
    }

    try {
      const result = this.stmtDelete.run(accountId)
      if (result.changes === 0) {
        return { success: false, error: `Account not found: ${accountId}` }
      }
      console.log(`[KAIRO_ACCOUNT] Deleted account ${accountId}`)
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database error during account deletion'
      return { success: false, error: msg }
    }
  }

  getActiveApiKey(): string | null {
    try {
      const row = this.stmtSelectActiveKey.get() as { api_key_encrypted: string } | undefined
      if (!row) return null
      return this.decryptKey(row.api_key_encrypted)
    } catch (err: unknown) {
      console.error('[KAIRO_ACCOUNT] Failed to retrieve active API key:', err)
      return null
    }
  }

  isEncryptionAvailable(): boolean {
    return this.encryptionAvailable
  }
}
