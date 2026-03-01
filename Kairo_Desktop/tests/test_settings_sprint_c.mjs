/**
 * test_settings_sprint_c.mjs — Phase 6 Sprint C: Settings Panel Completeness
 *
 * Source cross-verification for settings completeness:
 * 1. Shared types: VisibilityMode type exists in SettingsState
 * 2. Constants: CUSTOM_BUDGET_MIN, CUSTOM_BUDGET_MAX, BUDGET_PRESETS
 * 3. settingsStore: hydrate, customBudget, visibilityMode, all actions
 * 4. useSettings hook: hydration, persistence, subscribe pattern
 * 5. BudgetPresetSelector: preset options, custom budget input
 * 6. VisibilityToggle: concise/detailed toggle
 * 7. SettingsPanel: sectioned layout (accounts + budget + visibility)
 * 8. system-prompt.ts: buildSystemPrompt with visibilityMode param
 * 9. gemini-gateway.ts: streamChatMessage systemInstruction param
 * 10. orchestrator.ts: setVisibilityMode + system prompt injection
 * 11. settings.handlers.ts: onSettingChanged callback
 * 12. index.ts: visibility hydration + real-time propagation
 * 13. IPC channel count: still 45 (no new channels)
 *
 * Run: node tests/test_settings_sprint_c.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '../src')
const BUILD_DIR = resolve(__dirname, '../.test-build')

// ─── Test Runner ─────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition, description) {
  if (condition) {
    passed++
    console.log(`  PASS  ${description}`)
  } else {
    failed++
    console.error(`  FAIL  ${description}`)
  }
}

function readSrc(relativePath) {
  return readFileSync(resolve(SRC, relativePath), 'utf-8')
}

// ─── Build shared modules for testing ────────────────────────

mkdirSync(BUILD_DIR, { recursive: true })

buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'constants-settings.test.mjs'),
  logLevel: 'silent',
})

buildSync({
  entryPoints: [resolve(SRC, 'shared', 'ipc-channels.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'ipc-channels-settings.test.mjs'),
  logLevel: 'silent',
})

// Build system-prompt.ts (no electron dependency)
const systemPromptSrc = readFileSync(resolve(SRC, 'main', 'config', 'system-prompt.ts'), 'utf-8')
buildSync({
  entryPoints: [resolve(SRC, 'main', 'config', 'system-prompt.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(BUILD_DIR, 'system-prompt.test.mjs'),
  logLevel: 'silent',
})

const constantsMod = await import(pathToFileURL(join(BUILD_DIR, 'constants-settings.test.mjs')).href)
const ipcMod = await import(pathToFileURL(join(BUILD_DIR, 'ipc-channels-settings.test.mjs')).href)
const promptMod = await import(pathToFileURL(join(BUILD_DIR, 'system-prompt.test.mjs')).href)

const { BUDGET_PRESETS, CUSTOM_BUDGET_MIN, CUSTOM_BUDGET_MAX, DEFAULT_MODEL } = constantsMod
const { IPC_CHANNELS, IPC_CHANNEL_ALLOWLIST } = ipcMod
const { buildSystemPrompt } = promptMod

// ════════════════════════════════════════════════════════════════
// T1: Shared Types — VisibilityMode
// ════════════════════════════════════════════════════════════════

console.log('\n── T1: Shared Types ──')

const typesSource = readSrc('shared/types.ts')

assert(typesSource.includes("export type VisibilityMode = 'concise' | 'detailed'"),
  'T1a: VisibilityMode type exported as concise | detailed')

assert(typesSource.includes('visibilityMode: VisibilityMode'),
  'T1b: SettingsState includes visibilityMode field')

assert(/interface SettingsState[\s\S]*?visibilityMode/.test(typesSource),
  'T1c: visibilityMode is inside SettingsState interface')

assert(typesSource.includes("customBudget?: number"),
  'T1d: SettingsState includes optional customBudget field')

// ════════════════════════════════════════════════════════════════
// T2: Constants — Budget limits
// ════════════════════════════════════════════════════════════════

console.log('\n── T2: Constants ──')

assert(typeof BUDGET_PRESETS === 'object' && BUDGET_PRESETS !== null,
  'T2a: BUDGET_PRESETS is an object')

assert(BUDGET_PRESETS.conservative === 120_000,
  'T2b: conservative preset = 120K')

assert(BUDGET_PRESETS.balanced === 200_000,
  'T2c: balanced preset = 200K')

assert(BUDGET_PRESETS.extended === 300_000,
  'T2d: extended preset = 300K')

assert(CUSTOM_BUDGET_MIN === 50_000,
  'T2e: CUSTOM_BUDGET_MIN = 50K')

assert(CUSTOM_BUDGET_MAX === 1_000_000,
  'T2f: CUSTOM_BUDGET_MAX = 1M')

assert(typeof DEFAULT_MODEL === 'string' && DEFAULT_MODEL.includes('gemini'),
  'T2g: DEFAULT_MODEL is a Gemini model string')

// ════════════════════════════════════════════════════════════════
// T3: IPC Channels — count unchanged at 45
// ════════════════════════════════════════════════════════════════

console.log('\n── T3: IPC Channels ──')

const channels = Object.values(IPC_CHANNELS)
assert(channels.length === 49, `T3a: 49 channels total (got ${channels.length})`)

assert(channels.includes('settings:get'), 'T3b: SETTINGS_GET channel exists')
assert(channels.includes('settings:set'), 'T3c: SETTINGS_SET channel exists')

assert(IPC_CHANNEL_ALLOWLIST.length === 49,
  `T3d: allowlist has 49 entries (got ${IPC_CHANNEL_ALLOWLIST.length})`)

// ════════════════════════════════════════════════════════════════
// T4: settingsStore — shape and actions
// ════════════════════════════════════════════════════════════════

console.log('\n── T4: settingsStore ──')

const storeSource = readSrc('renderer/src/stores/settingsStore.ts')

assert(storeSource.includes("import { create } from 'zustand'"),
  'T4a: uses Zustand create')

assert(storeSource.includes('visibilityMode'),
  'T4b: store has visibilityMode state')

assert(storeSource.includes('customBudget'),
  'T4c: store has customBudget state')

assert(storeSource.includes('setVisibilityMode'),
  'T4d: store has setVisibilityMode action')

assert(storeSource.includes('setCustomBudget'),
  'T4e: store has setCustomBudget action')

assert(storeSource.includes('hydrate'),
  'T4f: store has hydrate action')

assert(/hydrate.*Partial.*SettingsState/.test(storeSource),
  'T4g: hydrate accepts Partial<SettingsState>')

assert(storeSource.includes("'detailed'"),
  'T4h: default visibilityMode is detailed')

assert(storeSource.includes("VisibilityMode"),
  'T4i: imports VisibilityMode type')

// ════════════════════════════════════════════════════════════════
// T5: useSettings hook — hydration + persistence
// ════════════════════════════════════════════════════════════════

console.log('\n── T5: useSettings hook ──')

const hookSource = readSrc('renderer/src/hooks/useSettings.ts')

assert(hookSource.includes('SETTINGS_GET'),
  'T5a: hook reads from SETTINGS_GET')

assert(hookSource.includes('SETTINGS_SET'),
  'T5b: hook writes to SETTINGS_SET')

assert(hookSource.includes('visibility_mode'),
  'T5c: hook uses visibility_mode setting key')

assert(hookSource.includes('selected_model'),
  'T5d: hook persists selected_model')

assert(hookSource.includes('budget_preset'),
  'T5e: hook persists budget_preset')

assert(hookSource.includes('custom_budget'),
  'T5f: hook persists custom_budget')

assert(hookSource.includes('hydrate'),
  'T5g: hook calls hydrate from store')

assert(hookSource.includes('subscribe'),
  'T5h: hook subscribes to store changes for persistence')

assert(hookSource.includes('Promise.all'),
  'T5i: hook loads all settings in parallel')

assert(hookSource.includes('CUSTOM_BUDGET_MIN') && hookSource.includes('CUSTOM_BUDGET_MAX'),
  'T5j: hook validates custom budget range')

assert(hookSource.includes("'concise'") && hookSource.includes("'detailed'"),
  'T5k: hook validates visibility mode values')

assert(hookSource.includes('normalizeModelId'),
  'T5l: hook uses normalizeModelId for model validation')

// ════════════════════════════════════════════════════════════════
// T6: BudgetPresetSelector component
// ════════════════════════════════════════════════════════════════

console.log('\n── T6: BudgetPresetSelector ──')

const budgetSource = readSrc('renderer/src/components/Settings/BudgetPresetSelector.tsx')

assert(budgetSource.includes('conservative'),
  'T6a: has conservative preset option')

assert(budgetSource.includes('balanced'),
  'T6b: has balanced preset option')

assert(budgetSource.includes('extended'),
  'T6c: has extended preset option')

assert(budgetSource.includes("'custom'"),
  'T6d: has custom preset option')

assert(budgetSource.includes('BUDGET_PRESETS'),
  'T6e: imports BUDGET_PRESETS')

assert(budgetSource.includes('CUSTOM_BUDGET_MIN') && budgetSource.includes('CUSTOM_BUDGET_MAX'),
  'T6f: imports custom budget limits')

assert(budgetSource.includes('setBudgetPreset'),
  'T6g: calls setBudgetPreset action')

assert(budgetSource.includes('setCustomBudget'),
  'T6h: calls setCustomBudget action')

assert(budgetSource.includes('<input'),
  'T6i: renders input for custom budget')

assert(budgetSource.includes('Math.max') && budgetSource.includes('Math.min'),
  'T6j: clamps custom budget value')

// ════════════════════════════════════════════════════════════════
// T7: VisibilityToggle component
// ════════════════════════════════════════════════════════════════

console.log('\n── T7: VisibilityToggle ──')

const visSource = readSrc('renderer/src/components/Settings/VisibilityToggle.tsx')

assert(visSource.includes("'concise'"),
  'T7a: has concise mode')

assert(visSource.includes("'detailed'"),
  'T7b: has detailed mode')

assert(visSource.includes('setVisibilityMode'),
  'T7c: calls setVisibilityMode action')

assert(visSource.includes('useSettingsStore'),
  'T7d: uses settingsStore')

assert(visSource.includes('Response Style') || visSource.includes('Concise') && visSource.includes('Detailed'),
  'T7e: renders mode labels')

assert(visSource.includes('VisibilityMode'),
  'T7f: imports VisibilityMode type')

assert(!visSource.includes('export {}'),
  'T7g: no longer an empty stub')

// ════════════════════════════════════════════════════════════════
// T8: SettingsPanel — sectioned layout
// ════════════════════════════════════════════════════════════════

console.log('\n── T8: SettingsPanel ──')

const panelSource = readSrc('renderer/src/components/Settings/SettingsPanel.tsx')

assert(panelSource.includes('AccountManager'),
  'T8a: includes AccountManager section')

assert(panelSource.includes('BudgetPresetSelector'),
  'T8b: includes BudgetPresetSelector section')

assert(panelSource.includes('VisibilityToggle'),
  'T8c: includes VisibilityToggle section')

assert(panelSource.includes("import AccountManager from './AccountManager'"),
  'T8d: imports AccountManager')

assert(panelSource.includes("import BudgetPresetSelector from './BudgetPresetSelector'"),
  'T8e: imports BudgetPresetSelector')

assert(panelSource.includes("import VisibilityToggle from './VisibilityToggle'"),
  'T8f: imports VisibilityToggle')

assert(panelSource.includes('Token Budget'),
  'T8g: has Token Budget section header')

assert(panelSource.includes('Response Style'),
  'T8h: has Response Style section header')

assert(panelSource.includes('Settings'),
  'T8i: has Settings title')

// ════════════════════════════════════════════════════════════════
// T9: system-prompt.ts — buildSystemPrompt with visibility
// ════════════════════════════════════════════════════════════════

console.log('\n── T9: buildSystemPrompt ──')

assert(typeof buildSystemPrompt === 'function',
  'T9a: buildSystemPrompt is exported')

// Call without visibility mode (backward compat)
const promptNoVis = buildSystemPrompt('TestProject', '', '')
assert(promptNoVis.includes('Kairo'),
  'T9b: prompt includes base Kairo identity')

assert(promptNoVis.includes('TestProject'),
  'T9c: prompt includes project name')

assert(!promptNoVis.includes('Response Style'),
  'T9d: no visibility section when mode not provided')

// Call with concise
const promptConcise = buildSystemPrompt('TestProject', '', '', 'concise')
assert(promptConcise.includes('Response Style'),
  'T9e: concise mode adds Response Style section')

assert(promptConcise.includes('concise') || promptConcise.includes('brevity'),
  'T9f: concise mode instructs brevity')

// Call with detailed
const promptDetailed = buildSystemPrompt('TestProject', '', '', 'detailed')
assert(promptDetailed.includes('Response Style'),
  'T9g: detailed mode adds Response Style section')

assert(promptDetailed.includes('detailed') || promptDetailed.includes('thorough'),
  'T9h: detailed mode instructs thoroughness')

// Ensure concise and detailed produce DIFFERENT prompts
assert(promptConcise !== promptDetailed,
  'T9i: concise and detailed produce different prompts')

// With recall + bridge
const promptFull = buildSystemPrompt('Proj', 'recall ctx', 'bridge ctx', 'concise')
assert(promptFull.includes('recall ctx'),
  'T9j: full prompt includes recall context')
assert(promptFull.includes('bridge ctx'),
  'T9k: full prompt includes bridge context')

const promptSrc = readSrc('main/config/system-prompt.ts')
assert(promptSrc.includes('VisibilityMode'),
  'T9l: source imports VisibilityMode type')

assert(promptSrc.includes('visibilityMode'),
  'T9m: parameter named visibilityMode')

// ════════════════════════════════════════════════════════════════
// T10: gemini-gateway.ts — systemInstruction param
// ════════════════════════════════════════════════════════════════

console.log('\n── T10: gemini-gateway ──')

const gatewaySrc = readSrc('main/services/gemini-gateway.ts')

assert(gatewaySrc.includes('systemInstruction'),
  'T10a: streamChatMessage has systemInstruction param')

assert(/systemInstruction\?.*string/.test(gatewaySrc),
  'T10b: systemInstruction is optional string')

assert(gatewaySrc.includes('chatParams'),
  'T10c: builds chatParams object')

assert(gatewaySrc.includes('startChat(chatParams)'),
  'T10d: passes chatParams to startChat')

// ════════════════════════════════════════════════════════════════
// T11: orchestrator.ts — visibility wiring
// ════════════════════════════════════════════════════════════════

console.log('\n── T11: orchestrator ──')

const orchSource = readSrc('main/core/orchestrator.ts')

assert(orchSource.includes('_visibilityMode'),
  'T11a: orchestrator has _visibilityMode property')

assert(orchSource.includes('setVisibilityMode'),
  'T11b: orchestrator has setVisibilityMode method')

assert(orchSource.includes("buildSystemPrompt(this.activeProjectName, '', '', this._visibilityMode)"),
  'T11c: streaming builds system prompt with visibility mode')

assert(/sysPrompt/.test(orchSource),
  'T11d: system prompt stored in sysPrompt variable')

assert(orchSource.includes("buildSystemPrompt(this.activeProjectName, recallContext, bridgeSummary, this._visibilityMode)"),
  'T11e: cut pipeline passes visibility mode to system prompt')

// ════════════════════════════════════════════════════════════════
// T12: settings.handlers.ts — onSettingChanged callback
// ════════════════════════════════════════════════════════════════

console.log('\n── T12: settings.handlers ──')

const handlersSource = readSrc('main/ipc/settings.handlers.ts')

assert(handlersSource.includes('onSettingChanged'),
  'T12a: handler accepts onSettingChanged callback')

assert(/onSettingChanged\?\.\(data\.key,\s*data\.value\)/.test(handlersSource),
  'T12b: SETTINGS_SET calls onSettingChanged on success')

// ════════════════════════════════════════════════════════════════
// T13: index.ts — visibility hydration + propagation
// ════════════════════════════════════════════════════════════════

console.log('\n── T13: index.ts wiring ──')

const indexSource = readSrc('main/index.ts')

assert(indexSource.includes("settingsService.getSetting('visibility_mode')"),
  'T13a: index.ts reads visibility_mode on startup')

assert(indexSource.includes('orchestrator.setVisibilityMode'),
  'T13b: index.ts sets orchestrator visibility mode')

assert(indexSource.includes('onSettingChanged') || indexSource.includes('key, value'),
  'T13c: index.ts passes onSettingChanged to registerSettingsHandlers')

assert(indexSource.includes("visibility_mode") && indexSource.includes("'concise'") && indexSource.includes("'detailed'"),
  'T13d: index.ts validates visibility_mode values')

// ════════════════════════════════════════════════════════════════
// T14: App.tsx — useSettings hook mounted
// ════════════════════════════════════════════════════════════════

console.log('\n── T14: App.tsx ──')

const appSource = readSrc('renderer/src/App.tsx')

assert(appSource.includes("import { useSettings }"),
  'T14a: App imports useSettings hook')

assert(appSource.includes('useSettings()'),
  'T14b: App calls useSettings()')

// ════════════════════════════════════════════════════════════════
// T15: ModelSelector persistence (via useSettings subscribe)
// ════════════════════════════════════════════════════════════════

console.log('\n── T15: ModelSelector ──')

const modelSelectorSrc = readSrc('renderer/src/components/Chat/ModelSelector.tsx')

assert(modelSelectorSrc.includes('useSettingsStore'),
  'T15a: ModelSelector uses settingsStore')

assert(modelSelectorSrc.includes('setModel'),
  'T15b: ModelSelector calls setModel which triggers persistence')

// ─── Summary ─────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`)
console.log(`Sprint C Settings: ${passed} passed, ${failed} failed`)
console.log(`${'═'.repeat(60)}`)

process.exit(failed > 0 ? 1 : 0)
