import { useEffect, useCallback } from 'react'
import { useSessionStore } from '@renderer/stores/sessionStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  IpcResult,
  SessionState,
  TokenBudgetState,
  SessionArchiveResponse,
  CutReason,
} from '@shared/types'

export function useSession() {
  const activeProject = useProjectStore((s) => s.activeProject)
  const {
    setSessionState,
    setBudgetState,
    setArchiving,
  } = useSessionStore()

  // Poll session + budget state when a project is active
  useEffect(() => {
    if (!activeProject) {
      setSessionState(null)
      setBudgetState(null)
      return
    }
    if (!hasKairoApi()) return

    const api = getKairoApiOrThrow()
    const fetchState = (): void => {
      api
        .invoke(IPC_CHANNELS.SESSION_GET_STATE)
        .then((result) => {
          const res = result as IpcResult<SessionState>
          if (res.success && res.data) {
            setSessionState(res.data)
          }
        })
        .catch(console.error)

      api
        .invoke(IPC_CHANNELS.TOKEN_GET_BUDGET)
        .then((result) => {
          const res = result as IpcResult<TokenBudgetState>
          if (res.success && res.data) {
            setBudgetState(res.data)
          }
        })
        .catch(console.error)
    }

    fetchState()
    const interval = setInterval(fetchState, 5_000)
    return () => clearInterval(interval)
  }, [activeProject, setSessionState, setBudgetState])

  const archiveSession = useCallback(
    async (reason: CutReason = 'manual'): Promise<boolean> => {
      const api = getKairoApiOrThrow()
      setArchiving(true)
      try {
        const result = (await api.invoke(
          IPC_CHANNELS.SESSION_ARCHIVE,
          { reason }
        )) as IpcResult<SessionArchiveResponse>
        return result.success === true
      } catch {
        return false
      } finally {
        setArchiving(false)
      }
    },
    [setArchiving]
  )

  return { archiveSession }
}
