/**
 * test_token_persistence.mjs — Phase 3 Sprint B: Session Persistence Tests
 *
 * Tests the REAL SessionPersistenceService + DatabaseService (compiled from TS via esbuild).
 * Validates: session CRUD, token accumulation, archive, FK constraints,
 * persistence proof, and session numbering.
 *
 * Run: node test_token_persistence.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
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

// Compile ProjectService (needed to create projects for FK)
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

const { DatabaseService } = await import(pathToFileURL(join(buildDir, 'database.service.mjs')).href)
const { ProjectService } = await import(pathToFileURL(join(buildDir, 'project.service.mjs')).href)
const { SessionPersistenceService } = await import(pathToFileURL(join(buildDir, 'session-persistence.service.mjs')).href)

// Track all temp dirs for cleanup
const tempDirs = []

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `kairo-test-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

/** Create a real DatabaseService + ProjectService + SessionPersistenceService */
function createServices(prefix) {
  const tempUserData = makeTempDir(prefix)
  const dbService = new DatabaseService(tempUserData)
  const projectService = new ProjectService(dbService.getDb())
  const sessionService = new SessionPersistenceService(dbService.getDb())
  return { dbService, projectService, sessionService, db: dbService.getDb() }
}

/** Create a project and return its ID (helper) */
function createTestProject(projectService, prefix) {
  const dir = makeTempDir(`${prefix}-folder`)
  const result = projectService.createProject(`Test Project ${prefix}`, dir)
  return result.data.project.id
}

// ─── Test Cases ──────────────────────────────────────────────────────

console.log('\n=== Phase 3 Sprint B — Session Persistence Tests ===\n')

// ────────────────────────────────────────────────
console.log('--- T01: Create session for project ---')
{
  const { dbService, projectService, sessionService } = createServices('t01')
  const projectId = createTestProject(projectService, 't01')

  const result = sessionService.createSession(projectId)
  assertEqual(result.success, true, 'T01a: createSession returns success=true')
  assert(result.data !== undefined, 'T01b: data is present')
  assertEqual(result.data.session.sessionNumber, 1, 'T01c: sessionNumber is 1')
  assertEqual(result.data.session.status, 'active', 'T01d: status is active')
  assertEqual(result.data.session.totalTokens, 0, 'T01e: totalTokens starts at 0')
  assertEqual(result.data.session.interactionCount, 0, 'T01f: interactionCount starts at 0')
  assertEqual(result.data.session.projectId, projectId, 'T01g: projectId matches')
  assert(result.data.session.id.length > 0, 'T01h: session id is non-empty UUID')
  assertEqual(result.data.session.cutReason, null, 'T01i: cutReason is null initially')
  assertEqual(result.data.session.endedAt, null, 'T01j: endedAt is null initially')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T02: Get active session ---')
{
  const { dbService, projectService, sessionService } = createServices('t02')
  const projectId = createTestProject(projectService, 't02')

  sessionService.createSession(projectId)
  const result = sessionService.getActiveSession(projectId)
  assertEqual(result.success, true, 'T02a: getActiveSession returns success=true')
  assert(result.data.session !== null, 'T02b: active session is not null')
  assertEqual(result.data.session.projectId, projectId, 'T02c: projectId matches')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T03: Add tokens ---')
{
  const { dbService, projectService, sessionService } = createServices('t03')
  const projectId = createTestProject(projectService, 't03')

  const created = sessionService.createSession(projectId)
  const sessionId = created.data.session.id

  const result = sessionService.addTokens(sessionId, 1500)
  assertEqual(result.success, true, 'T03a: addTokens returns success=true')
  assertEqual(result.data.session.totalTokens, 1500, 'T03b: totalTokens is 1500')
  assertEqual(result.data.session.interactionCount, 1, 'T03c: interactionCount incremented to 1')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T04: Archive session ---')
{
  const { dbService, projectService, sessionService } = createServices('t04')
  const projectId = createTestProject(projectService, 't04')

  const created = sessionService.createSession(projectId)
  const sessionId = created.data.session.id

  const result = sessionService.archiveSession(sessionId, 'tokens')
  assertEqual(result.success, true, 'T04a: archiveSession returns success=true')
  assertEqual(result.data.session.status, 'archived', 'T04b: status is archived')
  assertEqual(result.data.session.cutReason, 'tokens', 'T04c: cutReason is tokens')
  assert(result.data.session.endedAt !== null, 'T04d: endedAt is set')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T05: Create second session increments session number ---')
{
  const { dbService, projectService, sessionService } = createServices('t05')
  const projectId = createTestProject(projectService, 't05')

  const s1 = sessionService.createSession(projectId)
  sessionService.archiveSession(s1.data.session.id, 'manual')

  const s2 = sessionService.createSession(projectId)
  assertEqual(s2.data.session.sessionNumber, 2, 'T05a: second session has sessionNumber=2')
  assertEqual(s1.data.session.sessionNumber, 1, 'T05b: first session had sessionNumber=1')
  assertEqual(s2.data.session.status, 'active', 'T05c: second session is active')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T06: No active session for unknown project ---')
{
  const { dbService, sessionService } = createServices('t06')

  const result = sessionService.getActiveSession('nonexistent-project-id')
  assertEqual(result.success, true, 'T06a: getActiveSession succeeds even with unknown project')
  assertEqual(result.data.session, null, 'T06b: returns null for unknown project')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T07: Token accumulation across multiple addTokens calls ---')
{
  const { dbService, projectService, sessionService } = createServices('t07')
  const projectId = createTestProject(projectService, 't07')

  const created = sessionService.createSession(projectId)
  const sessionId = created.data.session.id

  sessionService.addTokens(sessionId, 500)
  sessionService.addTokens(sessionId, 750)
  const result = sessionService.addTokens(sessionId, 250)

  assertEqual(result.data.session.totalTokens, 1500, 'T07a: accumulated tokens = 500+750+250 = 1500')
  assertEqual(result.data.session.interactionCount, 3, 'T07b: interactionCount = 3')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T08: FK constraint — session for nonexistent project ---')
{
  const { dbService, sessionService } = createServices('t08')

  const result = sessionService.createSession('nonexistent-project-uuid')
  assertEqual(result.success, false, 'T08a: createSession fails for nonexistent project')
  assert(result.error.includes('Project not found') || result.error.includes('FOREIGN KEY'), 'T08b: error mentions FK/project issue')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T09: Persistence proof — session survives service re-instantiation ---')
{
  const tempUserData = makeTempDir('t09')
  const dbService = new DatabaseService(tempUserData)
  const projectService = new ProjectService(dbService.getDb())
  const sessionService1 = new SessionPersistenceService(dbService.getDb())

  const projectId = createTestProject(projectService, 't09')
  const created = sessionService1.createSession(projectId)
  const sessionId = created.data.session.id

  sessionService1.addTokens(sessionId, 5000)

  // Create a NEW SessionPersistenceService instance on the SAME DB
  const sessionService2 = new SessionPersistenceService(dbService.getDb())
  const result = sessionService2.getActiveSession(projectId)

  assertEqual(result.success, true, 'T09a: second instance finds session')
  assertEqual(result.data.session.id, sessionId, 'T09b: session ID matches across instances')
  assertEqual(result.data.session.totalTokens, 5000, 'T09c: totalTokens persisted across instances')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T10: Input validation edge cases ---')
{
  const { dbService, projectService, sessionService } = createServices('t10')
  const projectId = createTestProject(projectService, 't10')
  const created = sessionService.createSession(projectId)
  const sessionId = created.data.session.id

  const r1 = sessionService.createSession('')
  assertEqual(r1.success, false, 'T10a: empty projectId rejected')

  const r2 = sessionService.addTokens('', 100)
  assertEqual(r2.success, false, 'T10b: empty sessionId rejected for addTokens')

  const r3 = sessionService.addTokens(sessionId, -5)
  assertEqual(r3.success, false, 'T10c: negative tokensToAdd rejected')

  const r4 = sessionService.archiveSession('')
  assertEqual(r4.success, false, 'T10d: empty sessionId rejected for archiveSession')

  const r5 = sessionService.addTokens('nonexistent-id', 100)
  assertEqual(r5.success, false, 'T10e: addTokens for nonexistent session fails')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T11: Source cross-verification (complementary) ---')
{
  const source = readFileSync(
    resolve(__dirname, '../src/main/services/session-persistence.service.ts'), 'utf-8'
  )
  assert(source.includes('class SessionPersistenceService'), 'T11a: source has SessionPersistenceService class')
  assert(source.includes('createSession'), 'T11b: source has createSession method')
  assert(source.includes('getActiveSession'), 'T11c: source has getActiveSession method')
  assert(source.includes('addTokens'), 'T11d: source has addTokens method')
  assert(source.includes('archiveSession'), 'T11e: source has archiveSession method')
  assert(source.includes('FOREIGN KEY constraint failed'), 'T11f: source handles FK constraint')
  assert(source.includes('randomUUID'), 'T11g: source generates UUID')
  assert(source.includes('IpcResult'), 'T11h: source returns IpcResult envelope')
}

// ─── Cleanup ────────────────────────────────────────────────────────

for (const dir of tempDirs) {
  cleanupDir(dir)
}
cleanupDir(buildDir)

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Session persistence tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All session persistence tests pass.\n')
  process.exit(0)
}
