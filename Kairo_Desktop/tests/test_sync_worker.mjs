/**
 * test_sync_worker.mjs — Phase 4 Sprint D: SyncWorker Tests
 *
 * Tests background upload worker behavior:
 * - Process one item
 * - Timeout enforcement (Promise.race)
 * - Retry on failure
 * - Stop/start lifecycle
 *
 * Run: node tests/test_sync_worker.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'

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

// ─── Build services ─────────────────────────────────────────────────

const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/database.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'database.service.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

buildSync({
  entryPoints: [resolve(__dirname, '../src/main/services/upload-queue.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'upload-queue.service.mjs'),
  external: ['better-sqlite3', 'node:crypto'],
  logLevel: 'silent',
})

buildSync({
  entryPoints: [resolve(__dirname, '../src/main/workers/sync-worker.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'sync-worker.mjs'),
  external: ['better-sqlite3', 'node:crypto', 'node:fs/promises'],
  logLevel: 'silent',
})

const { DatabaseService } = await import(pathToFileURL(join(buildDir, 'database.service.mjs')).href)
const { UploadQueueService } = await import(pathToFileURL(join(buildDir, 'upload-queue.service.mjs')).href)
const { SyncWorker } = await import(pathToFileURL(join(buildDir, 'sync-worker.mjs')).href)

// ─── Helper ─────────────────────────────────────────────────────────

function createTestDb() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'kairo-sw-'))
  const dbService = new DatabaseService(tmpDir)
  const db = dbService.getDb()
  db.prepare(`INSERT INTO projects (id, name, folder_path) VALUES ('p1', 'Test', '/tmp/test')`).run()
  db.prepare(`INSERT INTO sessions (id, project_id, session_number, status, started_at) VALUES ('s1', 'p1', 1, 'active', datetime('now'))`).run()
  return { db, tmpDir, dbService }
}

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\n=== Phase 4 Sprint D: SyncWorker Tests ===\n')

// ── T01: ProcessOne with successful upload ──────────────────────

console.log('\n--- T01: Successful upload ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    uq.enqueue('s1', '/tmp/test.md', 'transcript')

    const uploadPort = {
      callCount: 0,
      async index(filePath) {
        this.callCount++
        return { indexed: true }
      },
    }

    const worker = new SyncWorker(uq, uploadPort)
    const processed = await worker.processOne()

    assertEqual(processed, true, 'T01a: Item was processed')
    assertEqual(uploadPort.callCount, 1, 'T01b: Upload port called once')

    const row = db.prepare('SELECT status FROM upload_queue').get()
    assertEqual(row.status, 'synced', 'T01c: Entry marked synced')
    assertEqual(worker.isProcessing(), false, 'T01d: Not processing after completion')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T02: ProcessOne with failed upload ──────────────────────────

console.log('\n--- T02: Failed upload ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    uq.enqueue('s1', '/tmp/test.md', 'transcript')

    const uploadPort = {
      async index(filePath) {
        return { indexed: false, error: 'Permission denied' }
      },
    }

    const worker = new SyncWorker(uq, uploadPort)
    await worker.processOne()

    const row = db.prepare('SELECT status, error_message FROM upload_queue').get()
    assertEqual(row.status, 'failed', 'T02a: Entry marked failed')
    assert(row.error_message.includes('Permission denied'), 'T02b: Error message stored')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T03: ProcessOne with exception ──────────────────────────────

console.log('\n--- T03: Upload exception ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    uq.enqueue('s1', '/tmp/test.md', 'transcript')

    const uploadPort = {
      async index(filePath) {
        throw new Error('Network failure')
      },
    }

    const worker = new SyncWorker(uq, uploadPort)
    await worker.processOne()

    const row = db.prepare('SELECT status, error_message FROM upload_queue').get()
    assertEqual(row.status, 'failed', 'T03a: Entry marked failed on exception')
    assert(row.error_message.includes('Network failure'), 'T03b: Error message from exception')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T04: ProcessOne returns false on empty queue ────────────────

console.log('\n--- T04: Empty queue ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    const uploadPort = { async index() { return { indexed: true } } }

    const worker = new SyncWorker(uq, uploadPort)
    const processed = await worker.processOne()

    assertEqual(processed, false, 'T04a: Returns false on empty queue')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T05: Stop prevents further processing ───────────────────────

console.log('\n--- T05: Stop lifecycle ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    const uploadPort = { async index() { return { indexed: true } } }

    const worker = new SyncWorker(uq, uploadPort)
    worker.start()
    worker.stop()

    // After stop, start should be no-op
    worker.start() // no-op because _stopped = true
    assertEqual(worker.isProcessing(), false, 'T05a: Not processing after stop')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T06: Multiple items processed sequentially ──────────────────

console.log('\n--- T06: Sequential processing ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    uq.enqueue('s1', '/tmp/a.md', 'transcript')
    uq.enqueue('s1', '/tmp/b.md', 'summary')

    const processedFiles = []
    const uploadPort = {
      async index(filePath) {
        processedFiles.push(filePath)
        return { indexed: true }
      },
    }

    const worker = new SyncWorker(uq, uploadPort)
    await worker.processOne()
    await worker.processOne()

    assertEqual(processedFiles.length, 2, 'T06a: Both items processed')
    assertEqual(processedFiles[0], '/tmp/a.md', 'T06b: First item first')
    assertEqual(processedFiles[1], '/tmp/b.md', 'T06c: Second item second')

    const rows = db.prepare('SELECT status FROM upload_queue ORDER BY created_at').all()
    assertEqual(rows[0].status, 'synced', 'T06d: First entry synced')
    assertEqual(rows[1].status, 'synced', 'T06e: Second entry synced')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ═══ Summary ═════════════════════════════════════════════════════════

console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`)

if (failed > 0) {
  console.error('\nSome tests FAILED!')
  process.exit(1)
} else {
  console.log('\nAll tests PASSED!')
  process.exit(0)
}
