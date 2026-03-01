/**
 * test_project_state.mjs — Phase 3 Sprint A (Hardened): Project State Tests
 *
 * Tests the REAL ProjectService + DatabaseService (compiled from TS via esbuild).
 * Validates: CRUD operations, folder validation (realpathSync + accessSync),
 * duplicate rejection, invalid input handling, and real DB persistence.
 *
 * Run: node test_project_state.mjs
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

// Compile ProjectService (needs better-sqlite3 + node:* externals)
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/project.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'project.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

const { DatabaseService } = await import(pathToFileURL(join(buildDir, 'database.service.mjs')).href)
const { ProjectService } = await import(pathToFileURL(join(buildDir, 'project.service.mjs')).href)

// Track all temp dirs for cleanup
const tempDirs = []

function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), `kairo-test-${prefix}-`))
  tempDirs.push(dir)
  return dir
}

/** Create a real DatabaseService + ProjectService pair */
function createServices(prefix) {
  const tempUserData = makeTempDir(prefix)
  const dbService = new DatabaseService(tempUserData)
  const projectService = new ProjectService(dbService.getDb())
  return { dbService, projectService, db: dbService.getDb() }
}

// ─── Test Cases ──────────────────────────────────────────────────────

console.log('\n=== Phase 3 Sprint A (Hardened) — Project State Tests ===\n')

// ────────────────────────────────────────────────
console.log('--- T01: Create project with valid data (real service) ---')
{
  const { dbService, projectService } = createServices('t01')
  const dir = makeTempDir('t01-folder')

  const result = projectService.createProject('My Test Project', dir)
  assertEqual(result.success, true, 'T01a: create returns success=true')
  assert(result.data !== undefined, 'T01b: data is present')
  assertEqual(result.data.project.name, 'My Test Project', 'T01c: name matches')
  assertEqual(result.data.project.folderPath, resolve(dir), 'T01d: folderPath is canonical')
  assert(result.data.project.id.length > 0, 'T01e: id is non-empty UUID')
  assertEqual(result.data.project.model, 'gemini-2.5-flash', 'T01f: model has default value')
  assertEqual(result.data.project.tokenThresholdSoft, 150000, 'T01g: soft threshold default')
  assertEqual(result.data.project.tokenThresholdHard, 200000, 'T01h: hard threshold default')
  assertEqual(result.data.project.turnLimit, 40, 'T01i: turn limit default')
  assertEqual(result.data.project.agentMode, 'supervised', 'T01j: agent mode default')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T02: List projects returns created projects ---')
{
  const { dbService, projectService } = createServices('t02')
  const dir1 = makeTempDir('t02a-folder')
  const dir2 = makeTempDir('t02b-folder')

  projectService.createProject('Project A', dir1)
  projectService.createProject('Project B', dir2)

  const list = projectService.listProjects()
  assertEqual(list.success, true, 'T02a: listProjects succeeds')
  assertEqual(list.data.projects.length, 2, 'T02b: returns 2 projects')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T03: Load project by ID ---')
{
  const { dbService, projectService } = createServices('t03')
  const dir = makeTempDir('t03-folder')

  const created = projectService.createProject('Loadable', dir)
  const projectId = created.data.project.id

  const loaded = projectService.loadProject(projectId)
  assertEqual(loaded.success, true, 'T03a: loadProject succeeds')
  assertEqual(loaded.data.project.id, projectId, 'T03b: loaded id matches')
  assertEqual(loaded.data.project.name, 'Loadable', 'T03c: loaded name matches')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T04: Load nonexistent project returns error ---')
{
  const { dbService, projectService } = createServices('t04')

  const result = projectService.loadProject('nonexistent-uuid')
  assertEqual(result.success, false, 'T04a: load nonexistent fails')
  assert(result.error.includes('not found'), 'T04b: error mentions not found')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T05: Reject invalid folder (does not exist) ---')
{
  const { dbService, projectService } = createServices('t05')

  const result = projectService.createProject('Bad Path', '/this/path/does/not/exist/at/all')
  assertEqual(result.success, false, 'T05a: create with bad path fails')
  assert(
    result.error.includes('does not exist') || result.error.includes('not accessible'),
    'T05b: error mentions path issue'
  )
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T06: Reject empty name ---')
{
  const { dbService, projectService } = createServices('t06')
  const dir = makeTempDir('t06-folder')

  const result = projectService.createProject('   ', dir)
  assertEqual(result.success, false, 'T06a: create with whitespace-only name fails')
  assert(result.error.includes('non-empty'), 'T06b: error mentions non-empty')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T07: Reject duplicate folder_path ---')
{
  const { dbService, projectService } = createServices('t07')
  const dir = makeTempDir('t07-folder')

  projectService.createProject('First', dir)
  const result = projectService.createProject('Second', dir)
  assertEqual(result.success, false, 'T07a: duplicate folder path rejected')
  assert(result.error.includes('already exists'), 'T07b: error mentions already exists')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T08: Real DB persistence (data survives across queries) ---')
{
  const { dbService, projectService, db } = createServices('t08')
  const dir = makeTempDir('t08-folder')

  const created = projectService.createProject('Persistent', dir)
  const id = created.data.project.id

  const raw = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  assert(raw !== undefined, 'T08a: raw SQL finds the project')
  assertEqual(raw.name, 'Persistent', 'T08b: raw SQL shows correct name')
  assertEqual(raw.folder_path, resolve(dir), 'T08c: raw SQL shows canonical path')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T09: Load with invalid inputs ---')
{
  const { dbService, projectService } = createServices('t09')

  const r1 = projectService.loadProject('')
  assertEqual(r1.success, false, 'T09a: empty string projectId rejected')

  const r2 = projectService.loadProject(null)
  assertEqual(r2.success, false, 'T09b: null projectId rejected')

  const r3 = projectService.loadProject(undefined)
  assertEqual(r3.success, false, 'T09c: undefined projectId rejected')
  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T09b: Reject root path as project workspace ---')
{
  const { dbService, projectService } = createServices('t09b')

  // Windows root drives or Unix root
  const rootPaths = process.platform === 'win32'
    ? ['C:\\', 'D:\\']
    : ['/']

  for (const rootPath of rootPaths) {
    const result = projectService.createProject('Root Project', rootPath)
    assertEqual(result.success, false, `T09b-a: Root path "${rootPath}" rejected`)
    assert(
      result.error.includes('Root path is not allowed'),
      `T09b-b: Error mentions root path not allowed for "${rootPath}"`
    )
  }

  dbService.close()
}

// ────────────────────────────────────────────────
console.log('\n--- T10: Source cross-verification (complementary) ---')
{
  const projectServiceSource = readFileSync(
    resolve(__dirname, '../src/main/services/project.service.ts'), 'utf-8'
  )
  assert(projectServiceSource.includes('class ProjectService'), 'T10a: source has ProjectService class')
  assert(projectServiceSource.includes('createProject'), 'T10b: source has createProject method')
  assert(projectServiceSource.includes('listProjects'), 'T10c: source has listProjects method')
  assert(projectServiceSource.includes('loadProject'), 'T10d: source has loadProject method')
  assert(projectServiceSource.includes('realpathSync'), 'T10e: source uses realpathSync for canonicalization')
  assert(projectServiceSource.includes('accessSync'), 'T10f: source validates folder permissions with accessSync')
  assert(projectServiceSource.includes('constants.R_OK'), 'T10g: source checks R_OK permission')
  assert(projectServiceSource.includes('constants.W_OK') || projectServiceSource.includes('R_OK | constants.W_OK'), 'T10h: source checks W_OK permission')
  assert(projectServiceSource.includes('randomUUID'), 'T10i: source generates UUID')
  assert(projectServiceSource.includes('UNIQUE constraint'), 'T10j: source handles UNIQUE violation')
  assert(projectServiceSource.includes('IpcResult'), 'T10k: source returns IpcResult envelope')
  assert(projectServiceSource.includes('Root path is not allowed'), 'T10l: source rejects root paths')
  assert(projectServiceSource.includes("parse("), 'T10m: source uses parse() for root detection')
}

// ────────────────────────────────────────────────
console.log('\n--- T11: IPC handler source cross-verification ---')
{
  const handlerSource = readFileSync(
    resolve(__dirname, '../src/main/ipc/project.handlers.ts'), 'utf-8'
  )
  assert(handlerSource.includes('registerProjectHandlers'), 'T11a: handler exports registerProjectHandlers')
  assert(handlerSource.includes('PROJECT_CREATE'), 'T11b: handler registers PROJECT_CREATE channel')
  assert(handlerSource.includes('PROJECT_LIST'), 'T11c: handler registers PROJECT_LIST channel')
  assert(handlerSource.includes('PROJECT_LOAD'), 'T11d: handler registers PROJECT_LOAD channel')
  assert(handlerSource.includes('validateSender'), 'T11e: handler uses validateSender')
}

// ────────────────────────────────────────────────
console.log('\n--- T12: Main index.ts wiring verification ---')
{
  const indexSource = readFileSync(
    resolve(__dirname, '../src/main/index.ts'), 'utf-8'
  )
  assert(indexSource.includes('DatabaseService'), 'T12a: index imports DatabaseService')
  assert(indexSource.includes('ProjectService'), 'T12b: index imports ProjectService')
  assert(indexSource.includes('registerProjectHandlers'), 'T12c: index registers project handlers')
  assert(indexSource.includes('dbService.close()'), 'T12d: index closes DB on before-quit')
  assert(indexSource.includes("app.getPath('userData')"), 'T12e: index uses app.getPath for DB path')
}

// ─── Cleanup ────────────────────────────────────────────────────────

for (const dir of tempDirs) {
  cleanupDir(dir)
}
cleanupDir(buildDir)

// ─── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Project state tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All project state tests pass.\n')
  process.exit(0)
}
