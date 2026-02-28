/**
 * test_renderer_sprint_b.mjs — Phase 4 Sprint B: Renderer Layer Tests
 *
 * Source cross-verification for stores, hooks, components, and wiring.
 * Validates structural integrity without requiring a DOM or Electron runtime.
 *
 * Run: node test_renderer_sprint_b.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '../src')

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

// ─── T01: projectStore ──────────────────────────────────────
console.log('\n=== Phase 4 Sprint B — Renderer Layer Tests ===\n')
console.log('--- T01: projectStore ---')
{
  const src = readSrc('renderer/src/stores/projectStore.ts')
  assert(src.includes("import { create } from 'zustand'"), 'T01a: imports zustand create')
  assert(src.includes("import type { Project }"), 'T01b: imports Project type')
  assert(src.includes('useProjectStore'), 'T01c: exports useProjectStore')
  assert(src.includes('projects: Project[]'), 'T01d: has projects array')
  assert(src.includes('activeProject: Project | null'), 'T01e: has activeProject')
  assert(src.includes('setProjects'), 'T01f: has setProjects action')
  assert(src.includes('setActiveProject'), 'T01g: has setActiveProject action')
  assert(src.includes('addProject'), 'T01h: has addProject action')
  assert(src.includes('isLoading: boolean'), 'T01i: has isLoading state')
  assert(src.includes('error: string | null'), 'T01j: has error state')
}

// ─── T02: sessionStore ──────────────────────────────────────
console.log('\n--- T02: sessionStore ---')
{
  const src = readSrc('renderer/src/stores/sessionStore.ts')
  assert(src.includes("import { create } from 'zustand'"), 'T02a: imports zustand create')
  assert(src.includes('SessionRecord'), 'T02b: references SessionRecord')
  assert(src.includes('SessionState'), 'T02c: references SessionState')
  assert(src.includes('TokenBudgetState'), 'T02d: references TokenBudgetState')
  assert(src.includes('useSessionStore'), 'T02e: exports useSessionStore')
  assert(src.includes('dbSession'), 'T02f: has dbSession field')
  assert(src.includes('sessionState'), 'T02g: has sessionState field')
  assert(src.includes('budgetState'), 'T02h: has budgetState field')
  assert(src.includes('isArchiving'), 'T02i: has isArchiving field')
}

// ─── T03: useProject hook ───────────────────────────────────
console.log('\n--- T03: useProject hook ---')
{
  const src = readSrc('renderer/src/hooks/useProject.ts')
  assert(src.includes('useCallback'), 'T03a: uses useCallback')
  assert(src.includes('useEffect'), 'T03b: uses useEffect')
  assert(src.includes('useProjectStore'), 'T03c: uses projectStore')
  assert(src.includes('PROJECT_LIST'), 'T03d: invokes PROJECT_LIST on mount')
  assert(src.includes('PROJECT_CREATE'), 'T03e: invokes PROJECT_CREATE')
  assert(src.includes('PROJECT_LOAD'), 'T03f: invokes PROJECT_LOAD')
  assert(src.includes('APP_SELECT_FOLDER'), 'T03g: invokes APP_SELECT_FOLDER')
  assert(src.includes('selectFolder'), 'T03h: exports selectFolder')
  assert(src.includes('createProject'), 'T03i: exports createProject')
  assert(src.includes('loadProject'), 'T03j: exports loadProject')
  assert(src.includes('getKairoApiOrThrow().invoke') || src.includes('getKairoApiOrThrow()'), 'T03k: uses IPC invoke bridge (via guard helper)')
}

// ─── T04: useSession hook ───────────────────────────────────
console.log('\n--- T04: useSession hook ---')
{
  const src = readSrc('renderer/src/hooks/useSession.ts')
  assert(src.includes('useCallback'), 'T04a: uses useCallback')
  assert(src.includes('useEffect'), 'T04b: uses useEffect')
  assert(src.includes('useSessionStore'), 'T04c: uses sessionStore')
  assert(src.includes('SESSION_GET_STATE'), 'T04d: polls SESSION_GET_STATE')
  assert(src.includes('TOKEN_GET_BUDGET'), 'T04e: polls TOKEN_GET_BUDGET')
  assert(src.includes('SESSION_ARCHIVE'), 'T04f: invokes SESSION_ARCHIVE')
  assert(src.includes('archiveSession'), 'T04g: exports archiveSession')
  assert(src.includes('setInterval'), 'T04h: uses polling interval')
  assert(src.includes('clearInterval'), 'T04i: clears interval on cleanup')
  assert(src.includes('CutReason'), 'T04j: references CutReason type')
}

// ─── T05: ProjectManager component ─────────────────────────
console.log('\n--- T05: ProjectManager component ---')
{
  const src = readSrc('renderer/src/components/Sidebar/ProjectManager.tsx')
  assert(src.includes('useProjectStore'), 'T05a: uses projectStore')
  assert(src.includes('useProject'), 'T05b: uses useProject hook')
  assert(src.includes('useState'), 'T05c: uses local state')
  assert(src.includes('handlePickFolder'), 'T05d: has folder picker handler')
  assert(src.includes('handleCreate'), 'T05e: has create handler')
  assert(src.includes('selectFolder'), 'T05f: uses selectFolder from hook')
  assert(src.includes('projects.map'), 'T05g: iterates projects list')
  assert(src.includes('loadProject'), 'T05h: calls loadProject on click')
  assert(src.includes("type=\"text\""), 'T05i: has text input fields')
  assert(src.includes('readOnly'), 'T05j: folder path input is readOnly')
}

// ─── T06: AccountManager component ──────────────────────────
console.log('\n--- T06: AccountManager component ---')
{
  const src = readSrc('renderer/src/components/Settings/AccountManager.tsx')
  assert(src.includes('ACCOUNT_LIST'), 'T06a: invokes ACCOUNT_LIST')
  assert(src.includes('ACCOUNT_CREATE'), 'T06b: invokes ACCOUNT_CREATE')
  assert(src.includes('ACCOUNT_SET_ACTIVE'), 'T06c: invokes ACCOUNT_SET_ACTIVE')
  assert(src.includes('ACCOUNT_DELETE'), 'T06d: invokes ACCOUNT_DELETE')
  assert(src.includes("type=\"password\""), 'T06e: API key input is password type')
  assert(src.includes('fetchAccounts'), 'T06f: has fetchAccounts function')
  assert(src.includes('accounts.map'), 'T06g: iterates accounts list')
}

// ─── T07: SettingsPanel component ───────────────────────────
console.log('\n--- T07: SettingsPanel component ---')
{
  const src = readSrc('renderer/src/components/Settings/SettingsPanel.tsx')
  assert(src.includes('AccountManager'), 'T07a: renders AccountManager')
  assert(src.includes('useState'), 'T07b: uses local state for open/close')
  assert(src.includes('isOpen'), 'T07c: has isOpen toggle')
  assert(src.includes('position: \'fixed\''), 'T07d: modal uses fixed positioning')
  assert(src.includes('zIndex: 1000'), 'T07e: modal has high z-index')
}

// ─── T08: StatusBar component ───────────────────────────────
console.log('\n--- T08: StatusBar component ---')
{
  const src = readSrc('renderer/src/components/Layout/StatusBar.tsx')
  assert(src.includes('useProjectStore'), 'T08a: uses projectStore')
  assert(src.includes('useSessionStore'), 'T08b: uses sessionStore')
  assert(src.includes('activeProject'), 'T08c: reads activeProject')
  assert(src.includes('sessionState'), 'T08d: reads sessionState')
  assert(src.includes('budgetState'), 'T08e: reads budgetState')
  assert(src.includes('usagePercent'), 'T08f: computes usage percentage')
  assert(src.includes('usageColor'), 'T08g: computes color based on usage')
}

// ─── T09: ConsolidateButton component ───────────────────────
console.log('\n--- T09: ConsolidateButton component ---')
{
  const src = readSrc('renderer/src/components/Chat/ConsolidateButton.tsx')
  assert(src.includes('useSession'), 'T09a: uses useSession hook')
  assert(src.includes('useSessionStore'), 'T09b: uses sessionStore')
  assert(src.includes('useProjectStore'), 'T09c: uses projectStore')
  assert(src.includes('archiveSession'), 'T09d: calls archiveSession')
  assert(src.includes("'manual'"), 'T09e: passes manual as reason')
  assert(src.includes('isArchiving'), 'T09f: reads isArchiving state')
  assert(src.includes('if (!activeProject) return null'), 'T09g: returns null when no project')
}

// ─── T10: RecallButton component ────────────────────────────
console.log('\n--- T10: RecallButton component ---')
{
  const src = readSrc('renderer/src/components/Chat/RecallButton.tsx')
  assert(src.includes('MEMORY_QUERY'), 'T10a: invokes MEMORY_QUERY')
  assert(src.includes('maxResults: 3'), 'T10b: requests max 3 results')
  assert(src.includes('useProjectStore'), 'T10c: uses projectStore')
  assert(src.includes('if (!activeProject) return null'), 'T10d: returns null when no project')
  assert(src.includes('MemoryResult'), 'T10e: references MemoryResult type')
  assert(src.includes('results.map'), 'T10f: iterates results')
  assert(src.includes('position: \'absolute\''), 'T10g: popover uses absolute positioning')
}

// ─── T11: MainLayout wiring ─────────────────────────────────
console.log('\n--- T11: MainLayout wiring ---')
{
  const src = readSrc('renderer/src/components/Layout/MainLayout.tsx')
  assert(src.includes('StatusBar'), 'T11a: imports StatusBar')
  assert(src.includes('SettingsPanel'), 'T11b: imports SettingsPanel')
  assert(src.includes('<StatusBar />'), 'T11c: renders StatusBar')
  assert(src.includes('<SettingsPanel />'), 'T11d: renders SettingsPanel')
  assert(src.includes('<ModeToggle />'), 'T11e: still renders ModeToggle')
  assert(src.includes('justifyContent: \'space-between\''), 'T11f: status bar is space-between')
}

// ─── T12: ChatPanel wiring ──────────────────────────────────
console.log('\n--- T12: ChatPanel wiring ---')
{
  const src = readSrc('renderer/src/components/Chat/ChatPanel.tsx')
  assert(src.includes('ConsolidateButton'), 'T12a: imports ConsolidateButton')
  assert(src.includes('RecallButton'), 'T12b: imports RecallButton')
  assert(src.includes('<ConsolidateButton />'), 'T12c: renders ConsolidateButton')
  assert(src.includes('<RecallButton />'), 'T12d: renders RecallButton')
  assert(src.includes('position: \'relative\''), 'T12e: container is relative (for RecallButton)')
}

// ─── T13: App.tsx wiring ────────────────────────────────────
console.log('\n--- T13: App.tsx wiring ---')
{
  const src = readSrc('renderer/src/App.tsx')
  assert(src.includes('useEffect'), 'T13a: uses useEffect for bootstrap')
  assert(src.includes('useProjectStore'), 'T13b: uses projectStore')
  assert(src.includes('SETTINGS_GET'), 'T13c: reads last_project_id setting')
  assert(src.includes('last_project_id'), 'T13d: references last_project_id key')
  assert(src.includes('PROJECT_LOAD'), 'T13e: loads project on restore')
  assert(src.includes('setActiveProject'), 'T13f: sets activeProject on restore')
}

// ─── T14: IPC channels updated ──────────────────────────────
console.log('\n--- T14: IPC channels ---')
{
  const src = readSrc('shared/ipc-channels.ts')
  assert(src.includes("SESSION_ARCHIVE: 'session:archive'"), 'T14a: SESSION_ARCHIVE channel exists')
  assert(src.includes("APP_SELECT_FOLDER: 'app:select-folder'"), 'T14b: APP_SELECT_FOLDER channel exists')

  // Count channels
  const channelPattern = /:\s*'([a-z][-a-z]*:[a-z][-a-z]*)'/g
  const channels = []
  let m
  while ((m = channelPattern.exec(src)) !== null) channels.push(m[1])
  assert(channels.length === 40, `T14c: 40 channels total (got ${channels.length})`)
}

// ─── T15: types.ts updated ──────────────────────────────────
console.log('\n--- T15: types.ts ---')
{
  const src = readSrc('shared/types.ts')
  assert(src.includes('SessionArchiveRequest'), 'T15a: SessionArchiveRequest type exists')
  assert(src.includes('SessionArchiveResponse'), 'T15b: SessionArchiveResponse type exists')
  assert(src.includes('SelectFolderResponse'), 'T15c: SelectFolderResponse type exists')
}

// ─── T16: index.ts backend wiring ───────────────────────────
console.log('\n--- T16: index.ts backend wiring ---')
{
  const src = readSrc('main/index.ts')
  assert(src.includes('SESSION_ARCHIVE'), 'T16a: registers SESSION_ARCHIVE handler')
  assert(src.includes('APP_SELECT_FOLDER'), 'T16b: registers APP_SELECT_FOLDER handler')
  assert(src.includes('dialog'), 'T16c: imports dialog from electron')
  assert(src.includes('showOpenDialog'), 'T16d: uses showOpenDialog for folder picker')
  assert(src.includes("'openDirectory'"), 'T16e: folder picker uses openDirectory property')
  assert(src.includes('requestArchive'), 'T16f: session:archive calls orchestrator.requestArchive')
  assert(src.includes('VALID_REASONS'), 'T16g: session:archive validates CutReason')
  assert(src.includes("CutReason"), 'T16h: imports CutReason type')
}

// ─── Summary ────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Renderer Sprint B tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All renderer Sprint B tests pass.\n')
  process.exit(0)
}
