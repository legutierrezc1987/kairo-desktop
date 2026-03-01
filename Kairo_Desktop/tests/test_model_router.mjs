/**
 * test_model_router.mjs — Phase 7 Sprint A Delta: Model Router Tests
 *
 * Functional verification of routeModel() from model-router.ts.
 * Tests foreground/background routing, user override behavior,
 * and MODEL_ROUTING constant parity.
 *
 * Run: node tests/test_model_router.mjs
 * Expected: 9 assertions PASS, exit 0
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

// ── esbuild: Model Router ──
buildSync({
  entryPoints: [resolve(SRC, 'main', 'services', 'model-router.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'model-router.standalone.mjs'),
  logLevel: 'silent',
})

// ── esbuild: Constants (for MODEL_ROUTING parity) ──
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'constants-router.standalone.mjs'),
  logLevel: 'silent',
})

const { routeModel } = await import(
  pathToFileURL(join(buildDir, 'model-router.standalone.mjs')).href
)
const constants = await import(
  pathToFileURL(join(buildDir, 'constants-router.standalone.mjs')).href
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

console.log('\n=== Phase 7 Sprint A Delta — Model Router ===\n')

// ─── Foreground routing ──────────────────────────────────────
test('MR01: foreground no override → gemini-2.5-pro', () => {
  assert.equal(routeModel('foreground'), 'gemini-2.5-pro')
})

test('MR02: foreground + Flash override → Flash', () => {
  assert.equal(routeModel('foreground', 'gemini-2.0-flash'), 'gemini-2.0-flash')
})

test('MR03: foreground + Lite override → Lite', () => {
  assert.equal(routeModel('foreground', 'gemini-2.0-flash-lite'), 'gemini-2.0-flash-lite')
})

test('MR07: foreground + undefined → Pro (falsy override ignored)', () => {
  assert.equal(routeModel('foreground', undefined), 'gemini-2.5-pro')
})

// ─── Background routing ─────────────────────────────────────
test('MR04: background no override → gemini-2.0-flash', () => {
  assert.equal(routeModel('background'), 'gemini-2.0-flash')
})

test('MR05: background + Pro override → ignores override (Flash)', () => {
  assert.equal(routeModel('background', 'gemini-2.5-pro'), 'gemini-2.0-flash')
})

test('MR06: background + undefined → Flash', () => {
  assert.equal(routeModel('background', undefined), 'gemini-2.0-flash')
})

// ─── Constants parity ────────────────────────────────────────
test('MR08: MODEL_ROUTING.foreground = gemini-2.5-pro', () => {
  assert.equal(constants.MODEL_ROUTING.foreground, 'gemini-2.5-pro')
})

test('MR09: MODEL_ROUTING.background = gemini-2.0-flash', () => {
  assert.equal(constants.MODEL_ROUTING.background, 'gemini-2.0-flash')
})

// ─── Summary ──────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Model router tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All model router tests pass.\n')
  process.exit(0)
}
