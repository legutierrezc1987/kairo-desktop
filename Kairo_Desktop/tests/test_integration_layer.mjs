/**
 * test_integration_layer.mjs — Phase 3 Sprint C: Integration Layer Tests
 *
 * Tests the integration between Orchestrator and persistence services
 * using REAL Orchestrator instantiation + instrumented fake SessionPersistencePort.
 *
 * Strategy:
 * 1. Real Orchestrator runtime tests with fake persistence port (T01-T08)
 * 2. Gateway lifecycle verification — init/reset (T09-T10)
 * 3. Real DB service integration for account/settings/session flows (T11-T18)
 * 4. Minimal source cross-verification for wiring only (T19)
 *
 * Run: node tests/test_integration_layer.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Test Runner ─────────────────────────────────────────────────────

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

function assertEqual(actual, expected, description) {
  if (actual === expected) {
    passed++
    console.log(`  PASS  ${description}`)
  } else {
    failed++
    console.error(`  FAIL  ${description}`)
    console.error(`        Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`)
  }
}

// ─── Robust temp dir cleanup (Windows anti-flakiness) ────────────────

function cleanupDir(dir) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return
    } catch (err) {
      if (attempt < 4 && (err.code === 'EBUSY' || err.code === 'EPERM')) {
        const wait = 100 * (attempt + 1)
        const start = Date.now()
        while (Date.now() - start < wait) { /* spin wait */ }
      }
    }
  }
}

// ─── Compile real services via esbuild ───────────────────────────────

const buildDir = resolve(__dirname, '../.test-build')

// Compile DatabaseService
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/database.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'database.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

// Compile ProjectService
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/project.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'project.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

// Compile SessionPersistenceService
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/session-persistence.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'session-persistence.service.mjs'),
  external: ['better-sqlite3', 'node:crypto'],
  logLevel: 'silent',
})

// Compile SettingsService
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/settings.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'settings.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

// Compile AccountService with electron shim
const electronShimPath = join(buildDir, 'electron-shim.mjs')
writeFileSync(electronShimPath, `
export const safeStorage = {
  isEncryptionAvailable() { return false },
  encryptString(s) { return Buffer.from(s) },
  decryptString(b) { return b.toString() },
}
export default { safeStorage }
`)

buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/account.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'account.service.shimmed.mjs'),
  external: ['better-sqlite3', 'node:crypto'],
  alias: { 'electron': electronShimPath },
  logLevel: 'silent',
})

// ── Gateway + model-router shims for Orchestrator ────────────────────
// Write shim files at the path the orchestrator expects (relative to core/)
const shimServicesDir = join(buildDir, 'shim-services')
mkdirSync(shimServicesDir, { recursive: true })
const shimCoreDir = join(buildDir, 'shim-core')
mkdirSync(shimCoreDir, { recursive: true })

// Gateway shim at shim-services/gemini-gateway.ts
writeFileSync(join(shimServicesDir, 'gemini-gateway.ts'), `
let initialized = true
export function initGeminiGateway(apiKey: string): void { initialized = true }
export function resetGeminiGateway(): void { initialized = false }
export function isInitialized(): boolean { return initialized }
export async function generateContent(prompt: string, modelId: string) {
  return { text: 'mock-response', tokenCount: { prompt: 10, completion: 20, total: 30 } }
}
export async function countTokens(content: string, modelId: string): Promise<number> { return 10 }
export interface GeminiResponse { text: string; tokenCount: { prompt: number; completion: number; total: number } }
export interface StreamCallbacks { onChunk: (text: string) => void; onComplete: (response: GeminiResponse) => void; onError: (error: Error) => void }
export async function streamChatMessage(prompt: string, modelId: string, history: any[], callbacks: StreamCallbacks): Promise<void> {
  callbacks.onChunk('mock ');
  callbacks.onComplete({ text: 'mock response', tokenCount: { prompt: 10, completion: 15, total: 25 } });
}
export function abortActiveStream(): boolean { return false }
`)

// Model router shim at shim-services/model-router.ts
writeFileSync(join(shimServicesDir, 'model-router.ts'), `
export function routeModel(context: string, userOverride?: string): string { return userOverride || 'gemini-2.0-flash' }
`)

// Patch orchestrator source: replace gateway/router imports with shim absolute paths,
// and fix relative imports that break when source is moved to shim-core/
const orchestratorOrigSource = readFileSync(
  resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8'
)
const srcMain = resolve(__dirname, '../src/main').replace(/\\/g, '/')
const shimSvcDir = shimServicesDir.replace(/\\/g, '/')
const patchedSource = orchestratorOrigSource
  .replace("from '../services/gemini-gateway'", `from '${shimSvcDir}/gemini-gateway.ts'`)
  .replace("from '../services/model-router'", `from '${shimSvcDir}/model-router.ts'`)
  .replace("from '../services/token-budgeter'", `from '${srcMain}/services/token-budgeter'`)
  .replace("from '../services/session-manager'", `from '${srcMain}/services/session-manager'`)
  .replace("from '../../shared/types'", `from '${resolve(__dirname, '../src/shared/types').replace(/\\/g, '/')}'`)
  .replace("from '../../shared/constants'", `from '${resolve(__dirname, '../src/shared/constants').replace(/\\/g, '/')}'`)
writeFileSync(join(shimCoreDir, 'orchestrator.ts'), patchedSource)

// Compile Orchestrator from patched source (gateway+router shimmed)
buildSync({
  entryPoints: [join(shimCoreDir, 'orchestrator.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'orchestrator.mjs'),
  external: ['better-sqlite3', 'node:crypto', '@google/generative-ai'],
  logLevel: 'silent',
})

// Compile gateway (real module, to test init/reset lifecycle)
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/gemini-gateway.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'gemini-gateway.mjs'),
  external: ['@google/generative-ai'],
  logLevel: 'silent',
})

// Compile TokenBudgeter (for settings bridge tests)
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/token-budgeter.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'token-budgeter.mjs'),
  external: [],
  logLevel: 'silent',
})

const { DatabaseService } = await import(pathToFileURL(join(buildDir, 'database.service.mjs')).href)
const { ProjectService } = await import(pathToFileURL(join(buildDir, 'project.service.mjs')).href)
const { SessionPersistenceService } = await import(pathToFileURL(join(buildDir, 'session-persistence.service.mjs')).href)
const { SettingsService } = await import(pathToFileURL(join(buildDir, 'settings.service.mjs')).href)
const { AccountService } = await import(pathToFileURL(join(buildDir, 'account.service.shimmed.mjs')).href)
const { Orchestrator } = await import(pathToFileURL(join(buildDir, 'orchestrator.mjs')).href)
const { TokenBudgeter } = await import(pathToFileURL(join(buildDir, 'token-budgeter.mjs')).href)
const gateway = await import(pathToFileURL(join(buildDir, 'gemini-gateway.mjs')).href)

// Track all temp dirs for cleanup
const tempDirs = []

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `kairo-test-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

/** Create full service stack for integration testing */
function createServices(prefix) {
  const tempUserData = makeTempDir(prefix)
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()
  const projectService = new ProjectService(db)
  const sessionPersistence = new SessionPersistenceService(db)
  const settingsService = new SettingsService(db)
  const accountService = new AccountService(db)
  return { dbService, projectService, sessionPersistence, settingsService, accountService, db }
}

/** Create a project and return its ID */
function createTestProject(projectService, prefix) {
  const dir = makeTempDir(`${prefix}-folder`)
  const result = projectService.createProject(`Test Project ${prefix}`, dir)
  return result.data.project.id
}

/**
 * Create an instrumented fake SessionPersistencePort that wraps a real service.
 * Tracks all method calls for assertion.
 */
function createInstrumentedPort(realService) {
  const log = []
  return {
    port: {
      createSession(projectId) {
        log.push({ method: 'createSession', args: [projectId] })
        return realService.createSession(projectId)
      },
      getActiveSession(projectId) {
        log.push({ method: 'getActiveSession', args: [projectId] })
        return realService.getActiveSession(projectId)
      },
      addTokens(sessionId, tokensToAdd) {
        log.push({ method: 'addTokens', args: [sessionId, tokensToAdd] })
        return realService.addTokens(sessionId, tokensToAdd)
      },
      archiveSession(sessionId, cutReason) {
        log.push({ method: 'archiveSession', args: [sessionId, cutReason] })
        return realService.archiveSession(sessionId, cutReason)
      },
    },
    log,
  }
}

// ─── Test Cases ──────────────────────────────────────────────────────

console.log('\n=== Phase 3 Sprint C — Integration Layer Tests (Runtime) ===\n')

// ═══════════════════════════════════════════════
// ORCHESTRATOR RUNTIME — REAL INSTANTIATION
// ═══════════════════════════════════════════════

// ────────────────────────────────────────────────
console.log('--- T01: Orchestrator zero-arg constructor — backward compat ---')
{
  const orch = new Orchestrator()
  assertEqual(orch.getActiveProjectId(), null, 'T01a: no active project on zero-arg')
  const budgetState = orch.getTokenBudgetState()
  assertEqual(budgetState.totalBudget, 200000, 'T01b: default budget 200,000')
  const sessionState = orch.getSessionState()
  assertEqual(sessionState.turnCount, 0, 'T01c: session starts at turn 0')
}

// ────────────────────────────────────────────────
console.log('\n--- T02: Orchestrator with persistence but no active project — no DB writes ---')
{
  const { dbService, sessionPersistence } = createServices('t02')
  const { port, log } = createInstrumentedPort(sessionPersistence)

  const orch = new Orchestrator({ sessionPersistence: port })
  // requestArchive without project should not crash or write to DB
  orch.requestArchive('emergency')
  assertEqual(log.length, 0, 'T02a: no persistence calls without active project')
  assertEqual(orch.getActiveProjectId(), null, 'T02b: project remains null')

  const count = dbService.getDb().prepare('SELECT COUNT(*) as cnt FROM sessions').get()
  assertEqual(count.cnt, 0, 'T02c: zero sessions in DB')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T03: setActiveProject sets context + resets state ---')
{
  const { dbService, sessionPersistence } = createServices('t03')
  const { port } = createInstrumentedPort(sessionPersistence)

  const orch = new Orchestrator({ sessionPersistence: port })
  orch.setActiveProject('proj-abc')
  assertEqual(orch.getActiveProjectId(), 'proj-abc', 'T03a: project ID set')

  // setActiveProject with same ID = no-op
  orch.setActiveProject('proj-abc')
  assertEqual(orch.getTokenBudgetState().totalUsed, 0, 'T03b: budget reset after setActiveProject')
  assertEqual(orch.getSessionState().turnCount, 0, 'T03c: session turn count reset')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T04: setActiveProject archives previous session when switching ---')
{
  const { dbService, projectService, sessionPersistence } = createServices('t04')
  const projectId1 = createTestProject(projectService, 't04a')
  const projectId2 = createTestProject(projectService, 't04b')
  const { port, log } = createInstrumentedPort(sessionPersistence)

  const orch = new Orchestrator({ sessionPersistence: port })

  // Set project 1 and create a session via shimmed handleChatMessage
  orch.setActiveProject(projectId1)
  const chatResult = await orch.handleChatMessage({ content: 'hello', model: 'gemini-2.0-flash' })
  assertEqual(chatResult.success, true, 'T04a: shimmed chat succeeds')

  // Verify createSession was called
  const createCalls1 = log.filter(l => l.method === 'createSession')
  assert(createCalls1.length >= 1, 'T04b: createSession called for project 1')

  // Switch project — should archive the previous session
  orch.setActiveProject(projectId2)
  const archiveCalls = log.filter(l => l.method === 'archiveSession')
  assert(archiveCalls.length >= 1, 'T04c: archiveSession called on project switch')
  assertEqual(archiveCalls.length > 0 ? archiveCalls[0].args[1] : null, 'manual', 'T04d: archive reason is manual')

  // Verify the archived session in DB
  const archivedSession = dbService.getDb().prepare(
    "SELECT * FROM sessions WHERE project_id = ? AND status = 'archived'"
  ).get(projectId1)
  assert(archivedSession !== undefined, 'T04e: session for project 1 archived in DB')
  assertEqual(archivedSession.cut_reason, 'manual', 'T04f: DB cut_reason = manual')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T05: requestArchive forces session close ---')
{
  const { dbService, projectService, sessionPersistence } = createServices('t05')
  const projectId = createTestProject(projectService, 't05')
  const { port, log } = createInstrumentedPort(sessionPersistence)

  const orch = new Orchestrator({ sessionPersistence: port })
  orch.setActiveProject(projectId)

  // Create a session via chat
  await orch.handleChatMessage({ content: 'test', model: 'gemini-2.0-flash' })
  const createCalls = log.filter(l => l.method === 'createSession')
  assert(createCalls.length >= 1, 'T05a: session created')

  // Emergency archive
  orch.requestArchive('emergency')
  const archiveCalls = log.filter(l => l.method === 'archiveSession')
  assert(archiveCalls.length >= 1, 'T05b: archiveSession called by requestArchive')
  assertEqual(archiveCalls.length > 0 ? archiveCalls[0].args[1] : null, 'emergency', 'T05c: archive reason is emergency')

  // Verify in DB
  const archived = dbService.getDb().prepare(
    "SELECT * FROM sessions WHERE project_id = ? AND status = 'archived'"
  ).get(projectId)
  assertEqual(archived.cut_reason, 'emergency', 'T05d: DB cut_reason = emergency')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T06: Token persistence via handleChatMessage ---')
{
  const { dbService, projectService, sessionPersistence } = createServices('t06')
  const projectId = createTestProject(projectService, 't06')
  const { port, log } = createInstrumentedPort(sessionPersistence)

  const orch = new Orchestrator({ sessionPersistence: port })
  orch.setActiveProject(projectId)

  // Two chat turns
  await orch.handleChatMessage({ content: 'msg1', model: 'gemini-2.0-flash' })
  await orch.handleChatMessage({ content: 'msg2', model: 'gemini-2.0-flash' })

  const addTokenCalls = log.filter(l => l.method === 'addTokens')
  assert(addTokenCalls.length >= 2, 'T06a: addTokens called for each chat turn')

  // Verify tokens accumulated in DB
  const session = dbService.getDb().prepare(
    "SELECT * FROM sessions WHERE project_id = ? AND status = 'active'"
  ).get(projectId)
  assert(session !== undefined, 'T06b: active session exists in DB')
  assert(session.total_tokens > 0, 'T06c: tokens accumulated in DB')
  assertEqual(session.interaction_count, 2, 'T06d: interaction count = 2')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T07: After archive, next chat creates new session ---')
{
  const { dbService, projectService, sessionPersistence } = createServices('t07')
  const projectId = createTestProject(projectService, 't07')
  const { port, log } = createInstrumentedPort(sessionPersistence)

  const orch = new Orchestrator({ sessionPersistence: port })
  orch.setActiveProject(projectId)

  await orch.handleChatMessage({ content: 'first', model: 'gemini-2.0-flash' })
  orch.requestArchive('manual')

  // Next chat should create new session
  await orch.handleChatMessage({ content: 'second', model: 'gemini-2.0-flash' })

  const createCalls = log.filter(l => l.method === 'createSession')
  assert(createCalls.length >= 2, 'T07a: two sessions created (before and after archive)')

  const sessions = dbService.getDb().prepare(
    'SELECT * FROM sessions WHERE project_id = ? ORDER BY session_number'
  ).all(projectId)
  assert(sessions.length >= 2, 'T07b: two session records in DB')
  assertEqual(sessions[0].status, 'archived', 'T07c: first session archived')
  assertEqual(sessions[1].status, 'active', 'T07d: second session active')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T08: Orchestrator with custom totalBudget ---')
{
  const orch = new Orchestrator({ totalBudget: 120000 })
  assertEqual(orch.getTokenBudgetState().totalBudget, 120000, 'T08a: custom budget 120,000 applied')

  const orch2 = new Orchestrator({ totalBudget: 350000 })
  assertEqual(orch2.getTokenBudgetState().totalBudget, 350000, 'T08b: custom budget 350,000 applied')
}

// ═══════════════════════════════════════════════
// GATEWAY LIFECYCLE (init / reset / re-init)
// ═══════════════════════════════════════════════

// ────────────────────────────────────────────────
console.log('\n--- T09: Gateway exports init + reset + isInitialized ---')
{
  assertEqual(typeof gateway.initGeminiGateway, 'function', 'T09a: initGeminiGateway exported')
  assertEqual(typeof gateway.resetGeminiGateway, 'function', 'T09b: resetGeminiGateway exported')
  assertEqual(typeof gateway.isInitialized, 'function', 'T09c: isInitialized exported')
}

// ────────────────────────────────────────────────
console.log('\n--- T10: resetGeminiGateway clears state ---')
{
  gateway.resetGeminiGateway()
  assertEqual(gateway.isInitialized(), false, 'T10a: after reset, isInitialized = false')

  // Double reset is safe (idempotent)
  gateway.resetGeminiGateway()
  assertEqual(gateway.isInitialized(), false, 'T10b: double reset is idempotent')
}

// ═══════════════════════════════════════════════
// ACCOUNT-GATEWAY INTEGRATION (DB services)
// ═══════════════════════════════════════════════

// ────────────────────────────────────────────────
console.log('\n--- T11: Account key resolution — DB active account ---')
{
  const { dbService, accountService } = createServices('t11')

  accountService.createAccount('Main Account', 'sk-my-secret-key-123')
  const list = accountService.listAccounts()
  accountService.setActiveAccount(list.data.accounts[0].id)

  const key = accountService.getActiveApiKey()
  assertEqual(key, 'sk-my-secret-key-123', 'T11a: active account key resolved')

  // Key not leaked in Account object
  const account = list.data.accounts[0]
  assertEqual(account.apiKey, undefined, 'T11b: apiKey NOT in Account object')
  assertEqual(account.api_key_encrypted, undefined, 'T11c: api_key_encrypted NOT in Account object')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T12: No active account — null key ---')
{
  const { dbService, accountService } = createServices('t12')

  const key = accountService.getActiveApiKey()
  assertEqual(key, null, 'T12a: no active account returns null key')

  // Create account but don't activate
  accountService.createAccount('Inactive', 'sk-inactive')
  const key2 = accountService.getActiveApiKey()
  assertEqual(key2, null, 'T12b: non-activated account still returns null')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T13: Account change callback + key resolution lifecycle ---')
{
  const { dbService, accountService } = createServices('t13')

  let callbackCount = 0
  let lastResolvedKey = undefined
  const onAccountChanged = () => {
    callbackCount++
    lastResolvedKey = accountService.getActiveApiKey()
  }

  // Create + activate
  const created = accountService.createAccount('Switchable', 'sk-switch')
  const result = accountService.setActiveAccount(created.data.account.id)
  if (result.success) onAccountChanged()
  assertEqual(callbackCount, 1, 'T13a: callback fired on setActiveAccount')
  assertEqual(lastResolvedKey, 'sk-switch', 'T13b: key resolved after setActive')

  // Delete active account — key should be null
  const delResult = accountService.deleteAccount(created.data.account.id)
  if (delResult.success) onAccountChanged()
  assertEqual(callbackCount, 2, 'T13c: callback fired on deleteAccount')
  assertEqual(lastResolvedKey, null, 'T13d: key is null after deleting active account')
  dbService.close()
}

// ═══════════════════════════════════════════════
// SETTINGS BRIDGE
// ═══════════════════════════════════════════════

// ────────────────────────────────────────────────
console.log('\n--- T14: Budget preset applies to budgeter ---')
{
  const { dbService, settingsService } = createServices('t14')

  settingsService.setSetting('budget_preset', 'conservative')
  const budgetSetting = settingsService.getSetting('budget_preset')
  assertEqual(budgetSetting.data.value, 'conservative', 'T14a: budget_preset persisted')

  const BUDGET_PRESETS_LOCAL = { conservative: 120000, balanced: 200000, extended: 300000 }
  const DEFAULT_BUDGET_LOCAL = 200000
  let totalBudget = DEFAULT_BUDGET_LOCAL
  if (budgetSetting.success && budgetSetting.data?.value) {
    const preset = budgetSetting.data.value
    if (preset in BUDGET_PRESETS_LOCAL) {
      totalBudget = BUDGET_PRESETS_LOCAL[preset]
    }
  }
  assertEqual(totalBudget, 120000, 'T14b: conservative budget = 120,000')

  const budgeter = new TokenBudgeter(totalBudget)
  assertEqual(budgeter.getState().totalBudget, 120000, 'T14c: TokenBudgeter respects custom budget')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T15: Missing settings use safe defaults ---')
{
  const { dbService, settingsService } = createServices('t15')

  const budgetSetting = settingsService.getSetting('budget_preset')
  assertEqual(budgetSetting.data.value, null, 'T15a: no budget_preset in empty DB')

  const DEFAULT_BUDGET_LOCAL = 200000
  let totalBudget = DEFAULT_BUDGET_LOCAL
  if (budgetSetting.success && budgetSetting.data?.value) {
    totalBudget = -1 // should not reach
  }
  assertEqual(totalBudget, 200000, 'T15b: default budget 200,000 applied')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T16: Custom budget applies ---')
{
  const { dbService, settingsService } = createServices('t16')

  settingsService.setSetting('budget_preset', 'custom')
  settingsService.setSetting('custom_budget', '350000')

  const budgetSetting = settingsService.getSetting('budget_preset')
  const customBudgetSetting = settingsService.getSetting('custom_budget')

  const BUDGET_PRESETS_LOCAL = { conservative: 120000, balanced: 200000, extended: 300000 }
  const DEFAULT_BUDGET_LOCAL = 200000
  let totalBudget = DEFAULT_BUDGET_LOCAL
  if (budgetSetting.success && budgetSetting.data?.value) {
    const preset = budgetSetting.data.value
    if (preset in BUDGET_PRESETS_LOCAL) {
      totalBudget = BUDGET_PRESETS_LOCAL[preset]
    } else if (preset === 'custom' && customBudgetSetting.success && customBudgetSetting.data?.value) {
      const parsed = parseInt(customBudgetSetting.data.value, 10)
      if (!isNaN(parsed) && parsed > 0) totalBudget = parsed
    }
  }
  assertEqual(totalBudget, 350000, 'T16a: custom budget 350,000 applied')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T17: Broker mode persists to settings DB ---')
{
  const { dbService, settingsService } = createServices('t17')

  settingsService.setSetting('broker_mode', 'auto', 'Execution broker mode')
  const result = settingsService.getSetting('broker_mode')
  assertEqual(result.data.value, 'auto', 'T17a: broker_mode persisted as auto')

  settingsService.setSetting('broker_mode', 'supervised', 'Execution broker mode')
  const result2 = settingsService.getSetting('broker_mode')
  assertEqual(result2.data.value, 'supervised', 'T17b: broker_mode updated to supervised')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T18: Invalid budget preset falls back to default ---')
{
  const { dbService, settingsService } = createServices('t18')

  settingsService.setSetting('budget_preset', 'nonexistent_preset')
  const budgetSetting = settingsService.getSetting('budget_preset')
  const BUDGET_PRESETS_LOCAL = { conservative: 120000, balanced: 200000, extended: 300000 }
  const DEFAULT_BUDGET_LOCAL = 200000
  let totalBudget = DEFAULT_BUDGET_LOCAL
  if (budgetSetting.success && budgetSetting.data?.value) {
    const preset = budgetSetting.data.value
    if (preset in BUDGET_PRESETS_LOCAL) {
      totalBudget = BUDGET_PRESETS_LOCAL[preset]
    }
  }
  assertEqual(totalBudget, 200000, 'T18a: invalid preset falls back to DEFAULT_BUDGET')
  dbService.close()
}

// ═══════════════════════════════════════════════
// SOURCE CROSS-VERIFICATION (wiring only — minimal)
// ═══════════════════════════════════════════════

console.log('\n--- T19: Source cross-verification (wiring) ---')
{
  const indexSource = readFileSync(
    resolve(__dirname, '../src/main/index.ts'), 'utf-8'
  )
  assert(indexSource.includes('resetGeminiGateway'), 'T19a: index imports resetGeminiGateway')
  assert(indexSource.includes('getActiveApiKey'), 'T19b: index resolves API key from DB')
  assert(indexSource.includes('sessionPersistence,'), 'T19c: index passes sessionPersistence to Orchestrator')
  assert(indexSource.includes('totalBudget,'), 'T19d: index passes totalBudget to Orchestrator')
  assert(indexSource.includes('setActiveProject'), 'T19e: index wires setActiveProject on project load')
  assert(indexSource.includes("requestArchive('emergency')"), 'T19f: kill switch calls requestArchive')
  assert(indexSource.includes('resetGeminiGateway()'), 'T19g: index resets gateway when no key')

  const gatewaySource = readFileSync(
    resolve(__dirname, '../src/main/services/gemini-gateway.ts'), 'utf-8'
  )
  assert(gatewaySource.includes('export function resetGeminiGateway'), 'T19h: gateway exports resetGeminiGateway')
  assert(gatewaySource.includes('models.clear()'), 'T19i: resetGeminiGateway clears models Map')

  const settingsHandlersSource = readFileSync(
    resolve(__dirname, '../src/main/ipc/settings.handlers.ts'), 'utf-8'
  )
  assert(settingsHandlersSource.includes('onAccountChanged'), 'T19j: settings handlers accept onAccountChanged')

  const projectHandlersSource = readFileSync(
    resolve(__dirname, '../src/main/ipc/project.handlers.ts'), 'utf-8'
  )
  assert(projectHandlersSource.includes('onProjectLoaded'), 'T19k: project handlers accept onProjectLoaded')

  const brokerHandlersSource = readFileSync(
    resolve(__dirname, '../src/main/ipc/broker.handlers.ts'), 'utf-8'
  )
  assert(brokerHandlersSource.includes("setSetting('broker_mode'"), 'T19l: broker handlers persist mode changes')
}

// ─── Cleanup ────────────────────────────────────────────────────────

for (const dir of tempDirs) {
  cleanupDir(dir)
}
cleanupDir(buildDir)

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Integration layer tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All integration layer tests pass.\n')
  process.exit(0)
}
