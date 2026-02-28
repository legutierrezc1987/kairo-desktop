import { useState, useEffect } from 'react'
import { useTerminal } from '@renderer/hooks/useTerminal'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { IpcResult } from '@shared/types'
import CommandApproval from './CommandApproval'
import 'xterm/css/xterm.css'

export default function TerminalPanel(): React.JSX.Element {
  const [cwd, setCwd] = useState<string | null>(null)
  const [cwdError, setCwdError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasKairoApi()) return
    getKairoApiOrThrow()
      .invoke(IPC_CHANNELS.APP_GET_CWD)
      .then((result) => {
        const res = result as IpcResult<string>
        if (res.success && res.data) {
          setCwd(res.data)
        } else {
          setCwdError(res.error ?? 'Failed to get working directory')
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to get CWD'
        setCwdError(msg)
      })
  }, [])

  if (cwdError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fca5a5', fontSize: '13px', backgroundColor: '#0a0a0a', fontFamily: 'monospace' }}>
        <p>Terminal error: {cwdError}</p>
      </div>
    )
  }

  if (!cwd) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#737373', fontSize: '13px', backgroundColor: '#0a0a0a', fontFamily: 'monospace' }}>
        <p>Initializing terminal...</p>
      </div>
    )
  }

  return <TerminalView cwd={cwd} />
}

function TerminalView({ cwd }: { cwd: string }): React.JSX.Element {
  const { terminalRef, error } = useTerminal({ cwd })

  return (
    <div style={{ height: '100%', width: '100%', backgroundColor: '#0a0a0a', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {error && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: '#7f1d1d',
          color: '#fca5a5',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}>
          Terminal error: {error}
        </div>
      )}
      <CommandApproval />
      <div ref={terminalRef} style={{ flex: 1, width: '100%' }} />
    </div>
  )
}
