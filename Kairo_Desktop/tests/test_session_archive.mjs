/**
 * test_session_archive.mjs — Phase 4 Sprint B: Session Archive Integration Tests
 *
 * Tests the session:archive flow through the real Orchestrator + SessionPersistence.
 * Validates: requestArchive resets state, DB session archived, reason propagation.
 *
 * Run: node test_session_archive.mjs
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

// ─── Robust temp dir cleanup ────────────────────────────────

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

// ─── Build services ─────────────────────────────────────────

const buildDir = resolve(__dirname, '../.test-build')

// Build DatabaseService
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/database.service.ts')],
  bundle: true, platform: 'node', format: 'esm',
  outfile: join(buildDir, 'database.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

// Build SessionPersistenceService
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/session-persistence.service.ts')],
  bundle: true, platform: 'node', format: 'esm',
  outfile: join(buildDir, 'session-persistence.service.mjs'),
  external: ['better-sqlite3', 'node:crypto'],
  logLevel: 'silent',
})

// Build ProjectService (needed to create a project for session context)
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/project.service.ts')],
  bundle: true, platform: 'node', format: 'esm',
  outfile: join(buildDir, 'project.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

// ── Gateway + model-router shims for Orchestrator ────────────────────
const shimServicesDir = join(buildDir, 'shim-services')
mkdirSync(shimServicesDir, { recursive: true })
const shimCoreDir = join(buildDir, 'shim-core')
mkdirSync(shimCoreDir, { recursive: true })

writeFileSync(join(shimServicesDir, 'gemini-gateway.ts'), `
let initialized = true
export function initGeminiGateway(apiKey: string): void { initialized = true }
export function resetGeminiGateway(): void { initialized = false }
export function isInitialized(): boolean { return initialized }
export function isStreaming(): boolean { return false }
export async function generateContent(prompt: string, modelId: string) {
  return { text: 'mock-response', tokenCount: { prompt: 10, completion: 20, total: 30 } }
}
export async function countTokens(content: string, modelId: string): Promise<number> { return 10 }
export interface GeminiResponse { text: string; tokenCount: { prompt: number; completion: number; total: number } }
export interface StreamCallbacks { onChunk: (text: string) => void; onComplete: (response: GeminiResponse) => void; onError: (error: Error) => void }
export async function streamChatMessage(prompt: string, modelId: string, history: any[], callbacks: StreamCallbacks): Promise<void> {
  callbacks.onChunk('mock-response')
  callbacks.onComplete({ text: 'mock-response', tokenCount: { prompt: 10, completion: 20, total: 30 } })
}
export function abortActiveStream(): boolean { return false }
`)

writeFileSync(join(shimServicesDir, 'model-router.ts'), `
export function routeModel(context: string, userOverride?: string): string { return userOverride || 'gemini-2.0-flash' }
`)

// Patch orchestrator source: replace gateway/router imports with shim absolute paths
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

buildSync({
  entryPoints: [join(shimCoreDir, 'orchestrator.ts')],
  bundle: true, platform: 'node', format: 'esm',
  outfile: join(buildDir, 'orchestrator.mjs'),
  external: ['better-sqlite3', 'node:crypto', '@google/generative-ai'],
  logLevel: 'silent',
})

const { DatabaseService } = await import(pathToFileURL(join(buildDir, 'database.service.mjs')).href)
const { SessionPersistenceService } = await import(pathToFileURL(join(buildDir, 'session-persistence.service.mjs')).href)
const { ProjectService } = await import(pathToFileURL(join(buildDir, 'project.service.mjs')).href)
const { Orchestrator } = await import(pathToFileURL(join(buildDir, 'orchestrator.mjs')).href)

const tempDirs = []
function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `kairo-test-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

// ─── Test Cases ─────────────────────────────────────────────

console.log('\n=== Phase 4 Sprint B — Session Archive Integration Tests ===\n')

// ─── T01: requestArchive with no active session is safe ─────
console.log('--- T01: requestArchive with no active session ---')
{
  const tempDir = makeTempDir('t01')
  const dbService = new DatabaseService(tempDir)
  const sessionPersistence = new SessionPersistenceService(dbService.getDb())

  const orchestrator = new Orchestrator({ sessionPersistence })
  try {
    orchestrator.requestArchive('manual')
    passed++
    console.log('  PASS  T01a: requestArchive with no session does not throw')
  } catch (err) {
    failed++
    console.error(`  FAIL  T01a: requestArchive threw: ${err.message}`)
  }
  dbService.close()
}

// ─── T02: requestArchive archives active DB session ─────────
console.log('\n--- T02: requestArchive archives active session ---')
{
  const tempDir = makeTempDir('t02')
  const projectDir = makeTempDir('t02-proj')
  const dbService = new DatabaseService(tempDir)
  const db = dbService.getDb()
  const sessionPersistence = new SessionPersistenceService(db)
  const projectService = new ProjectService(db)

  const projResult = projectService.createProject('Archive Test', projectDir)
  assertEqual(projResult.success, true, 'T02a: project created')
  const projectId = projResult.data.project.id

  const orchestrator = new Orchestrator({ sessionPersistence })
  orchestrator.setActiveProject(projectId)

  await orchestrator.handleChatMessage({ content: 'hello' })

  const activeResult = sessionPersistence.getActiveSession(projectId)
  assertEqual(activeResult.success, true, 'T02b: active session exists before archive')
  assert(activeResult.data.session !== null, 'T02c: session record is non-null')
  const sessionId = activeResult.data.session.id

  orchestrator.requestArchive('manual')

  const raw = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
  assertEqual(raw.status, 'archived', 'T02d: session status is archived in DB')
  assertEqual(raw.cut_reason, 'manual', 'T02e: cut_reason is manual')
  assert(raw.ended_at !== null, 'T02f: ended_at is set')

  const afterResult = sessionPersistence.getActiveSession(projectId)
  if (afterResult.success && afterResult.data.session) {
    assert(afterResult.data.session.id !== sessionId, 'T02g: new session is different from archived one')
  } else {
    passed++
    console.log('  PASS  T02g: no active session after archive (expected)')
  }

  dbService.close()
}

// ─── T03: requestArchive with different CutReasons ──────────
console.log('\n--- T03: requestArchive with different reasons ---')
{
  const reasons = ['tokens', 'turns', 'manual', 'emergency']

  for (const reason of reasons) {
    const tempDir = makeTempDir(`t03-${reason}`)
    const projectDir = makeTempDir(`t03-proj-${reason}`)
    const dbService = new DatabaseService(tempDir)
    const db = dbService.getDb()
    const sessionPersistence = new SessionPersistenceService(db)
    const projectService = new ProjectService(db)

    const projResult = projectService.createProject(`Test ${reason}`, projectDir)
    const projectId = projResult.data.project.id

    const orchestrator = new Orchestrator({ sessionPersistence })
    orchestrator.setActiveProject(projectId)
    await orchestrator.handleChatMessage({ content: 'test' })

    const activeResult = sessionPersistence.getActiveSession(projectId)
    const sessionId = activeResult.data.session.id

    orchestrator.requestArchive(reason)

    const raw = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
    assertEqual(raw.cut_reason, reason, `T03-${reason}: cut_reason is ${reason}`)

    dbService.close()
  }
}

// ─── T04: Archive resets budgeter ───────────────────────────
console.log('\n--- T04: Archive resets budgeter ---')
{
  const tempDir = makeTempDir('t04')
  const projectDir = makeTempDir('t04-proj')
  const dbService = new DatabaseService(tempDir)
  const db = dbService.getDb()
  const sessionPersistence = new SessionPersistenceService(db)
  const projectService = new ProjectService(db)

  const projResult = projectService.createProject('Budget Test', projectDir)
  const projectId = projResult.data.project.id

  const orchestrator = new Orchestrator({ sessionPersistence, totalBudget: 200000 })
  orchestrator.setActiveProject(projectId)
  await orchestrator.handleChatMessage({ content: 'hello' })

  const budgetBefore = orchestrator.getTokenBudgetState()
  assert(budgetBefore.totalUsed > 0, 'T04a: budget has usage before archive')

  orchestrator.requestArchive('manual')

  const budgetAfter = orchestrator.getTokenBudgetState()
  assertEqual(budgetAfter.totalUsed, 0, 'T04b: budget totalUsed reset to 0 after archive')

  dbService.close()
}

// ─── T05: Archive resets session state ──────────────────────
console.log('\n--- T05: Archive resets session state ---')
{
  const tempDir = makeTempDir('t05')
  const projectDir = makeTempDir('t05-proj')
  const dbService = new DatabaseService(tempDir)
  const db = dbService.getDb()
  const sessionPersistence = new SessionPersistenceService(db)
  const projectService = new ProjectService(db)

  const projResult = projectService.createProject('Session Test', projectDir)
  const projectId = projResult.data.project.id

  const orchestrator = new Orchestrator({ sessionPersistence })
  orchestrator.setActiveProject(projectId)
  await orchestrator.handleChatMessage({ content: 'one' })
  await orchestrator.handleChatMessage({ content: 'two' })

  const sessionBefore = orchestrator.getSessionState()
  assertEqual(sessionBefore.turnCount, 2, 'T05a: turn count is 2 before archive')

  orchestrator.requestArchive('manual')

  const sessionAfter = orchestrator.getSessionState()
  assertEqual(sessionAfter.turnCount, 0, 'T05b: turn count reset to 0 after archive')

  dbService.close()
}

// ─── T06: IPC handler source cross-verification ─────────────
console.log('\n--- T06: IPC handler source verification ---')
{
  const indexSrc = readFileSync(resolve(__dirname, '../src/main/index.ts'), 'utf-8')
  assert(indexSrc.includes('SESSION_ARCHIVE'), 'T06a: index.ts registers SESSION_ARCHIVE')
  assert(indexSrc.includes('VALID_REASONS'), 'T06b: session:archive uses VALID_REASONS whitelist')
  assert(indexSrc.includes("orchestrator.requestArchive(reason)"), 'T06c: delegates to orchestrator')
  assert(indexSrc.includes('APP_SELECT_FOLDER'), 'T06d: index.ts registers APP_SELECT_FOLDER')
  assert(indexSrc.includes('showOpenDialog'), 'T06e: folder picker uses showOpenDialog')
  assert(indexSrc.includes("'openDirectory'"), 'T06f: folder picker requests directories only')
}

// ─── Cleanup ────────────────────────────────────────────────

for (const dir of tempDirs) {
  cleanupDir(dir)
}
cleanupDir(buildDir)

// ─── Summary ────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Session archive tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All session archive tests pass.\n')
  process.exit(0)
}
