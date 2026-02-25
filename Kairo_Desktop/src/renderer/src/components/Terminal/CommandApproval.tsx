import { useState, useEffect } from 'react'
import { usePendingCommands } from '@renderer/hooks/usePendingCommands'
import type { PendingCommandNotification } from '@shared/types'

function ApprovalCard({
  cmd,
  onApprove,
  onReject,
}: {
  cmd: PendingCommandNotification
  onApprove: (id: string) => void
  onReject: (id: string) => void
}): React.JSX.Element {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.floor((cmd.expiresAt - Date.now()) / 1000))
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, Math.floor((cmd.expiresAt - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(timer)
  }, [cmd.expiresAt])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        backgroundColor: '#422006',
        borderRadius: '4px',
        border: '1px solid #854d0e',
        fontSize: '12px',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ flex: 1, marginRight: '10px', overflow: 'hidden' }}>
        <span style={{ color: '#fde047' }}>[YELLOW]</span>{' '}
        <code style={{ color: '#e5e5e5' }}>{cmd.command}</code>
        <span style={{ color: '#737373', marginLeft: '8px' }}>({timeLeft}s)</span>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => onApprove(cmd.id)}
          style={{
            padding: '2px 8px',
            fontSize: '11px',
            borderRadius: '3px',
            border: '1px solid #22c55e',
            backgroundColor: '#052e16',
            color: '#86efac',
            cursor: 'pointer',
          }}
        >
          Approve
        </button>
        <button
          onClick={() => onReject(cmd.id)}
          style={{
            padding: '2px 8px',
            fontSize: '11px',
            borderRadius: '3px',
            border: '1px solid #ef4444',
            backgroundColor: '#450a0a',
            color: '#fca5a5',
            cursor: 'pointer',
          }}
        >
          Reject
        </button>
      </div>
    </div>
  )
}

export default function CommandApproval(): React.JSX.Element | null {
  const { pendingCommands, approve, reject } = usePendingCommands()

  if (pendingCommands.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '6px',
        borderBottom: '1px solid #404040',
        backgroundColor: '#1a1a1a',
      }}
    >
      {pendingCommands.map((cmd) => (
        <ApprovalCard key={cmd.id} cmd={cmd} onApprove={approve} onReject={reject} />
      ))}
    </div>
  )
}
