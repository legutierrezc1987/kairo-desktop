import { useCallback } from 'react'
import { useSessionStore } from '@renderer/stores/sessionStore'
import { useSession } from '@renderer/hooks/useSession'
import { useProjectStore } from '@renderer/stores/projectStore'

export default function ConsolidateButton(): React.JSX.Element | null {
  const activeProject = useProjectStore((s) => s.activeProject)
  const isArchiving = useSessionStore((s) => s.isArchiving)
  const budgetState = useSessionStore((s) => s.budgetState)
  const { archiveSession } = useSession()

  const handleClick = useCallback(async () => {
    await archiveSession('manual')
  }, [archiveSession])

  // Only show when a project is active
  if (!activeProject) return null

  const usagePercent = budgetState
    ? Math.round((budgetState.totalUsed / budgetState.totalBudget) * 100)
    : 0

  return (
    <button
      onClick={handleClick}
      disabled={isArchiving}
      title={`Archive session and start fresh (${usagePercent}% used)`}
      style={{
        background: 'none',
        border: '1px solid #404040',
        borderRadius: '4px',
        color: usagePercent >= 80 ? '#fca5a5' : '#a3a3a3',
        cursor: isArchiving ? 'not-allowed' : 'pointer',
        fontSize: '12px',
        padding: '4px 8px',
        opacity: isArchiving ? 0.5 : 1,
      }}
    >
      {isArchiving ? 'Archiving...' : 'Consolidate'}
    </button>
  )
}
