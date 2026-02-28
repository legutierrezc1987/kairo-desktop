import { useProjectStore } from '@renderer/stores/projectStore'
import { useSessionStore } from '@renderer/stores/sessionStore'

export default function StatusBar(): React.JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)
  const sessionState = useSessionStore((s) => s.sessionState)
  const budgetState = useSessionStore((s) => s.budgetState)

  const usagePercent = budgetState
    ? Math.round((budgetState.totalUsed / budgetState.totalBudget) * 100)
    : 0

  const usageColor = usagePercent >= 80 ? '#fca5a5' : usagePercent >= 50 ? '#fcd34d' : '#86efac'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      fontSize: '11px', color: '#a3a3a3',
    }}>
      {activeProject && (
        <span style={{ color: '#e5e5e5' }} title={activeProject.folderPath}>
          {activeProject.name}
        </span>
      )}
      {sessionState && (
        <span title={`Session ${sessionState.sessionId.slice(0, 8)}`}>
          Turn {sessionState.turnCount}
        </span>
      )}
      {budgetState && (
        <span style={{ color: usageColor }} title={`${budgetState.totalUsed.toLocaleString()} / ${budgetState.totalBudget.toLocaleString()} tokens`}>
          {usagePercent}%
        </span>
      )}
      {!activeProject && (
        <span style={{ fontStyle: 'italic' }}>No project</span>
      )}
    </div>
  )
}
