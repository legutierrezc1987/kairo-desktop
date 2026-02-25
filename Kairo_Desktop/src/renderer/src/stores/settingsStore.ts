import { create } from 'zustand'
import type { ModelId, SettingsState } from '@shared/types'
import { DEFAULT_MODEL } from '@shared/constants'

interface SettingsActions {
  setModel: (model: ModelId) => void
  setBudgetPreset: (preset: SettingsState['budgetPreset']) => void
}

type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()((set) => ({
  selectedModel: DEFAULT_MODEL,
  budgetPreset: 'balanced',

  setModel: (selectedModel) => set({ selectedModel }),
  setBudgetPreset: (budgetPreset) => set({ budgetPreset }),
}))
