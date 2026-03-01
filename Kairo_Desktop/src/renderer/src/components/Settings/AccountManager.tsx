import { useState, useEffect, useCallback } from 'react'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  Account,
  IpcResult,
  ListAccountsResponse,
  CreateAccountResponse,
  SetActiveAccountResponse,
  AccountGatewayStatus,
  AccountPreflightEvent,
} from '@shared/types'

export default function AccountManager(): React.JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [gatewayStatus, setGatewayStatus] = useState<AccountGatewayStatus | null>(null)

  const fetchAccounts = useCallback(async () => {
    const result = (await getKairoApiOrThrow().invoke(
      IPC_CHANNELS.ACCOUNT_LIST
    )) as IpcResult<ListAccountsResponse>
    if (result.success && result.data) {
      setAccounts(result.data.accounts)
    }
  }, [])

  useEffect(() => {
    fetchAccounts().catch(console.error)
  }, [fetchAccounts])

  // Preflight status: push listener + pull initial snapshot (Patch K — fixes mount race)
  useEffect(() => {
    if (!hasKairoApi()) return

    const api = getKairoApiOrThrow()

    // 1. Register push listener first (no race gap)
    const unsubscribe = api.on(
      IPC_CHANNELS.ACCOUNT_PREFLIGHT_STATUS,
      (event: unknown) => {
        const e = event as AccountPreflightEvent
        if (!e || typeof e.status !== 'string') return
        setGatewayStatus(e.status)
      },
    )

    // 2. Pull initial snapshot (covers late-mount scenario)
    api.invoke(IPC_CHANNELS.ACCOUNT_PREFLIGHT_GET).then((result: unknown) => {
      const r = result as IpcResult<AccountPreflightEvent>
      if (r.success && r.data && typeof r.data.status === 'string') {
        setGatewayStatus(r.data.status)
      }
    }).catch(() => { /* best-effort */ })

    return unsubscribe
  }, [])

  const handleCreate = useCallback(async () => {
    if (!label.trim() || !apiKey.trim()) return
    setError(null)
    const result = (await getKairoApiOrThrow().invoke(
      IPC_CHANNELS.ACCOUNT_CREATE,
      { label: label.trim(), apiKey: apiKey.trim() }
    )) as IpcResult<CreateAccountResponse>

    if (result.success) {
      setLabel('')
      setApiKey('')
      setShowForm(false)
      await fetchAccounts()
    } else {
      setError(result.error ?? 'Failed to create account')
    }
  }, [label, apiKey, fetchAccounts])

  const handleSetActive = useCallback(async (accountId: string) => {
    const result = (await getKairoApiOrThrow().invoke(
      IPC_CHANNELS.ACCOUNT_SET_ACTIVE,
      { accountId }
    )) as IpcResult<SetActiveAccountResponse>
    if (result.success) {
      await fetchAccounts()
    }
  }, [fetchAccounts])

  const handleDelete = useCallback(async (accountId: string) => {
    const result = (await getKairoApiOrThrow().invoke(
      IPC_CHANNELS.ACCOUNT_DELETE,
      { accountId }
    )) as IpcResult<{ deleted: boolean }>
    if (result.success) {
      await fetchAccounts()
    }
  }, [fetchAccounts])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <h4 style={{ fontSize: '12px', fontWeight: 600, color: '#e5e5e5', margin: 0 }}>
          API Accounts
        </h4>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: 'none', border: 'none', color: '#a3a3a3', cursor: 'pointer',
            fontSize: '14px', padding: '0 4px',
          }}
        >
          {showForm ? '\u00d7' : '+'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#fca5a5', fontSize: '12px', marginBottom: '8px' }}>{error}</div>
      )}

      {showForm && (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Account label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              width: '100%', padding: '4px 8px', marginBottom: '4px',
              backgroundColor: '#262626', border: '1px solid #404040', borderRadius: '4px',
              color: '#e5e5e5', fontSize: '12px', boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            placeholder="Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{
              width: '100%', padding: '4px 8px', marginBottom: '4px',
              backgroundColor: '#262626', border: '1px solid #404040', borderRadius: '4px',
              color: '#e5e5e5', fontSize: '12px', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!label.trim() || !apiKey.trim()}
            style={{
              width: '100%', padding: '4px 8px',
              backgroundColor: '#3b82f6', border: 'none', borderRadius: '4px',
              color: '#fff', fontSize: '12px', cursor: 'pointer',
              opacity: (!label.trim() || !apiKey.trim()) ? 0.5 : 1,
            }}
          >
            Add Account
          </button>
        </div>
      )}

      {accounts.length === 0 && !showForm && (
        <p style={{ fontStyle: 'italic', color: '#737373', fontSize: '12px', margin: 0 }}>No accounts configured</p>
      )}

      {accounts.map((account) => (
        <div
          key={account.id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 8px', marginBottom: '2px', borderRadius: '4px',
            backgroundColor: account.isActive ? '#1e3a5f' : 'transparent',
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: '#e5e5e5' }}>{account.label}</span>
            {account.isActive && (
              <>
                <span style={{ fontSize: '10px', color: '#3b82f6', marginLeft: '6px' }}>active</span>
                {gatewayStatus === 'validating' && (
                  <span style={{ fontSize: '10px', color: '#a3a3a3', marginLeft: '4px' }}>...</span>
                )}
                {gatewayStatus === 'valid' && (
                  <span style={{ fontSize: '10px', color: '#22c55e', marginLeft: '4px' }}>OK</span>
                )}
                {gatewayStatus === 'invalid' && (
                  <span style={{ fontSize: '10px', color: '#ef4444', marginLeft: '4px' }}>invalid key</span>
                )}
                {gatewayStatus === 'quota' && (
                  <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>quota</span>
                )}
                {gatewayStatus === 'unknown' && (
                  <span style={{ fontSize: '10px', color: '#737373', marginLeft: '4px' }}>?</span>
                )}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {!account.isActive && (
              <button
                onClick={() => handleSetActive(account.id)}
                style={{
                  background: 'none', border: '1px solid #404040', borderRadius: '3px',
                  color: '#a3a3a3', fontSize: '10px', cursor: 'pointer', padding: '2px 6px',
                }}
              >
                Use
              </button>
            )}
            <button
              onClick={() => handleDelete(account.id)}
              style={{
                background: 'none', border: '1px solid #404040', borderRadius: '3px',
                color: '#fca5a5', fontSize: '10px', cursor: 'pointer', padding: '2px 6px',
              }}
            >
              Del
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
