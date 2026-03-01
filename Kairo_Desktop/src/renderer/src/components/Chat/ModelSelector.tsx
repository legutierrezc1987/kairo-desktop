import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { ModelId } from '@shared/types'
import { MODEL_DISPLAY_NAMES } from '@shared/constants'

const MODEL_OPTIONS: ModelId[] = [
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
]

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
