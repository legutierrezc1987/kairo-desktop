/**
 * test_db_schema.mjs — Phase 3 Sprint A (Hardened): Database Schema Tests
 *
 * Tests the REAL DatabaseService (compiled from TS via esbuild).
 * Validates: 7 tables, FK enforcement, user_version, idempotent bootstrap,
 * column schema, indices, CHECK constraints, WAL mode.
 *
 * Run: node test_db_schema.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
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

// ─── Compile real DatabaseService via esbuild ────────────────────────
// Output inside project so Node can resolve better-sqlite3 from node_modules

const buildDir = resolve(__dirname, '../.test-build')
const outFile = join(buildDir, 'database.service.mjs')

buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/database.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: outFile,
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

const dbModuleUrl = pathToFileURL(outFile).href
const { DatabaseService } = await import(dbModuleUrl)

// Track all temp dirs for cleanup
const tempDirs = []

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `kairo-test-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

// ─── Test Cases ──────────────────────────────────────────────────────

console.log('\n=== Phase 3 Sprint A (Hardened) — Database Schema Tests ===\n')

// ────────────────────────────────────────────────
console.log('--- T01: All 7 tables created via real DatabaseService ---')
{
  const tempUserData = makeTempDir('t01')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map(r => r.name)

  const expected = ['accounts', 'command_log', 'messages', 'projects', 'sessions', 'settings', 'upload_queue']
  assertEqual(tables.length, 7, 'T01a: exactly 7 tables exist')
  assertEqual(JSON.stringify(tables), JSON.stringify(expected), 'T01b: table names match expected set')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T02: Foreign keys are active ---')
{
  const tempUserData = makeTempDir('t02')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const fkStatus = db.pragma('foreign_keys', { simple: true })
  assertEqual(fkStatus, 1, 'T02a: foreign_keys pragma is ON')

  let fkViolation = false
  try {
    db.prepare(
      "INSERT INTO sessions (id, project_id, session_number) VALUES ('s1', 'nonexistent', 1)"
    ).run()
  } catch (err) {
    fkViolation = err.message.includes('FOREIGN KEY constraint failed')
  }
  assert(fkViolation, 'T02b: FK constraint rejects invalid project_id')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T03: user_version is set correctly ---')
{
  const tempUserData = makeTempDir('t03')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const version = db.pragma('user_version', { simple: true })
  assertEqual(version, 1, 'T03: user_version is 1')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T04: Bootstrap is idempotent (re-open same DB) ---')
{
  const tempUserData = makeTempDir('t04')

  // First open — bootstraps schema
  const dbService1 = new DatabaseService(tempUserData)
  dbService1.close()

  // Second open — should skip bootstrap (user_version >= 1)
  let noError = true
  let dbService2
  try {
    dbService2 = new DatabaseService(tempUserData)
  } catch {
    noError = false
  }
  assert(noError, 'T04a: re-opening same DB does not throw')

  if (dbService2) {
    const tables = dbService2.getDb().prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all()
    assertEqual(tables.length, 7, 'T04b: still 7 tables after re-open')
    dbService2.close()
  }
}

// ────────────────────────────────────────────────
console.log('\n--- T05: Projects table columns ---')
{
  const tempUserData = makeTempDir('t05')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const columns = db.prepare("PRAGMA table_info('projects')").all().map(c => c.name)
  const expectedCols = [
    'id', 'name', 'folder_path', 'notebook_id', 'notebook_url',
    'model', 'token_threshold_soft', 'token_threshold_hard',
    'turn_limit', 'agent_mode', 'created_at', 'updated_at'
  ]
  assertEqual(columns.length, expectedCols.length, 'T05a: projects has correct column count (12)')
  for (const col of expectedCols) {
    assert(columns.includes(col), `T05b: projects has column "${col}"`)
  }
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T06: Sessions table has project_id FK ---')
{
  const tempUserData = makeTempDir('t06')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const fks = db.prepare("PRAGMA foreign_key_list('sessions')").all()
  const projectFk = fks.find(fk => fk.table === 'projects' && fk.from === 'project_id')
  assert(projectFk !== undefined, 'T06: sessions.project_id references projects')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T07: Messages table has session_id FK ---')
{
  const tempUserData = makeTempDir('t07')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const fks = db.prepare("PRAGMA foreign_key_list('messages')").all()
  const sessionFk = fks.find(fk => fk.table === 'sessions' && fk.from === 'session_id')
  assert(sessionFk !== undefined, 'T07: messages.session_id references sessions')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T08: Indices exist ---')
{
  const tempUserData = makeTempDir('t08')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const indices = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
  ).all().map(r => r.name)

  const expectedIndices = [
    'idx_sessions_project_id',
    'idx_messages_session_id',
    'idx_command_log_session_id',
    'idx_upload_queue_session_id',
    'idx_upload_queue_status',
    'idx_accounts_is_active',
  ]
  for (const idx of expectedIndices) {
    assert(indices.includes(idx), `T08: index "${idx}" exists`)
  }
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T09: folder_path UNIQUE constraint ---')
{
  const tempUserData = makeTempDir('t09')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  db.prepare(
    "INSERT INTO projects (id, name, folder_path) VALUES ('p1', 'Project A', '/path/a')"
  ).run()

  let uniqueViolation = false
  try {
    db.prepare(
      "INSERT INTO projects (id, name, folder_path) VALUES ('p2', 'Project B', '/path/a')"
    ).run()
  } catch (err) {
    uniqueViolation = err.message.includes('UNIQUE constraint failed')
  }
  assert(uniqueViolation, 'T09: folder_path UNIQUE constraint enforced')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T10: CHECK constraints on agent_mode ---')
{
  const tempUserData = makeTempDir('t10')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  db.prepare(
    "INSERT INTO projects (id, name, folder_path, agent_mode) VALUES ('p1', 'Test', '/path/1', 'supervised')"
  ).run()
  db.prepare(
    "INSERT INTO projects (id, name, folder_path, agent_mode) VALUES ('p2', 'Test2', '/path/2', 'auto')"
  ).run()

  let checkFailed = false
  try {
    db.prepare(
      "INSERT INTO projects (id, name, folder_path, agent_mode) VALUES ('p3', 'Test3', '/path/3', 'invalid')"
    ).run()
  } catch (err) {
    checkFailed = err.message.includes('CHECK constraint failed')
  }
  assert(checkFailed, 'T10: agent_mode CHECK constraint rejects invalid value')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T11: Additional FK tables ---')
{
  const tempUserData = makeTempDir('t11')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const clFks = db.prepare("PRAGMA foreign_key_list('command_log')").all()
  const clFk = clFks.find(fk => fk.table === 'sessions' && fk.from === 'session_id')
  assert(clFk !== undefined, 'T11a: command_log.session_id references sessions')

  const uqFks = db.prepare("PRAGMA foreign_key_list('upload_queue')").all()
  const uqFk = uqFks.find(fk => fk.table === 'sessions' && fk.from === 'session_id')
  assert(uqFk !== undefined, 'T11b: upload_queue.session_id references sessions')

  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T12: CHECK constraints on other tables ---')
{
  const tempUserData = makeTempDir('t12')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  db.prepare("INSERT INTO projects (id, name, folder_path) VALUES ('p1', 'Test', '/path/1')").run()
  db.prepare("INSERT INTO sessions (id, project_id, session_number) VALUES ('s1', 'p1', 1)").run()

  let roleCheckFailed = false
  try {
    db.prepare(
      "INSERT INTO messages (id, session_id, role, content) VALUES ('m1', 's1', 'invalid_role', 'test')"
    ).run()
  } catch {
    roleCheckFailed = true
  }
  assert(roleCheckFailed, 'T12a: messages.role CHECK constraint enforced')

  let zoneCheckFailed = false
  try {
    db.prepare(
      "INSERT INTO command_log (id, session_id, command, zone, mode, user_action) VALUES ('c1', 's1', 'ls', 'purple', 'supervised', 'auto')"
    ).run()
  } catch {
    zoneCheckFailed = true
  }
  assert(zoneCheckFailed, 'T12b: command_log.zone CHECK constraint enforced')

  let activeCheckFailed = false
  try {
    db.prepare(
      "INSERT INTO accounts (id, label, api_key_encrypted, is_active) VALUES ('a1', 'Test', 'enc', 5)"
    ).run()
  } catch {
    activeCheckFailed = true
  }
  assert(activeCheckFailed, 'T12c: accounts.is_active CHECK constraint enforced')

  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T13: WAL journal mode ---')
{
  const tempUserData = makeTempDir('t13')
  const dbService = new DatabaseService(tempUserData)
  const db = dbService.getDb()

  const journalMode = db.pragma('journal_mode', { simple: true })
  assertEqual(journalMode, 'wal', 'T13: journal_mode is WAL')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T14: Source cross-verification (complementary) ---')
{
  const dbServiceSource = readFileSync(
    resolve(__dirname, '../src/main/services/database.service.ts'), 'utf-8'
  )
  assert(dbServiceSource.includes('SCHEMA_VERSION = 1'), 'T14a: source has SCHEMA_VERSION = 1')
  assert(dbServiceSource.includes("pragma('foreign_keys = ON')"), 'T14b: source sets foreign_keys ON')
  assert(dbServiceSource.includes("pragma('journal_mode = WAL')"), 'T14c: source sets WAL mode')
  assert(dbServiceSource.includes("pragma('synchronous = NORMAL')"), 'T14d: source sets synchronous NORMAL')
  assert(dbServiceSource.includes("pragma('user_version"), 'T14e: source manages user_version')
  assert(dbServiceSource.includes('class DatabaseService'), 'T14f: source exports DatabaseService class')
  assert(dbServiceSource.includes('getDb()'), 'T14g: source has getDb() method')
  assert(dbServiceSource.includes('close()'), 'T14h: source has close() method')
}

// ─── Cleanup ────────────────────────────────────────────────────────

for (const dir of tempDirs) {
  cleanupDir(dir)
}
cleanupDir(buildDir)

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Database schema tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All database schema tests pass.\n')
  process.exit(0)
}
