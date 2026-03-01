import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { VisibilityMode } from '@shared/types'

const MODES: Array<{ key: VisibilityMode; label: string; description: string }> = [
  { key: 'concise', label: 'Concise', description: 'Shorter, focused responses' },
  { key: 'detailed', label: 'Detailed', description: 'Thorough explanations' },
]

export default function VisibilityToggle(): React.JSX.Element {
  const visibilityMode = useSettingsStore((s) => s.visibilityMode)
  const setVisibilityMode = useSettingsStore((s) => s.setVisibilityMode)

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#a3a3a3', marginBottom: '8px' }}>
        Response Style
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setVisibilityMode(mode.key)}
            title={mode.description}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              borderRadius: '4px',
              border: visibilityMode === mode.key ? '1px solid #6366f1' : '1px solid #404040',
              backgroundColor: visibilityMode === mode.key ? '#312e81' : '#262626',
              color: visibilityMode === mode.key ? '#a5b4fc' : '#d4d4d4',
              cursor: 'pointer',
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: '#525252', marginTop: '4px' }}>
        {visibilityMode === 'concise'
          ? 'AI will prioritize brevity and directness.'
          : 'AI will provide thorough, detailed explanations.'}
      </div>
    </div>
  )
}
