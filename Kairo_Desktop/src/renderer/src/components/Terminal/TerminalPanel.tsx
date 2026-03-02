import { useTerminal } from '@renderer/hooks/useTerminal'
import { useProjectStore } from '@renderer/stores/projectStore'
import CommandApproval from './CommandApproval'
import 'xterm/css/xterm.css'

export default function TerminalPanel(): React.JSX.Element {
  const activeProject = useProjectStore((s) => s.activeProject)

  // Hotfix 0.1.1: No project → no terminal spawn
  if (!activeProject) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#737373', fontSize: '13px', backgroundColor: '#0a0a0a', fontFamily: 'monospace' }}>
        <p>No project open — select or create a project to use the terminal.</p>
      </div>
    )
  }

  // Key on project id forces full remount (clean respawn) on project switch
  return <TerminalView key={activeProject.id} cwd={activeProject.folderPath} />
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
