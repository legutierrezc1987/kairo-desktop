/**
 * test_hotfix_012.mjs — Hotfix 0.1.2: Input Normalization + Scrollback + Stream Timeout
 *
 * Validates:
 *   Bug A: normalizeInput() strips ANSI, zero-width, control chars; classifyCommand uses it
 *   Bug B: useTerminal.ts has scrollback: 5000 and convertEol: true
 *   Bug C: CHAT_STREAM_TIMEOUT_MS exists and orchestrator uses Promise.race timeout
 *
 * Run: node tests/test_hotfix_012.mjs
 * Expected: All assertions PASS, exit 0
 */

import { strict as assert } from 'node:assert'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'src')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

let passed = 0
let failed = 0

function test(name, fn) {
  try { fn(); passed++; console.log(`  PASS  ${name}`) }
  catch (err) { failed++; console.error(`  FAIL  ${name}`); console.error(`    ${err.message}`) }
}

// ════════════════════════════════════════════════════════════════
// Section 1: Bug A — Input Normalization (source verification)
// ════════════════════════════════════════════════════════════════

console.log('\n=== Section 1: Bug A — Input Normalization (source) ===\n')

const classifierSource = readFileSync(
  resolve(SRC, 'main/execution/command-classifier.ts'), 'utf-8'
)

test('normalizeInput function exists', () => {
  assert.ok(classifierSource.includes('function normalizeInput('),
    'normalizeInput function not found in classifier source')
})

test('normalizeInput strips ANSI CSI sequences', () => {
  assert.ok(classifierSource.includes('\\x1b\\['),
    'No ANSI CSI pattern found in normalizeInput')
})

test('normalizeInput strips zero-width Unicode (U+200B)', () => {
  assert.ok(classifierSource.includes('\\u200B'),
    'No zero-width char stripping found')
})

test('normalizeInput strips BOM (U+FEFF)', () => {
  assert.ok(classifierSource.includes('\\uFEFF'),
    'No BOM stripping found')
})

test('normalizeInput strips control characters', () => {
  assert.ok(classifierSource.includes('\\x00-\\x08'),
    'No control char stripping found')
})

test('normalizeInput collapses multiple spaces', () => {
  assert.ok(classifierSource.includes('{2,}'),
    'No space collapse regex found')
})

test('classifyCommand calls normalizeInput before trim', () => {
  assert.ok(classifierSource.includes('normalizeInput(rawCommand).trim()'),
    'classifyCommand does not call normalizeInput')
})

test('normalizeInput strips ANSI OSC sequences', () => {
  assert.ok(classifierSource.includes('\\x1b\\]'),
    'No ANSI OSC pattern found')
})

// ════════════════════════════════════════════════════════════════
// Section 1b: Bug A — Functional classification tests (esbuild)
// ════════════════════════════════════════════════════════════════

console.log('\n=== Section 1b: Bug A — Functional classification ===\n')

// Source-patch command-zones import for esbuild bundle
let classifierCode = readFileSync(
  resolve(SRC, 'main/execution/command-classifier.ts'), 'utf-8'
)
const zonesAbsPath = resolve(SRC, 'main/config/command-zones.ts').replace(/\\/g, '/')
classifierCode = classifierCode.replace(
  `from '../config/command-zones'`,
  `from '${zonesAbsPath}'`
)
const typesAbsPath = resolve(SRC, 'shared/types.ts').replace(/\\/g, '/')
classifierCode = classifierCode.replace(
  `from '../../shared/types'`,
  `from '${typesAbsPath}'`
)

const classifierPatchedPath = join(buildDir, 'command-classifier.hotfix012.ts')
import { writeFileSync } from 'node:fs'
writeFileSync(classifierPatchedPath, classifierCode)

buildSync({
  entryPoints: [classifierPatchedPath],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'classifier.hotfix012.test.mjs'),
  logLevel: 'silent',
})

const classifierUrl = pathToFileURL(join(buildDir, 'classifier.hotfix012.test.mjs')).href
const { classifyCommand } = await import(classifierUrl)

test('dir with bracketed paste markers → GREEN', () => {
  const r = classifyCommand('\x1b[200~dir\x1b[201~')
  assert.strictEqual(r.zone, 'green', `Expected green, got ${r.zone}: ${r.reason}`)
})

test('ls with zero-width spaces → GREEN', () => {
  const r = classifyCommand('\u200Bls\u200B')
  assert.strictEqual(r.zone, 'green', `Expected green, got ${r.zone}: ${r.reason}`)
})

test('git status with BOM prefix → GREEN', () => {
  const r = classifyCommand('\uFEFFgit status')
  assert.strictEqual(r.zone, 'green', `Expected green, got ${r.zone}: ${r.reason}`)
})

test('npm install with ANSI color codes → YELLOW', () => {
  const r = classifyCommand('\x1b[32mnpm install express\x1b[0m')
  assert.strictEqual(r.zone, 'yellow', `Expected yellow, got ${r.zone}: ${r.reason}`)
})

test('echo with embedded null bytes → GREEN', () => {
  const r = classifyCommand('echo\x00 hello')
  assert.strictEqual(r.zone, 'green', `Expected green, got ${r.zone}: ${r.reason}`)
})

test('format with ANSI is still RED (normalization does not help attackers)', () => {
  const r = classifyCommand('\x1b[0mformat C:')
  assert.strictEqual(r.zone, 'red', `Expected red, got ${r.zone}: ${r.reason}`)
})

test('chain injection through bracketed paste is still RED', () => {
  const r = classifyCommand('\x1b[200~echo hi && format c:\x1b[201~')
  assert.strictEqual(r.zone, 'red', `Expected red, got ${r.zone}: ${r.reason}`)
})

test('unknown command with invisible chars is still RED (deny-by-default)', () => {
  const r = classifyCommand('\u200Bxyzunknown\u200B')
  assert.strictEqual(r.zone, 'red', `Expected red, got ${r.zone}: ${r.reason}`)
})

test('clean dir still works (regression)', () => {
  const r = classifyCommand('dir')
  assert.strictEqual(r.zone, 'green')
})

test('clean ls -la still works (regression)', () => {
  const r = classifyCommand('ls -la')
  assert.strictEqual(r.zone, 'green')
})

test('excessive spaces between tokens collapsed → GREEN', () => {
  const r = classifyCommand('git    status')
  assert.strictEqual(r.zone, 'green', `Expected green, got ${r.zone}: ${r.reason}`)
})

test('CR injection still detected after normalization', () => {
  const r = classifyCommand('\x1b[0mecho hi\rformat c:')
  assert.strictEqual(r.zone, 'red', `Expected red (CR injection), got ${r.zone}`)
})

test('LF injection still detected after normalization', () => {
  const r = classifyCommand('echo hi\nformat c:')
  assert.strictEqual(r.zone, 'red', `Expected red (LF injection), got ${r.zone}`)
})

test('empty after normalization → treated as empty (no crash)', () => {
  const r = classifyCommand('\u200B \u200C')
  // After normalization: ' ' → trim → '' → empty string → falls to deny-by-default
  assert.strictEqual(r.zone, 'red')
})

// ════════════════════════════════════════════════════════════════
// Section 2: Bug B — Terminal Scrollback (source verification)
// ════════════════════════════════════════════════════════════════

console.log('\n=== Section 2: Bug B — Terminal Scrollback ===\n')

const terminalSource = readFileSync(
  resolve(SRC, 'renderer/src/hooks/useTerminal.ts'), 'utf-8'
)

test('xterm has scrollback: 5000', () => {
  assert.ok(terminalSource.includes('scrollback: 5000'),
    'scrollback option not found or not set to 5000')
})

test('xterm has convertEol: true', () => {
  assert.ok(terminalSource.includes('convertEol: true'),
    'convertEol option not found')
})

test('scrollback appears inside Terminal constructor', () => {
  const ctorMatch = terminalSource.match(/new Terminal\(\{[\s\S]*?\}\)/)
  assert.ok(ctorMatch, 'Terminal constructor not found')
  assert.ok(ctorMatch[0].includes('scrollback'), 'scrollback not inside Terminal constructor')
})

test('convertEol appears inside Terminal constructor', () => {
  const ctorMatch = terminalSource.match(/new Terminal\(\{[\s\S]*?\}\)/)
  assert.ok(ctorMatch, 'Terminal constructor not found')
  assert.ok(ctorMatch[0].includes('convertEol'), 'convertEol not inside Terminal constructor')
})

// ════════════════════════════════════════════════════════════════
// Section 3: Bug C — Chat Stream Timeout
// ════════════════════════════════════════════════════════════════

console.log('\n=== Section 3: Bug C — Chat Stream Timeout ===\n')

const constantsSource = readFileSync(
  resolve(SRC, 'shared/constants.ts'), 'utf-8'
)

const orchestratorSource = readFileSync(
  resolve(SRC, 'main/core/orchestrator.ts'), 'utf-8'
)

test('CHAT_STREAM_TIMEOUT_MS constant exists in constants.ts', () => {
  assert.ok(constantsSource.includes('CHAT_STREAM_TIMEOUT_MS'),
    'CHAT_STREAM_TIMEOUT_MS not found in constants.ts')
})

test('CHAT_STREAM_TIMEOUT_MS = 120_000', () => {
  const match = constantsSource.match(/CHAT_STREAM_TIMEOUT_MS\s*=\s*([\d_]+)/)
  assert.ok(match, 'Could not parse CHAT_STREAM_TIMEOUT_MS value')
  const value = parseInt(match[1].replace(/_/g, ''), 10)
  assert.strictEqual(value, 120000, `Expected 120000, got ${value}`)
})

test('orchestrator imports CHAT_STREAM_TIMEOUT_MS', () => {
  assert.ok(orchestratorSource.includes('CHAT_STREAM_TIMEOUT_MS'),
    'CHAT_STREAM_TIMEOUT_MS not imported in orchestrator')
})

test('orchestrator uses Promise.race for stream timeout', () => {
  assert.ok(orchestratorSource.includes('Promise.race'),
    'Promise.race not found in orchestrator')
})

test('timeout promise references CHAT_STREAM_TIMEOUT_MS', () => {
  // Find the timeout creation near CHAT_STREAM_TIMEOUT_MS usage
  const raceSection = orchestratorSource.substring(
    orchestratorSource.indexOf('streamPromise'),
    orchestratorSource.indexOf('Promise.race') + 100
  )
  assert.ok(raceSection.includes('CHAT_STREAM_TIMEOUT_MS'),
    'Timeout promise does not use CHAT_STREAM_TIMEOUT_MS constant')
})

test('timeout error message is descriptive', () => {
  assert.ok(
    orchestratorSource.includes('Chat stream timeout'),
    'Timeout error message should mention "Chat stream timeout"')
})

test('catch block calls abortActiveStream()', () => {
  assert.ok(orchestratorSource.includes('abortActiveStream()'),
    'catch block does not call abortActiveStream()')
})

test('finally block still sets _isStreaming = false', () => {
  assert.ok(orchestratorSource.includes('this._isStreaming = false'),
    'finally block must set _isStreaming = false')
})

// Build constants for runtime verification
buildSync({
  entryPoints: [resolve(SRC, 'shared/constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'constants.hotfix012.test.mjs'),
  external: ['./types'],
  logLevel: 'silent',
})
const constUrl = pathToFileURL(join(buildDir, 'constants.hotfix012.test.mjs')).href
const constants = await import(constUrl)

test('CHAT_STREAM_TIMEOUT_MS = 120000 (runtime)', () => {
  assert.strictEqual(constants.CHAT_STREAM_TIMEOUT_MS, 120000)
})

test('RECALL_QUERY_TIMEOUT_MS still exists (regression)', () => {
  assert.strictEqual(constants.RECALL_QUERY_TIMEOUT_MS, 10000)
})

test('RATE_LIMIT_MAX_RETRIES still exists (regression)', () => {
  assert.strictEqual(constants.RATE_LIMIT_MAX_RETRIES, 3)
})

// ════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`  Results: ${passed} passed, ${failed} failed`)
console.log(`${'═'.repeat(60)}`)
if (failed > 0) {
  console.error('\nFAILED — Hotfix 0.1.2 has errors.\n')
  process.exit(1)
} else {
  console.log('\nPASSED — Hotfix 0.1.2 verified.\n')
  process.exit(0)
}
