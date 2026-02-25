import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { ModelId } from '@shared/types'
import { MODEL_DISPLAY_NAMES } from '@shared/constants'

const MODEL_OPTIONS: ModelId[] = ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.0-flash-lite']

export default function ModelSelector(): React.JSX.Element {
  const selectedModel = useSettingsStore((s) => s.selectedModel)
  const setModel = useSettingsStore((s) => s.setModel)

  return (
    <select
      value={selectedModel}
      onChange={(e) => setModel(e.target.value as ModelId)}
      style={{
        backgroundColor: '#262626',
        color: '#d4d4d4',
        fontSize: '12px',
        borderRadius: '4px',
        padding: '4px 8px',
        border: '1px solid #404040',
        outline: 'none',
      }}
    >
      {MODEL_OPTIONS.map((id) => (
        <option key={id} value={id}>
          {MODEL_DISPLAY_NAMES[id]}
        </option>
      ))}
    </select>
  )
}
