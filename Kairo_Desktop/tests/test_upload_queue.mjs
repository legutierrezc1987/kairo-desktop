/**
 * test_upload_queue.mjs — Phase 4 Sprint D: Upload Queue Service Tests
 *
 * Tests the upload_queue DB operations:
 * - Enqueue entries
 * - Status transitions (pending → uploading → synced/failed/manual)
 * - Retry with backoff
 * - Escalation to manual after max retries
 *
 * Run: node tests/test_upload_queue.mjs
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

const { DatabaseService } = await import(pathToFileURL(join(buildDir, 'database.service.mjs')).href)
const { UploadQueueService } = await import(pathToFileURL(join(buildDir, 'upload-queue.service.mjs')).href)

// ─── Helper: create DB with required tables ─────────────────────────

function createTestDb() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'kairo-uq-'))
  const dbService = new DatabaseService(tmpDir)
  const db = dbService.getDb()

  // Insert a project + session so FK constraints are satisfied
  db.prepare(`INSERT INTO projects (id, name, folder_path) VALUES ('p1', 'Test', '/tmp/test')`).run()
  db.prepare(`INSERT INTO sessions (id, project_id, session_number, status, started_at) VALUES ('s1', 'p1', 1, 'active', datetime('now'))`).run()

  return { db, tmpDir, dbService }
}

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\n=== Phase 4 Sprint D: Upload Queue Service Tests ===\n')

// ── T01: Enqueue entry ──────────────────────────────────────────

console.log('\n--- T01: Enqueue ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    const entry = uq.enqueue('s1', '/tmp/transcript.md', 'transcript')

    assert(entry.id.length > 0, 'T01a: Entry has UUID')
    assertEqual(entry.sessionId, 's1', 'T01b: Session ID matches')
    assertEqual(entry.filePath, '/tmp/transcript.md', 'T01c: File path matches')
    assertEqual(entry.fileType, 'transcript', 'T01d: File type matches')
    assertEqual(entry.status, 'pending', 'T01e: Status is pending')
    assertEqual(entry.retryCount, 0, 'T01f: Retry count is 0')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T02: Get ready entries ──────────────────────────────────────

console.log('\n--- T02: Get ready ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    uq.enqueue('s1', '/tmp/a.md', 'transcript')
    uq.enqueue('s1', '/tmp/b.md', 'summary')

    const ready = uq.getReady(10)
    assertEqual(ready.length, 2, 'T02a: Two pending entries')
    assertEqual(ready[0].fileType, 'transcript', 'T02b: First entry is transcript')
    assertEqual(ready[1].fileType, 'summary', 'T02c: Second entry is summary')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T03: Mark uploading ─────────────────────────────────────────

console.log('\n--- T03: Mark uploading ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    const entry = uq.enqueue('s1', '/tmp/a.md', 'transcript')
    uq.markUploading(entry.id)

    const row = db.prepare('SELECT status FROM upload_queue WHERE id = ?').get(entry.id)
    assertEqual(row.status, 'uploading', 'T03a: Status is uploading')

    // Uploading entries should not appear in getReady
    const ready = uq.getReady(10)
    assertEqual(ready.length, 0, 'T03b: No ready entries while uploading')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T04: Mark synced ────────────────────────────────────────────

console.log('\n--- T04: Mark synced ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    const entry = uq.enqueue('s1', '/tmp/a.md', 'transcript')
    uq.markUploading(entry.id)
    uq.markSynced(entry.id)

    const row = db.prepare('SELECT status FROM upload_queue WHERE id = ?').get(entry.id)
    assertEqual(row.status, 'synced', 'T04a: Status is synced')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T05: Record failure with backoff ────────────────────────────

console.log('\n--- T05: Record failure ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    const entry = uq.enqueue('s1', '/tmp/a.md', 'transcript')
    uq.markUploading(entry.id)
    uq.recordFailure(entry.id, 'timeout', 0)

    const row = db.prepare('SELECT status, retry_count, error_message, next_retry_at FROM upload_queue WHERE id = ?').get(entry.id)
    assertEqual(row.status, 'failed', 'T05a: Status is failed')
    assertEqual(row.retry_count, 1, 'T05b: Retry count incremented')
    assertEqual(row.error_message, 'timeout', 'T05c: Error message stored')
    assert(row.next_retry_at !== null, 'T05d: Next retry time set')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T06: Escalation to manual after max retries ─────────────────

console.log('\n--- T06: Escalation to manual ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    const entry = uq.enqueue('s1', '/tmp/a.md', 'transcript')
    uq.markUploading(entry.id)
    // Simulate retry count at max (9 = one before max of 10)
    uq.recordFailure(entry.id, 'final timeout', 9)

    const row = db.prepare('SELECT status, error_message FROM upload_queue WHERE id = ?').get(entry.id)
    assertEqual(row.status, 'manual', 'T06a: Status escalated to manual')
    assert(row.error_message.includes('Max retries'), 'T06b: Error message mentions max retries')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T07: Multiple enqueues for same session ─────────────────────

console.log('\n--- T07: Multiple enqueues ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    const e1 = uq.enqueue('s1', '/tmp/a.md', 'transcript')
    const e2 = uq.enqueue('s1', '/tmp/b.md', 'summary')
    const e3 = uq.enqueue('s1', '/tmp/c.md', 'master_summary')

    assert(e1.id !== e2.id, 'T07a: Unique IDs for entries')
    assert(e2.id !== e3.id, 'T07b: Unique IDs for entries')

    const count = db.prepare('SELECT COUNT(*) as cnt FROM upload_queue WHERE session_id = ?').get('s1')
    assertEqual(count.cnt, 3, 'T07c: Three entries in queue')
  } finally {
    dbService.close()
    cleanupDir(tmpDir)
  }
}

// ── T08: getReady respects limit ────────────────────────────────

console.log('\n--- T08: getReady limit ---')
{
  const { db, tmpDir, dbService } = createTestDb()
  try {
    const uq = new UploadQueueService(db)
    for (let i = 0; i < 10; i++) {
      uq.enqueue('s1', `/tmp/file${i}.md`, 'transcript')
    }

    const ready3 = uq.getReady(3)
    assertEqual(ready3.length, 3, 'T08a: Limit respected')

    const ready10 = uq.getReady(10)
    assertEqual(ready10.length, 10, 'T08b: All entries returned')
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
