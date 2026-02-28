/**
 * test_snapshot_service.mjs — Phase 4 Sprint D: Snapshot Service Tests
 *
 * Tests snapshot generation including:
 * - Transcript formatting
 * - Mechanical fallback when LLM unavailable
 * - File write to disk
 * - Directory creation
 *
 * Run: node tests/test_snapshot_service.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
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

// ─── Build snapshot service with gateway shim ───────────────────────

const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

const shimServicesDir = join(buildDir, 'shim-services')
mkdirSync(shimServicesDir, { recursive: true })

// Gateway shim: NOT initialized → forces mechanical fallback
writeFileSync(join(shimServicesDir, 'gemini-gateway-uninit.ts'), `
export function isInitialized(): boolean { return false }
export async function generateContent(prompt: string, modelId: string) {
  throw new Error('Not initialized')
}
export async function countTokens(content: string, modelId: string): Promise<number> { return 0 }
`)

// Gateway shim: initialized → returns mock summary
writeFileSync(join(shimServicesDir, 'gemini-gateway-init.ts'), `
export function isInitialized(): boolean { return true }
export async function generateContent(prompt: string, modelId: string) {
  return { text: '# LLM Generated Summary\\n\\nKey topics discussed.', tokenCount: { prompt: 50, completion: 30, total: 80 } }
}
export async function countTokens(content: string, modelId: string): Promise<number> { return 50 }
`)

// Source-patch approach (esbuild alias doesn't support relative paths)
const snapshotOrigSource = readFileSync(
  resolve(__dirname, '../src/main/services/snapshot.service.ts'), 'utf-8'
)
const shimSvcDir = shimServicesDir.replace(/\\/g, '/')
const sharedDir = resolve(__dirname, '../src/shared').replace(/\\/g, '/')

// Fallback variant (uninit gateway)
const fallbackSource = snapshotOrigSource
  .replace("from './gemini-gateway'", `from '${shimSvcDir}/gemini-gateway-uninit.ts'`)
  .replace("from '../../shared/constants'", `from '${sharedDir}/constants'`)
  .replace("from '../../shared/types'", `from '${sharedDir}/types'`)
writeFileSync(join(buildDir, 'snapshot-fallback.ts'), fallbackSource)

buildSync({
  entryPoints: [join(buildDir, 'snapshot-fallback.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'snapshot.fallback.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

// LLM variant (init gateway)
const llmSource = snapshotOrigSource
  .replace("from './gemini-gateway'", `from '${shimSvcDir}/gemini-gateway-init.ts'`)
  .replace("from '../../shared/constants'", `from '${sharedDir}/constants'`)
  .replace("from '../../shared/types'", `from '${sharedDir}/types'`)
writeFileSync(join(buildDir, 'snapshot-llm.ts'), llmSource)

buildSync({
  entryPoints: [join(buildDir, 'snapshot-llm.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'snapshot.llm.mjs'),
  external: ['better-sqlite3'],
  logLevel: 'silent',
})

const fallbackModule = await import(pathToFileURL(join(buildDir, 'snapshot.fallback.mjs')).href)
const llmModule = await import(pathToFileURL(join(buildDir, 'snapshot.llm.mjs')).href)

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\n=== Phase 4 Sprint D: Snapshot Service Tests ===\n')

const testHistory = [
  { role: 'user', parts: [{ text: 'Hello Kairo' }] },
  { role: 'model', parts: [{ text: 'Hi! How can I help?' }] },
  { role: 'user', parts: [{ text: 'Explain Node.js streams' }] },
  { role: 'model', parts: [{ text: 'Node.js streams are...' }] },
]

// ── T01: Mechanical fallback creates files ─────────────────────

console.log('\n--- T01: Mechanical fallback ---')
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'kairo-snap-'))
  try {
    const result = await fallbackModule.createSnapshot(tmpDir, 1, testHistory)

    assert(result.transcriptPath.includes('session_001_transcript.md'), 'T01a: Transcript path correct')
    assert(result.summaryPath.includes('session_001_summary.md'), 'T01b: Summary path correct')
    assert(result.summaryText.includes('mechanical fallback'), 'T01c: Summary uses fallback')
    assert(existsSync(result.transcriptPath), 'T01d: Transcript file exists')
    assert(existsSync(result.summaryPath), 'T01e: Summary file exists')

    const transcript = readFileSync(result.transcriptPath, 'utf-8')
    assert(transcript.includes('USER'), 'T01f: Transcript contains USER role')
    assert(transcript.includes('MODEL'), 'T01g: Transcript contains MODEL role')
    assert(transcript.includes('Hello Kairo'), 'T01h: Transcript contains user message')
  } finally {
    cleanupDir(tmpDir)
  }
}

// ── T02: LLM path creates files with real summary ──────────────

console.log('\n--- T02: LLM summary path ---')
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'kairo-snap-'))
  try {
    const result = await llmModule.createSnapshot(tmpDir, 2, testHistory)

    assert(result.transcriptPath.includes('session_002_transcript.md'), 'T02a: Session number in path')
    assert(result.summaryText.includes('LLM Generated Summary'), 'T02b: LLM summary returned')
    assert(existsSync(result.transcriptPath), 'T02c: Transcript file exists')
    assert(existsSync(result.summaryPath), 'T02d: Summary file exists')

    const summary = readFileSync(result.summaryPath, 'utf-8')
    assert(summary.includes('LLM Generated Summary'), 'T02e: LLM summary written to file')
  } finally {
    cleanupDir(tmpDir)
  }
}

// ── T03: Directory creation ─────────────────────────────────────

console.log('\n--- T03: Directory creation ---')
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'kairo-snap-'))
  const nested = join(tmpDir, 'deep', 'nested')
  try {
    // Pass non-existent nested directory
    const result = await fallbackModule.createSnapshot(nested, 1, testHistory)
    assert(existsSync(join(nested, '.kairo', 'sessions')), 'T03a: Nested .kairo/sessions created')
    assert(existsSync(result.transcriptPath), 'T03b: Files created in nested dir')
  } finally {
    cleanupDir(tmpDir)
  }
}

// ── T04: Empty history ──────────────────────────────────────────

console.log('\n--- T04: Empty history ---')
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'kairo-snap-'))
  try {
    const result = await fallbackModule.createSnapshot(tmpDir, 1, [])
    assert(result.summaryText.includes('mechanical fallback'), 'T04a: Empty history produces fallback')
    assert(existsSync(result.transcriptPath), 'T04b: Transcript file created even if empty')
  } finally {
    cleanupDir(tmpDir)
  }
}

// ── T05: Session number padding ─────────────────────────────────

console.log('\n--- T05: Session number padding ---')
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'kairo-snap-'))
  try {
    const result = await fallbackModule.createSnapshot(tmpDir, 42, testHistory)
    assert(result.transcriptPath.includes('session_042_transcript'), 'T05a: Session number zero-padded')
  } finally {
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
