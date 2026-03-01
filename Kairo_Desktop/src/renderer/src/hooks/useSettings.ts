import { useEffect, useRef, useCallback } from 'react'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { IpcResult, GetSettingResponse, ModelId, VisibilityMode, SettingsState } from '@shared/types'
import { DEFAULT_MODEL, CUSTOM_BUDGET_MIN, CUSTOM_BUDGET_MAX } from '@shared/constants'

/** Setting keys used for global persistence */
const SETTINGS_KEYS = {
  model: 'selected_model',
  budgetPreset: 'budget_preset',
  customBudget: 'custom_budget',
  visibilityMode: 'visibility_mode',
} as const

const VALID_MODELS: readonly string[] = [
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
]
const VALID_PRESETS: readonly string[] = ['conservative', 'balanced', 'extended', 'custom']
const VALID_VISIBILITY: readonly string[] = ['concise', 'detailed']

/**
 * Hydrate settings from backend on mount; persist changes reactively.
 * Uses SETTINGS_GET / SETTINGS_SET IPC — no new channels needed.
 */
export function useSettings(): void {
  const hydrate = useSettingsStore((s) => s.hydrate)
  const hydrated = useRef(false)

  // ── Hydrate from backend on mount ────────────────────────────
  useEffect(() => {
    if (!hasKairoApi() || hydrated.current) return
    hydrated.current = true

    const load = async (): Promise<void> => {
      try {
        const api = getKairoApiOrThrow()
        const [modelRes, presetRes, customRes, visRes] = await Promise.all([
          api.invoke(IPC_CHANNELS.SETTINGS_GET, { key: SETTINGS_KEYS.model }) as Promise<IpcResult<GetSettingResponse>>,
          api.invoke(IPC_CHANNELS.SETTINGS_GET, { key: SETTINGS_KEYS.budgetPreset }) as Promise<IpcResult<GetSettingResponse>>,
          api.invoke(IPC_CHANNELS.SETTINGS_GET, { key: SETTINGS_KEYS.customBudget }) as Promise<IpcResult<GetSettingResponse>>,
          api.invoke(IPC_CHANNELS.SETTINGS_GET, { key: SETTINGS_KEYS.visibilityMode }) as Promise<IpcResult<GetSettingResponse>>,
        ])

        const partial: Partial<SettingsState> = {}

        if (modelRes.success && modelRes.data?.value && VALID_MODELS.includes(modelRes.data.value)) {
          partial.selectedModel = modelRes.data.value as ModelId
        }
        if (presetRes.success && presetRes.data?.value && VALID_PRESETS.includes(presetRes.data.value)) {
          partial.budgetPreset = presetRes.data.value as SettingsState['budgetPreset']
        }
        if (customRes.success && customRes.data?.value) {
          const n = Number(customRes.data.value)
          if (!Number.isNaN(n) && n >= CUSTOM_BUDGET_MIN && n <= CUSTOM_BUDGET_MAX) {
            partial.customBudget = n
          }
        }
        if (visRes.success && visRes.data?.value && VALID_VISIBILITY.includes(visRes.data.value)) {
          partial.visibilityMode = visRes.data.value as VisibilityMode
        }

        if (Object.keys(partial).length > 0) {
          hydrate(partial)
        }
      } catch {
        // Best-effort hydration — defaults remain
      }
    }
    load()
  }, [hydrate])

  // ── Persist on change via subscribe ────────────────────────────
  useEffect(() => {
    if (!hasKairoApi()) return

    let prev = useSettingsStore.getState()

    const unsubscribe = useSettingsStore.subscribe((state) => {
      const api = getKairoApiOrThrow()

      if (state.selectedModel !== prev.selectedModel) {
        api.invoke(IPC_CHANNELS.SETTINGS_SET, { key: SETTINGS_KEYS.model, value: state.selectedModel }).catch(() => {})
      }
      if (state.budgetPreset !== prev.budgetPreset) {
        api.invoke(IPC_CHANNELS.SETTINGS_SET, { key: SETTINGS_KEYS.budgetPreset, value: state.budgetPreset }).catch(() => {})
      }
      if (state.customBudget !== prev.customBudget) {
        const val = state.customBudget !== undefined ? String(state.customBudget) : ''
        api.invoke(IPC_CHANNELS.SETTINGS_SET, { key: SETTINGS_KEYS.customBudget, value: val }).catch(() => {})
      }
      if (state.visibilityMode !== prev.visibilityMode) {
        api.invoke(IPC_CHANNELS.SETTINGS_SET, { key: SETTINGS_KEYS.visibilityMode, value: state.visibilityMode }).catch(() => {})
      }

      prev = state
    })

    return unsubscribe
  }, [])
}
