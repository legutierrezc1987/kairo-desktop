import { useSettingsStore } from '@renderer/stores/settingsStore'
import { BUDGET_PRESETS, CUSTOM_BUDGET_MIN, CUSTOM_BUDGET_MAX } from '@shared/constants'
import type { SettingsState } from '@shared/types'

const PRESET_OPTIONS: Array<{ key: SettingsState['budgetPreset']; label: string; tokens: string }> = [
  { key: 'conservative', label: 'Conservative', tokens: `${(BUDGET_PRESETS.conservative / 1000).toFixed(0)}K` },
  { key: 'balanced', label: 'Balanced', tokens: `${(BUDGET_PRESETS.balanced / 1000).toFixed(0)}K` },
  { key: 'extended', label: 'Extended', tokens: `${(BUDGET_PRESETS.extended / 1000).toFixed(0)}K` },
  { key: 'custom', label: 'Custom', tokens: '' },
]

export default function BudgetPresetSelector(): React.JSX.Element {
  const budgetPreset = useSettingsStore((s) => s.budgetPreset)
  const customBudget = useSettingsStore((s) => s.customBudget)
  const setBudgetPreset = useSettingsStore((s) => s.setBudgetPreset)
  const setCustomBudget = useSettingsStore((s) => s.setCustomBudget)

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') {
      setCustomBudget(undefined)
      return
    }
    const n = Number(raw)
    if (!Number.isNaN(n)) {
      setCustomBudget(Math.max(CUSTOM_BUDGET_MIN, Math.min(CUSTOM_BUDGET_MAX, n)))
    }
  }

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#a3a3a3', marginBottom: '8px' }}>
        Token Budget
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setBudgetPreset(opt.key)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '4px',
              border: budgetPreset === opt.key ? '1px solid #6366f1' : '1px solid #404040',
              backgroundColor: budgetPreset === opt.key ? '#312e81' : '#262626',
              color: budgetPreset === opt.key ? '#a5b4fc' : '#d4d4d4',
              cursor: 'pointer',
            }}
          >
            {opt.label}{opt.tokens ? ` (${opt.tokens})` : ''}
          </button>
        ))}
      </div>
      {budgetPreset === 'custom' && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            value={customBudget !== undefined ? String(customBudget) : ''}
            onChange={handleCustomChange}
            placeholder={`${CUSTOM_BUDGET_MIN}–${CUSTOM_BUDGET_MAX}`}
            style={{
              width: '120px',
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#262626',
              border: '1px solid #404040',
              borderRadius: '4px',
              color: '#e5e5e5',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '11px', color: '#737373' }}>tokens</span>
        </div>
      )}
    </div>
  )
}
