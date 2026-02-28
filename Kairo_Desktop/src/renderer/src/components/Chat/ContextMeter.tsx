import { useState, useEffect } from 'react'
import type { TokenBudgetState } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'

export default function ContextMeter(): React.JSX.Element {
  const [budget, setBudget] = useState<TokenBudgetState | null>(null)

  useEffect(() => {
    if (!hasKairoApi()) return

    const api = getKairoApiOrThrow()
    const fetchBudget = async (): Promise<void> => {
      try {
        const state = (await api.invoke(
          IPC_CHANNELS.TOKEN_GET_BUDGET
        )) as TokenBudgetState
        setBudget(state)
      } catch {
        // Silently fail — budget shows as 0%
      }
    }

    fetchBudget()
    const interval = setInterval(fetchBudget, 5000)
    return () => clearInterval(interval)
  }, [])

  const percentage = budget
    ? Math.min(100, Math.round((budget.totalUsed / budget.totalBudget) * 100))
    : 0

  const barColor = percentage > 80 ? '#ef4444' : percentage > 60 ? '#eab308' : '#3b82f6'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#a3a3a3' }}>
      <div style={{ width: '96px', height: '8px', backgroundColor: '#404040', borderRadius: '9999px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            backgroundColor: barColor,
            width: `${percentage}%`,
            transition: 'width 300ms',
          }}
        />
      </div>
      <span>{percentage}%</span>
    </div>
  )
}
