import { useMode } from '@renderer/hooks/useMode'

export default function ModeToggle(): React.JSX.Element {
  const { mode, toggleMode } = useMode()

  const isSupervised = mode === 'supervised'

  return (
    <button
      onClick={toggleMode}
      title={`Current: ${mode} mode. Click to switch.`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '4px',
        border: '1px solid',
        borderColor: isSupervised ? '#ca8a04' : '#22c55e',
        backgroundColor: isSupervised ? '#422006' : '#052e16',
        color: isSupervised ? '#fde047' : '#86efac',
        fontSize: '11px',
        fontFamily: 'monospace',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: isSupervised ? '#eab308' : '#22c55e',
        }}
      />
      {isSupervised ? 'SUPERVISED' : 'AUTO'}
    </button>
  )
}
