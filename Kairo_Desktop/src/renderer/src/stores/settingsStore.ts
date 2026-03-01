import { create } from 'zustand'
import type { ModelId, SettingsState, VisibilityMode } from '@shared/types'
import { DEFAULT_MODEL } from '@shared/constants'

interface SettingsActions {
  setModel: (model: ModelId) => void
  setBudgetPreset: (preset: SettingsState['budgetPreset']) => void
  setCustomBudget: (value: number | undefined) => void
  setVisibilityMode: (mode: VisibilityMode) => void
  /** Bulk-hydrate from backend settings on boot */
  hydrate: (partial: Partial<SettingsState>) => void
}

type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()((set) => ({
  selectedModel: DEFAULT_MODEL,
  budgetPreset: 'balanced',
  customBudget: undefined,
  visibilityMode: 'detailed' as VisibilityMode,

  setModel: (selectedModel) => set({ selectedModel }),
  setBudgetPreset: (budgetPreset) => set({ budgetPreset }),
  setCustomBudget: (customBudget) => set({ customBudget }),
  setVisibilityMode: (visibilityMode) => set({ visibilityMode }),
  hydrate: (partial) => set(partial),
}))
