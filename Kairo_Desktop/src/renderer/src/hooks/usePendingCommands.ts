import { useEffect, useCallback } from 'react'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { useBrokerStore } from '@renderer/stores/brokerStore'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import type {
  IpcResult,
  PendingCommandNotification,
  PendingResolvedNotification,
  ApprovalResponse,
} from '@shared/types'

export function usePendingCommands(): {
  pendingCommands: PendingCommandNotification[]
  approve: (commandId: string) => Promise<ApprovalResponse | null>
  reject: (commandId: string) => Promise<ApprovalResponse | null>
} {
  const { pendingCommands, addPending, removePending, setPendingCommands } = useBrokerStore()

  // Fetch existing pending commands on mount
  useEffect(() => {
    if (!hasKairoApi()) return
    getKairoApiOrThrow()
      .invoke(IPC_CHANNELS.BROKER_GET_PENDING)
      .then((result) => {
        const res = result as IpcResult<PendingCommandNotification[]>
        if (res.success && res.data) {
          setPendingCommands(res.data)
        }
      })
      .catch(console.error)
  }, [setPendingCommands])

  // Listen for push events from main process
  useEffect(() => {
    if (!hasKairoApi()) return
    const api = getKairoApiOrThrow()

    const unsubAdded = api.on(
      IPC_CHANNELS.BROKER_PENDING_ADDED,
      (...args: unknown[]) => {
        const payload = args[0] as PendingCommandNotification
        addPending(payload)
      }
    )

    const unsubResolved = api.on(
      IPC_CHANNELS.BROKER_PENDING_RESOLVED,
      (...args: unknown[]) => {
        const payload = args[0] as PendingResolvedNotification
        removePending(payload.id)
      }
    )

    return () => {
      unsubAdded()
      unsubResolved()
    }
  }, [addPending, removePending])

  const approve = useCallback(async (commandId: string): Promise<ApprovalResponse | null> => {
    const api = getKairoApiOrThrow()
    const result = await api.invoke(IPC_CHANNELS.BROKER_APPROVE, { commandId })
    const res = result as IpcResult<ApprovalResponse>
    return res.data ?? null
  }, [])

  const reject = useCallback(async (commandId: string): Promise<ApprovalResponse | null> => {
    const api = getKairoApiOrThrow()
    const result = await api.invoke(IPC_CHANNELS.BROKER_REJECT, { commandId })
    const res = result as IpcResult<ApprovalResponse>
    return res.data ?? null
  }, [])

  return { pendingCommands, approve, reject }
}
