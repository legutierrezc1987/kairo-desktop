import { useState, useEffect, useCallback } from 'react'
import { IPC_CHANNELS } from '../../../../shared/ipc-channels'
import { KILL_SWITCH_BANNER_DURATION_MS } from '../../../../shared/constants'

/**
 * Kill switch emergency banner — DEC-025.
 * Subscribes to the kill switch push event from main process.
 * Displays a red overlay banner when activated, auto-dismisses after 4 seconds.
 */
export default function KillSwitch(): React.JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [killedCount, setKilledCount] = useState(0)

  const handleActivation = useCallback((...args: unknown[]) => {
    const data = args[0] as { killedCount?: number } | undefined
    setKilledCount(data?.killedCount ?? 0)
    setVisible(true)
    setTimeout(() => setVisible(false), KILL_SWITCH_BANNER_DURATION_MS)
  }, [])

  useEffect(() => {
    const unsub = window.kairoApi.on(IPC_CHANNELS.KILLSWITCH_ACTIVATED, handleActivation)
    return unsub
  }, [handleActivation])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      backgroundColor: '#dc2626',
      color: '#fff',
      padding: '10px 20px',
      textAlign: 'center',
      fontWeight: 'bold',
      fontSize: '14px',
    }}>
      EMERGENCY STOP — {killedCount} terminal(s) killed, pending commands cleared
    </div>
  )
}
