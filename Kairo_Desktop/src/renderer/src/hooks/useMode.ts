import { useEffect, useCallback } from 'react'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { useBrokerStore } from '@renderer/stores/brokerStore'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import type { BrokerMode, IpcResult, BrokerModeResponse } from '@shared/types'

export function useMode(): { mode: BrokerMode; toggleMode: () => Promise<void> } {
  const { mode, setMode } = useBrokerStore()

  // Fetch initial mode on mount
  useEffect(() => {
    if (!hasKairoApi()) return
    getKairoApiOrThrow()
      .invoke(IPC_CHANNELS.BROKER_GET_MODE)
      .then((result) => {
        const res = result as IpcResult<BrokerModeResponse>
        if (res.success && res.data) {
          setMode(res.data.mode)
        }
      })
      .catch(console.error)
  }, [setMode])

  const toggleMode = useCallback(async (): Promise<void> => {
    const api = getKairoApiOrThrow()
    const newMode: BrokerMode = mode === 'supervised' ? 'auto' : 'supervised'
    const result = await api.invoke(IPC_CHANNELS.BROKER_SET_MODE, { mode: newMode })
    const res = result as IpcResult<BrokerModeResponse>
    if (res.success && res.data) {
      setMode(res.data.mode)
    }
  }, [mode, setMode])

  return { mode, toggleMode }
}
