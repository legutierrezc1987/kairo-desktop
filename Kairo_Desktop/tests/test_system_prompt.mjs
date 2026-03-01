/**
 * test_system_prompt.mjs — Phase 7 Sprint A Delta: System Prompt Builder Tests
 *
 * Functional verification of buildSystemPrompt() from system-prompt.ts.
 * Tests section ordering, visibility mode, optional section omission,
 * and return type contracts.
 *
 * Run: node tests/test_system_prompt.mjs
 * Expected: 18 assertions PASS, exit 0
 */

import { strict as assert } from 'node:assert'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'src')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

// ── esbuild: System Prompt Builder ──
buildSync({
  entryPoints: [resolve(SRC, 'main', 'config', 'system-prompt.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'system-prompt.standalone.mjs'),
  logLevel: 'silent',
})

const { buildSystemPrompt } = await import(
  pathToFileURL(join(buildDir, 'system-prompt.standalone.mjs')).href
)

let passed = 0
let failed = 0

function PASS(label) {
  passed++
  console.log(`  PASS  ${label}`)
}

function FAIL(label, err) {
  failed++
  console.error(`  FAIL  ${label}: ${err}`)
}

function test(label, fn) {
  try {
    fn()
    PASS(label)
  } catch (e) {
    FAIL(label, e.message)
  }
}

console.log('\n=== Phase 7 Sprint A Delta — System Prompt Builder ===\n')

// ─── Base prompt ─────────────────────────────────────────────
test('SP01: base prompt contains "Kairo"', () => {
  const result = buildSystemPrompt('', '', '')
  assert(result.includes('Kairo'), 'Missing "Kairo"')
})

test('SP02: empty params → no optional sections', () => {
  const result = buildSystemPrompt('', '', '')
  assert(!result.includes('Active Project'), 'Should not have Active Project')
  assert(!result.includes('Memory Recall'), 'Should not have Memory Recall')
  assert(!result.includes('Previous Session Context'), 'Should not have bridge')
})

// ─── Visibility mode ────────────────────────────────────────
test('SP03: concise mode → "Be concise"', () => {
  const result = buildSystemPrompt('', '', '', 'concise')
  assert(result.includes('Be concise'), 'Missing concise instruction')
})

test('SP04: concise mode → "## Response Style" header', () => {
  const result = buildSystemPrompt('', '', '', 'concise')
  assert(result.includes('## Response Style'), 'Missing Response Style header')
})

test('SP05: detailed mode → "thorough, detailed"', () => {
  const result = buildSystemPrompt('', '', '', 'detailed')
  assert(result.includes('thorough, detailed'), 'Missing detailed instruction')
})

// ─── Individual sections ─────────────────────────────────────
test('SP06: projectName → "## Active Project" + name', () => {
  const result = buildSystemPrompt('MyProject', '', '')
  assert(result.includes('## Active Project'), 'Missing Active Project header')
  assert(result.includes('MyProject'), 'Missing project name')
})

test('SP07: bridgeSummary → "## Previous Session Context"', () => {
  const result = buildSystemPrompt('', '', 'Bridge text here')
  assert(result.includes('## Previous Session Context'), 'Missing bridge header')
  assert(result.includes('Bridge text here'), 'Missing bridge text')
})

test('SP08: recallContext → "## Memory Recall"', () => {
  const result = buildSystemPrompt('', 'Recalled data', '')
  assert(result.includes('## Memory Recall'), 'Missing recall header')
  assert(result.includes('Recalled data'), 'Missing recall text')
})

// ─── All sections combined ───────────────────────────────────
test('SP09: all params → all 4 sections present', () => {
  const result = buildSystemPrompt('Proj', 'recall', 'bridge', 'concise')
  assert(result.includes('## Response Style'), 'Missing visibility')
  assert(result.includes('## Active Project'), 'Missing project')
  assert(result.includes('## Previous Session Context'), 'Missing bridge')
  assert(result.includes('## Memory Recall'), 'Missing recall')
})

// ─── Section ordering ────────────────────────────────────────
test('SP10: order: Response Style < Active Project', () => {
  const result = buildSystemPrompt('Proj', '', '', 'concise')
  assert(result.indexOf('Response Style') < result.indexOf('Active Project'))
})

test('SP11: order: Active Project < Previous Session Context', () => {
  const result = buildSystemPrompt('Proj', '', 'bridge', 'concise')
  assert(result.indexOf('Active Project') < result.indexOf('Previous Session Context'))
})

test('SP12: order: Previous Session Context < Memory Recall', () => {
  const result = buildSystemPrompt('Proj', 'recall', 'bridge', 'concise')
  assert(result.indexOf('Previous Session Context') < result.indexOf('Memory Recall'))
})

// ─── Omission when empty ─────────────────────────────────────
test('SP13: empty projectName → omits section', () => {
  const result = buildSystemPrompt('', 'some recall', '')
  assert(!result.includes('Active Project'), 'Should not have Active Project')
})

test('SP14: empty bridgeSummary → omits section', () => {
  const result = buildSystemPrompt('Proj', '', '')
  assert(!result.includes('Previous Session Context'), 'Should not have bridge')
})

test('SP15: empty recallContext → omits section', () => {
  const result = buildSystemPrompt('Proj', '', 'bridge')
  assert(!result.includes('Memory Recall'), 'Should not have recall')
})

test('SP16: no visibilityMode → omits Response Style', () => {
  const result = buildSystemPrompt('Proj', '', '')
  assert(!result.includes('Response Style'), 'Should not have Response Style')
})

// ─── Return type ─────────────────────────────────────────────
test('SP17: return type is string', () => {
  const result = buildSystemPrompt('', '', '')
  assert.equal(typeof result, 'string')
})

test('SP18: starts with "You are Kairo"', () => {
  const result = buildSystemPrompt('', '', '')
  assert(result.startsWith('You are Kairo'), `Starts with: "${result.substring(0, 30)}"`)
})

// ─── Summary ──────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — System prompt tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All system prompt builder tests pass.\n')
  process.exit(0)
}
