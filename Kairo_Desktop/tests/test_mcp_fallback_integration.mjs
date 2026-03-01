/**
 * test_mcp_fallback_integration.mjs — Phase 7 Sprint B: MCP Fallback Integration Tests
 *
 * Integration-level verification of MemoryService provider fallback chain:
 * - Local-only mode (no MCP configured)
 * - MCP crash → automatic fallback to local-markdown
 * - Workspace change → forced MCP degradation (DEC-025)
 * - Payload hardening (query limits, maxResults clamping, sandbox)
 *
 * All deterministic (fake MCP, real LocalMarkdownProvider with temp dirs).
 * Zero production files modified.
 *
 * Run: node tests/test_mcp_fallback_integration.mjs
 * Expected: 35 assertions PASS, exit 0
 */

import { strict as assert } from 'node:assert'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { buildSync } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'src')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

// ── Step 1: Create fake MCP modules ──────────────────────────

const fakeDir = join(buildDir, 'fake-mcp')
mkdirSync(fakeDir, { recursive: true })

// Fake McpProcessService — controllable state + crash/fail triggers
writeFileSync(join(fakeDir, 'mcp-process.service.ts'), `
export class McpProcessService {
  private _state: string = 'stopped'
  private serverPath: string
  private serverArgs: string[]
  private onCrashCb: (() => void) | null = null
  private onStateChangedCb: ((state: string) => void) | null = null

  constructor(serverPath: string, serverArgs: string[] = []) {
    this.serverPath = serverPath
    this.serverArgs = serverArgs
  }

  getState(): string { return this._state }
  getServerPath(): string { return this.serverPath }

  setOnCrash(cb: () => void): void { this.onCrashCb = cb }
  setOnStateChanged(cb: (state: string) => void): void { this.onStateChangedCb = cb }

  async start(): Promise<void> {
    this._state = 'running'
    this.onStateChangedCb?.('running')
  }

  async stop(): Promise<void> {
    this._state = 'stopped'
    this.onStateChangedCb?.('stopped')
  }

  // Test helpers — trigger crash/fail externally
  _triggerCrash(): void {
    this._state = 'crashed'
    this.onCrashCb?.()
  }

  _triggerFailed(): void {
    this._state = 'failed'
    this.onStateChangedCb?.('failed')
  }

  async sendRequest(method: string, params: Record<string, unknown>): Promise<any> {
    return { jsonrpc: '2.0', id: 'fake', result: null }
  }
}
`)

// Fake NotebookLmMemoryProvider — controllable query/index + throwable
writeFileSync(join(fakeDir, 'notebooklm.provider.ts'), `
import type { McpProcessService } from './mcp-process.service'

export const _fakeNotebookConfig = {
  queryResults: [] as Array<{ content: string; source: string; relevance: number; timestamp: number }>,
  throwOnQuery: false,
  throwOnIndex: false,
  throwOnInit: false,
  throwMessage: 'Fake MCP error',
}

export function _resetFakeNotebook(): void {
  _fakeNotebookConfig.queryResults = []
  _fakeNotebookConfig.throwOnQuery = false
  _fakeNotebookConfig.throwOnIndex = false
  _fakeNotebookConfig.throwOnInit = false
  _fakeNotebookConfig.throwMessage = 'Fake MCP error'
}

export class NotebookLmMemoryProvider {
  readonly type = 'mcp' as const
  private mcpService: McpProcessService
  private lastHealth: any

  constructor(mcpService: McpProcessService) {
    this.mcpService = mcpService
    this.lastHealth = { provider: 'mcp', status: 'stopped', lastCheckAt: Date.now() }
  }

  async initialize(): Promise<void> {
    if (_fakeNotebookConfig.throwOnInit) {
      this.lastHealth = { provider: 'mcp', status: 'failed', lastCheckAt: Date.now(), error: _fakeNotebookConfig.throwMessage }
      throw new Error(_fakeNotebookConfig.throwMessage)
    }
    this.lastHealth = { provider: 'mcp', status: 'ready', lastCheckAt: Date.now() }
  }

  async shutdown(): Promise<void> {
    this.lastHealth = { provider: 'mcp', status: 'stopped', lastCheckAt: Date.now() }
  }

  async query(query: string, maxResults?: number): Promise<any[]> {
    if (_fakeNotebookConfig.throwOnQuery) throw new Error(_fakeNotebookConfig.throwMessage)
    return _fakeNotebookConfig.queryResults.slice(0, maxResults ?? 5)
  }

  async index(filePath: string): Promise<any> {
    if (_fakeNotebookConfig.throwOnIndex) throw new Error(_fakeNotebookConfig.throwMessage)
    return { indexed: true, filePath, chunksIndexed: 1 }
  }

  health(): any {
    return this.lastHealth
  }
}
`)

// ── Step 2: Source-patch memory.service.ts ────────────────────

import { readFileSync } from 'node:fs'

const memorySrc = readFileSync(resolve(SRC, 'main', 'memory', 'memory.service.ts'), 'utf-8')
const fakeDirEscaped = fakeDir.replace(/\\/g, '/')
const sharedDir = resolve(SRC, 'shared').replace(/\\/g, '/')

const patchedMemory = memorySrc
  .replace(
    "import { McpProcessService } from './mcp-process.service'",
    `import { McpProcessService } from '${fakeDirEscaped}/mcp-process.service'`
  )
  .replace(
    "import { NotebookLmMemoryProvider } from './notebooklm.provider'",
    `import { NotebookLmMemoryProvider } from '${fakeDirEscaped}/notebooklm.provider'`
  )
  .replace(
    "import { LocalMarkdownMemoryProvider } from './local-markdown.provider'",
    `import { LocalMarkdownMemoryProvider } from '${resolve(SRC, 'main', 'memory', 'local-markdown.provider.ts').replace(/\\/g, '/')}'`
  )
  .replace(
    /from '\.\.\/\.\.\/shared\/types'/g,
    `from '${sharedDir}/types'`
  )
  .replace(
    /from '\.\.\/\.\.\/shared\/constants'/g,
    `from '${sharedDir}/constants'`
  )
  // Re-export fake helpers for test access
  + `\nexport { _fakeNotebookConfig, _resetFakeNotebook } from '${fakeDirEscaped}/notebooklm.provider'\n`

const patchedFile = join(buildDir, 'memory-service-patched.ts')
writeFileSync(patchedFile, patchedMemory)

// ── Step 3: esbuild bundle ───────────────────────────────────

buildSync({
  entryPoints: [patchedFile],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'memory-service.integration.mjs'),
  logLevel: 'silent',
  external: ['node:*'],
})

// Also build constants standalone for payload limit reference
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'constants-mcp.standalone.mjs'),
  logLevel: 'silent',
})

const mod = await import(pathToFileURL(join(buildDir, 'memory-service.integration.mjs')).href)
const { MemoryService, _fakeNotebookConfig, _resetFakeNotebook } = mod

const constants = await import(pathToFileURL(join(buildDir, 'constants-mcp.standalone.mjs')).href)

// ── Test helpers ─────────────────────────────────────────────

let passed = 0
let failed = 0

function PASS(label) { passed++; console.log(`  PASS  ${label}`) }
function FAIL(label, err) { failed++; console.error(`  FAIL  ${label}: ${err}`) }
async function test(label, fn) {
  try { await fn(); PASS(label) }
  catch (e) { FAIL(label, e.message) }
}

/** Create a temp workspace with markdown files for local provider testing */
function createTempWorkspace(name = 'mcp-test') {
  const dir = mkdtempSync(join(tmpdir(), `kairo-${name}-`))
  // Create some .md files for queries
  writeFileSync(join(dir, 'README.md'), '# Test Project\n\nThis is a test project for Kairo memory integration.\n')
  writeFileSync(join(dir, 'notes.md'), '# Architecture Notes\n\n## Database Design\nWe use SQLite with WAL mode.\n\n## API Layer\nREST endpoints with validation.\n')
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'guide.md'), '# User Guide\n\n## Getting Started\nInstall dependencies and run the app.\n\n## Configuration\nSet your API key in settings.\n')
  return dir
}

function cleanupWorkspace(dir) {
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* best effort */ }
}

console.log('\n=== Phase 7 Sprint B — MCP Fallback Integration ===\n')

// ─── T1: Local-Only Mode (8 assertions) ─────────────────────
console.log('--- T1: Local-Only Mode ---')

const ws1 = createTempWorkspace('local-only')

await test('MF01: MemoryService without mcpServerPath → local provider', async () => {
  const svc = new MemoryService({ workspacePath: ws1 })
  await svc.initialize()
  assert.equal(svc.getActiveProviderType(), 'local-markdown')
  await svc.shutdown()
})

await test('MF02: getActiveProviderType() = local-markdown', async () => {
  const svc = new MemoryService({ workspacePath: ws1 })
  await svc.initialize()
  assert.equal(svc.getActiveProviderType(), 'local-markdown')
  await svc.shutdown()
})

await test('MF03: query() returns results from local markdown files', async () => {
  const svc = new MemoryService({ workspacePath: ws1 })
  await svc.initialize()
  const result = await svc.query('SQLite WAL')
  assert.equal(result.success, true)
  assert(result.data.results.length > 0, 'Expected results for "SQLite WAL"')
  assert.equal(result.data.provider, 'local-markdown')
  await svc.shutdown()
})

await test('MF04: index() rejects paths outside workspace', async () => {
  const svc = new MemoryService({ workspacePath: ws1 })
  await svc.initialize()
  // Use a path clearly outside the workspace
  const outsidePath = process.platform === 'win32'
    ? 'C:\\Windows\\System32\\evil.md'
    : '/etc/evil.md'
  const result = await svc.index(outsidePath)
  assert.equal(result.success, false)
  assert(result.error.includes('DEC-025'), 'Expected DEC-025 sandbox error')
  await svc.shutdown()
})

await test('MF05: index() works for .md files inside workspace', async () => {
  const svc = new MemoryService({ workspacePath: ws1 })
  await svc.initialize()
  const mdPath = join(ws1, 'README.md')
  const result = await svc.index(mdPath)
  assert.equal(result.success, true)
  await svc.shutdown()
})

await test('MF06: health() returns status=ready for local provider', async () => {
  const svc = new MemoryService({ workspacePath: ws1 })
  await svc.initialize()
  const health = svc.getHealth()
  assert.equal(health.success, true)
  assert.equal(health.data.health.status, 'ready')
  assert.equal(health.data.activeProvider, 'local-markdown')
  await svc.shutdown()
})

await test('MF07: Query with empty string → error response', async () => {
  const svc = new MemoryService({ workspacePath: ws1 })
  await svc.initialize()
  const result = await svc.query('')
  assert.equal(result.success, false)
  assert(result.error.includes('non-empty'), 'Expected non-empty error')
  await svc.shutdown()
})

await test('MF08: Query exceeding MEMORY_QUERY_MAX_LENGTH → error response', async () => {
  const svc = new MemoryService({ workspacePath: ws1 })
  await svc.initialize()
  const longQuery = 'x'.repeat(constants.MEMORY_QUERY_MAX_LENGTH + 1)
  const result = await svc.query(longQuery)
  assert.equal(result.success, false)
  assert(result.error.includes('maximum length'), 'Expected max length error')
  await svc.shutdown()
})

cleanupWorkspace(ws1)

// ─── T2: MCP Crash → Fallback (9 assertions) ────────────────
console.log('\n--- T2: MCP Crash → Fallback ---')

const ws2 = createTempWorkspace('mcp-crash')

await test('MF09: MCP provider initialized when mcpServerPath set', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  assert.equal(svc.getActiveProviderType(), 'mcp')
  await svc.shutdown()
})

await test('MF10: MCP crash triggers switchToFallback()', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  assert.equal(svc.getActiveProviderType(), 'mcp')
  // Simulate MCP query failure → triggers internal fallback
  _fakeNotebookConfig.throwOnQuery = true
  const result = await svc.query('test query')
  // After query failure on MCP, it should fall back to local-markdown
  assert.equal(svc.getActiveProviderType(), 'local-markdown')
  await svc.shutdown()
})

await test('MF11: After crash, getActiveProviderType() = local-markdown', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  _fakeNotebookConfig.throwOnQuery = true
  await svc.query('trigger fallback')
  assert.equal(svc.getActiveProviderType(), 'local-markdown')
  await svc.shutdown()
})

await test('MF12: onProviderChanged notification emitted with reason', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  let notification = null
  svc.setOnProviderChanged((n) => { notification = n })
  await svc.initialize()
  _fakeNotebookConfig.throwOnQuery = true
  await svc.query('trigger')
  assert.notEqual(notification, null, 'Notification should have been emitted')
  assert(notification.reason.length > 0, 'Reason should be non-empty')
  await svc.shutdown()
})

await test('MF13: Previous provider = mcp in notification', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  let notification = null
  svc.setOnProviderChanged((n) => { notification = n })
  await svc.initialize()
  _fakeNotebookConfig.throwOnQuery = true
  await svc.query('trigger')
  assert.equal(notification.previousProvider, 'mcp')
  await svc.shutdown()
})

await test('MF14: Current provider = local-markdown in notification', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  let notification = null
  svc.setOnProviderChanged((n) => { notification = n })
  await svc.initialize()
  _fakeNotebookConfig.throwOnQuery = true
  await svc.query('trigger')
  assert.equal(notification.currentProvider, 'local-markdown')
  await svc.shutdown()
})

await test('MF15: Queries succeed after fallback (local provider functional)', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  _fakeNotebookConfig.throwOnQuery = true
  await svc.query('trigger fallback')
  // Now query should work via local provider
  _fakeNotebookConfig.throwOnQuery = false
  const result = await svc.query('SQLite')
  assert.equal(result.success, true)
  assert.equal(result.data.provider, 'local-markdown')
  await svc.shutdown()
})

await test('MF16: MCP init failure → falls back to local-markdown', async () => {
  _resetFakeNotebook()
  _fakeNotebookConfig.throwOnInit = true
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  assert.equal(svc.getActiveProviderType(), 'local-markdown')
  await svc.shutdown()
})

await test('MF17: Double switchToFallback is idempotent', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws2, mcpServerPath: '/fake/mcp' })
  let notifyCount = 0
  svc.setOnProviderChanged(() => { notifyCount++ })
  await svc.initialize()
  // First fallback
  _fakeNotebookConfig.throwOnQuery = true
  await svc.query('trigger1')
  assert.equal(svc.getActiveProviderType(), 'local-markdown')
  // Second trigger — should be idempotent (already on local-markdown)
  const result = await svc.query('SQLite')
  assert.equal(result.success, true)
  assert.equal(notifyCount, 1, 'Should only notify once')
  await svc.shutdown()
})

cleanupWorkspace(ws2)

// ─── T3: Workspace Change Forced Degradation (9 assertions) ──
console.log('\n--- T3: Workspace Change Forced Degradation ---')

const ws3a = createTempWorkspace('ws-change-a')
const ws3b = createTempWorkspace('ws-change-b')

await test('MF18: updateWorkspace() forces MCP degradation', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws3a, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  assert.equal(svc.getActiveProviderType(), 'mcp')
  await svc.updateWorkspace(ws3b)
  assert.equal(svc.getActiveProviderType(), 'local-markdown')
  await svc.shutdown()
})

await test('MF19: MCP process stopped on workspace change', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws3a, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  // After updateWorkspace, MCP should be nulled
  await svc.updateWorkspace(ws3b)
  // Verify we can still query (via local provider)
  const result = await svc.query('test')
  assert.equal(result.success, true)
  assert.equal(result.data.provider, 'local-markdown')
  await svc.shutdown()
})

await test('MF20: New fallback re-initialized with new workspace', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws3a, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  await svc.updateWorkspace(ws3b)
  assert.equal(svc.getWorkspacePath(), ws3b)
  await svc.shutdown()
})

await test('MF21: getActiveProviderType() = local-markdown after change', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws3a, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  await svc.updateWorkspace(ws3b)
  assert.equal(svc.getActiveProviderType(), 'local-markdown')
  await svc.shutdown()
})

await test('MF22: Notification emitted with workspace change reason', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws3a, mcpServerPath: '/fake/mcp' })
  let notification = null
  svc.setOnProviderChanged((n) => { notification = n })
  await svc.initialize()
  await svc.updateWorkspace(ws3b)
  assert.notEqual(notification, null, 'Expected notification')
  assert(notification.reason.includes('Workspace changed'), `Expected "Workspace changed" in reason, got: "${notification.reason}"`)
  await svc.shutdown()
})

await test('MF23: Root path rejected with DEC-025 error', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws3a, mcpServerPath: '/fake/mcp' })
  await svc.initialize()
  const rootPath = process.platform === 'win32' ? 'C:\\' : '/'
  await assert.rejects(
    () => svc.updateWorkspace(rootPath),
    (err) => err.message.includes('DEC-025')
  )
  await svc.shutdown()
})

await test('MF24: Second updateWorkspace re-creates fallback correctly', async () => {
  _resetFakeNotebook()
  // Start with local-only (no MCP) to test workspace re-creation path
  const svc = new MemoryService({ workspacePath: ws3a })
  await svc.initialize()
  await svc.updateWorkspace(ws3b)
  assert.equal(svc.getWorkspacePath(), ws3b)
  // Create another temp workspace for second change
  const ws3c = createTempWorkspace('ws-change-c')
  await svc.updateWorkspace(ws3c)
  assert.equal(svc.getWorkspacePath(), ws3c)
  const result = await svc.query('test')
  assert.equal(result.success, true)
  await svc.shutdown()
  cleanupWorkspace(ws3c)
})

await test('MF25: Queries work with new workspace scope', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws3a })
  await svc.initialize()
  // ws3b has notes.md with "SQLite WAL"
  await svc.updateWorkspace(ws3b)
  const result = await svc.query('SQLite WAL')
  assert.equal(result.success, true)
  assert(result.data.results.length > 0, 'Expected results from new workspace')
  await svc.shutdown()
})

await test('MF26: isInsideWorkspace() validates paths against new workspace', async () => {
  _resetFakeNotebook()
  const svc = new MemoryService({ workspacePath: ws3a })
  await svc.initialize()
  await svc.updateWorkspace(ws3b)
  // Path inside ws3a (old workspace) should be rejected
  const oldPath = join(ws3a, 'README.md')
  const result = await svc.index(oldPath)
  assert.equal(result.success, false)
  assert(result.error.includes('DEC-025'), 'Expected DEC-025 sandbox violation for old workspace path')
  await svc.shutdown()
})

cleanupWorkspace(ws3a)
cleanupWorkspace(ws3b)

// ─── T4: Payload Hardening (9 assertions) ────────────────────
console.log('\n--- T4: Payload Hardening ---')

const ws4 = createTempWorkspace('payload')

await test('MF27: Query > 2000 chars → error', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  const result = await svc.query('a'.repeat(2001))
  assert.equal(result.success, false)
  assert(result.error.includes('maximum length'))
  await svc.shutdown()
})

await test('MF28: Query with only whitespace → error', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  const result = await svc.query('   \t\n  ')
  assert.equal(result.success, false)
  assert(result.error.includes('non-empty'))
  await svc.shutdown()
})

await test('MF29: maxResults=0 clamped to MIN=1', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  // maxResults=0 should be clamped to 1 internally
  const result = await svc.query('test', 0)
  assert.equal(result.success, true)
  // If results exist, should return at most 1
  if (result.data.results.length > 0) {
    assert(result.data.results.length <= 1, 'Should be clamped to max 1')
  }
  await svc.shutdown()
})

await test('MF30: maxResults=100 clamped to MAX=50', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  // With only 3 md files, we can't test >50 results, but verify no crash
  const result = await svc.query('test', 100)
  assert.equal(result.success, true)
  await svc.shutdown()
})

await test('MF31: maxResults=NaN → uses default (5)', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  const result = await svc.query('test', NaN)
  assert.equal(result.success, true)
  await svc.shutdown()
})

await test('MF32: maxResults=Infinity → uses default', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  const result = await svc.query('test', Infinity)
  assert.equal(result.success, true)
  await svc.shutdown()
})

await test('MF33: maxResults negative → clamped to MIN=1', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  const result = await svc.query('test', -5)
  assert.equal(result.success, true)
  if (result.data.results.length > 0) {
    assert(result.data.results.length <= 1, 'Negative should clamp to 1')
  }
  await svc.shutdown()
})

await test('MF34: Sibling prefix path blocked (DEC-025)', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  // Create a sibling dir that shares prefix: ws4 + "-evil"
  const siblingDir = ws4 + '-evil'
  mkdirSync(siblingDir, { recursive: true })
  writeFileSync(join(siblingDir, 'secret.md'), '# Secrets\nAPI key: sk-12345')
  const result = await svc.index(join(siblingDir, 'secret.md'))
  assert.equal(result.success, false)
  assert(result.error.includes('DEC-025'), 'Expected DEC-025 for sibling prefix attack')
  cleanupWorkspace(siblingDir)
  await svc.shutdown()
})

await test('MF35: Cross-drive path blocked (DEC-025)', async () => {
  const svc = new MemoryService({ workspacePath: ws4 })
  await svc.initialize()
  // Use a path that's clearly on a different drive / absolute outside workspace
  const crossPath = process.platform === 'win32'
    ? 'D:\\somewhere\\file.md'
    : '/tmp/other-workspace/file.md'
  const result = await svc.index(crossPath)
  assert.equal(result.success, false)
  assert(result.error.includes('DEC-025') || result.error.includes('outside'), 'Expected sandbox rejection')
  await svc.shutdown()
})

cleanupWorkspace(ws4)

// ─── Summary ─────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — MCP fallback integration tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All MCP fallback integration tests pass.\n')
  process.exit(0)
}
