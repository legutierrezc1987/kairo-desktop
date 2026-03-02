/**
 * test_hotfix_workspace_cwd.mjs — Hotfix 0.1.1: Workspace/CWD Binding
 *
 * Validates:
 * 1. TerminalService.updateWorkspacePath() changes sandbox for spawn/evaluate
 * 2. TerminalService.getWorkspacePath() reflects updates
 * 3. project.handlers PROJECT_CREATE fires onProjectLoaded callback
 * 4. APP_GET_CWD returns activeWorkspacePath (not process.cwd)
 * 5. Sandbox rejects spawns outside updated workspace
 *
 * Run: node tests/test_hotfix_workspace_cwd.mjs
 * Expected: All assertions PASS, exit 0
 */

import { strict as assert } from 'node:assert'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'src')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

// ── Helpers ──────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
  }
}

// ── Section 1: TerminalService workspace update (source-level) ──────

console.log('\n── Section 1: TerminalService.updateWorkspacePath / getWorkspacePath ──')

const termSvcSource = readFileSync(resolve(SRC, 'main/services/terminal.service.ts'), 'utf-8')

test('TerminalService has updateWorkspacePath method', () => {
  assert.ok(termSvcSource.includes('updateWorkspacePath(newPath: string): void'),
    'updateWorkspacePath method signature not found')
})

test('TerminalService has getWorkspacePath method', () => {
  assert.ok(termSvcSource.includes('getWorkspacePath(): string'),
    'getWorkspacePath method signature not found')
})

test('updateWorkspacePath sets this.workspacePath', () => {
  assert.ok(termSvcSource.includes('this.workspacePath = newPath'),
    'updateWorkspacePath does not assign newPath')
})

test('getWorkspacePath returns this.workspacePath', () => {
  assert.ok(termSvcSource.includes('return this.workspacePath'),
    'getWorkspacePath does not return this.workspacePath')
})

// ── Section 2: index.ts workspace binding ───────────────────────────

console.log('\n── Section 2: index.ts activeWorkspacePath binding ──')

const indexSource = readFileSync(resolve(SRC, 'main/index.ts'), 'utf-8')

test('index.ts declares activeWorkspacePath (mutable let)', () => {
  assert.ok(indexSource.includes('let activeWorkspacePath = process.cwd()'),
    'activeWorkspacePath declaration not found')
})

test('TerminalService initialized with activeWorkspacePath', () => {
  assert.ok(indexSource.includes('new TerminalService(broker, activeWorkspacePath)'),
    'TerminalService not initialized with activeWorkspacePath')
})

test('onProjectLoaded updates activeWorkspacePath', () => {
  assert.ok(indexSource.includes('activeWorkspacePath = folderPath'),
    'activeWorkspacePath not updated in onProjectLoaded')
})

test('onProjectLoaded calls terminalService.updateWorkspacePath', () => {
  assert.ok(indexSource.includes('terminalService.updateWorkspacePath(folderPath)'),
    'terminalService.updateWorkspacePath not called in onProjectLoaded')
})

test('APP_GET_CWD returns activeWorkspacePath (not process.cwd)', () => {
  // Must have activeWorkspacePath, must NOT have process.cwd() in the handler
  assert.ok(indexSource.includes('data: activeWorkspacePath'),
    'APP_GET_CWD does not return activeWorkspacePath')
  // Ensure process.cwd() is NOT in the APP_GET_CWD handler response
  const cwdHandlerMatch = indexSource.match(/APP_GET_CWD[\s\S]{0,300}/)
  assert.ok(cwdHandlerMatch, 'APP_GET_CWD handler not found')
  assert.ok(!cwdHandlerMatch[0].includes('data: process.cwd()'),
    'APP_GET_CWD still returns process.cwd()')
})

test('MemoryService initialized with activeWorkspacePath', () => {
  assert.ok(indexSource.includes('workspacePath: activeWorkspacePath'),
    'MemoryService not initialized with activeWorkspacePath')
})

// ── Section 3: project.handlers — CREATE fires onProjectLoaded ──────

console.log('\n── Section 3: project.handlers — CREATE fires onProjectLoaded ──')

const projectHandlersSource = readFileSync(resolve(SRC, 'main/ipc/project.handlers.ts'), 'utf-8')

test('PROJECT_CREATE calls onProjectLoaded on success', () => {
  // Find the PROJECT_CREATE handler section
  const createSection = projectHandlersSource.split('PROJECT_CREATE')[1]
  assert.ok(createSection, 'PROJECT_CREATE section not found')
  // It should call onProjectLoaded
  const beforeLoadSection = createSection.split('PROJECT_LIST')[0] || createSection.split('PROJECT_LOAD')[0]
  assert.ok(beforeLoadSection.includes('onProjectLoaded'),
    'onProjectLoaded not called in PROJECT_CREATE handler')
})

test('PROJECT_CREATE passes project id, folderPath, name to onProjectLoaded', () => {
  const createSection = projectHandlersSource.split('PROJECT_CREATE')[1]?.split('PROJECT_LIST')[0]
  assert.ok(createSection, 'PROJECT_CREATE section not extractable')
  assert.ok(createSection.includes('result.data.project.id'),
    'PROJECT_CREATE does not pass project.id')
  assert.ok(createSection.includes('data.folderPath'),
    'PROJECT_CREATE does not pass folderPath')
  assert.ok(createSection.includes('data.name'),
    'PROJECT_CREATE does not pass name')
})

test('PROJECT_LOAD still calls onProjectLoaded (regression check)', () => {
  const loadSection = projectHandlersSource.split('PROJECT_LOAD')[1]
  assert.ok(loadSection, 'PROJECT_LOAD section not found')
  assert.ok(loadSection.includes('onProjectLoaded'),
    'onProjectLoaded not called in PROJECT_LOAD handler')
})

// ── Section 4: TerminalPanel project-aware respawn ──────────────────

console.log('\n── Section 4: TerminalPanel project-aware respawn ──')

const termPanelSource = readFileSync(
  resolve(SRC, 'renderer/src/components/Terminal/TerminalPanel.tsx'), 'utf-8'
)

test('TerminalPanel imports useProjectStore', () => {
  assert.ok(termPanelSource.includes('useProjectStore'),
    'useProjectStore not imported in TerminalPanel')
})

test('TerminalPanel reads activeProject from store', () => {
  assert.ok(termPanelSource.includes('activeProject'),
    'activeProject not used in TerminalPanel')
})

test('TerminalPanel shows no-project message when no active project', () => {
  assert.ok(termPanelSource.includes('No project open'),
    'No-project guard message not found')
})

test('TerminalPanel uses activeProject.folderPath as cwd', () => {
  assert.ok(termPanelSource.includes('activeProject.folderPath'),
    'activeProject.folderPath not used as cwd')
})

test('TerminalPanel uses key={activeProject.id} for respawn on switch', () => {
  assert.ok(termPanelSource.includes('key={activeProject.id}'),
    'key={activeProject.id} not found — respawn on project switch broken')
})

test('TerminalPanel no longer calls APP_GET_CWD directly', () => {
  assert.ok(!termPanelSource.includes('APP_GET_CWD'),
    'TerminalPanel still calls APP_GET_CWD — should use projectStore instead')
})

test('TerminalPanel no longer uses useState for cwd', () => {
  // The old pattern had useState<string | null>(null) for cwd
  assert.ok(!termPanelSource.includes("useState<string | null>(null)"),
    'TerminalPanel still uses useState for cwd — should use projectStore')
})

// ── Section 5: Workspace sandbox functional test (esbuild) ──────────

console.log('\n── Section 5: Workspace sandbox functional validation ──')

// Build workspace-sandbox module
const shimDir = join(buildDir, 'shim-hotfix-cwd')
mkdirSync(shimDir, { recursive: true })

const mainDir = resolve(SRC, 'main').replace(/\\/g, '/')

writeFileSync(join(shimDir, 'entry.ts'), `
export { isInsideWorkspace, validateWorkspaceCwd } from '${mainDir}/execution/workspace-sandbox'
`)

buildSync({
  entryPoints: [join(shimDir, 'entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'sandbox.hotfix-cwd.mjs'),
  external: ['node:*'],
  logLevel: 'silent',
})

const sandbox = await import(pathToFileURL(join(buildDir, 'sandbox.hotfix-cwd.mjs')).href)

// Simulate workspace update scenario
const workspaceA = resolve(tmpdir(), 'kairo-test-ws-A')
const workspaceB = resolve(tmpdir(), 'kairo-test-ws-B')
const pathInsideA = join(workspaceA, 'subfolder')
const pathInsideB = join(workspaceB, 'subfolder')

test('validateWorkspaceCwd: path inside workspace A is valid', () => {
  const result = sandbox.validateWorkspaceCwd(pathInsideA, workspaceA)
  assert.strictEqual(result.valid, true)
})

test('validateWorkspaceCwd: path inside workspace B rejected by workspace A', () => {
  const result = sandbox.validateWorkspaceCwd(pathInsideB, workspaceA)
  assert.strictEqual(result.valid, false)
})

test('validateWorkspaceCwd: after "switching" workspace to B, path inside B is valid', () => {
  // Simulates what happens when terminalService.updateWorkspacePath(workspaceB) is called
  const result = sandbox.validateWorkspaceCwd(pathInsideB, workspaceB)
  assert.strictEqual(result.valid, true)
})

test('validateWorkspaceCwd: after "switching" workspace to B, path inside A is rejected', () => {
  const result = sandbox.validateWorkspaceCwd(pathInsideA, workspaceB)
  assert.strictEqual(result.valid, false)
})

test('isInsideWorkspace: exact workspace root is inside', () => {
  assert.strictEqual(sandbox.isInsideWorkspace(workspaceA, workspaceA), true)
})

test('isInsideWorkspace: parent of workspace is outside', () => {
  const parent = resolve(workspaceA, '..')
  assert.strictEqual(sandbox.isInsideWorkspace(parent, workspaceA), false)
})

// ── Section 6: IPC channel count invariant ──────────────────────────

console.log('\n── Section 6: IPC channel count invariant ──')

const channelsSource = readFileSync(resolve(SRC, 'shared/ipc-channels.ts'), 'utf-8')
const channelMatches = channelsSource.match(/:\s*'[a-z-]+:[a-z-]+'/g)

test('IPC channel count is 49 (no new channels added in hotfix)', () => {
  assert.ok(channelMatches, 'No channels found')
  assert.strictEqual(channelMatches.length, 49,
    `Expected 49 channels, got ${channelMatches.length}`)
})

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`)
console.log(`Hotfix 0.1.1 Workspace/CWD Binding: ${passed} passed, ${failed} failed`)
console.log(`${'─'.repeat(60)}\n`)

process.exit(failed > 0 ? 1 : 0)
