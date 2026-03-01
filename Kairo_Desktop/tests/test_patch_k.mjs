/**
 * test_patch_k.mjs — Patch K: Preflight Pull + normalizeModelId Tests
 *
 * Validates:
 *   T1: normalizeModelId — current models pass through
 *   T2: normalizeModelId — legacy mapping
 *   T3: normalizeModelId — unknown/empty fallback
 *   T4: Preflight pull source verification (index.ts)
 *   T5: normalizeModelId integration source (project.service, useSettings, model-router)
 *   T6: routeModel + normalization functional
 *   T7: IPC channel count = 49
 *   T8: DB migration justification (coverage proof)
 *
 * Run: node tests/test_patch_k.mjs
 * Expected: All assertions PASS, exit 0
 */

import { strict as assert } from 'node:assert'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'src')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

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

function readSrc(relativePath) {
  return readFileSync(resolve(SRC, relativePath), 'utf-8')
}

// ── esbuild: constants (normalizeModelId) ──
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'constants-patchk.standalone.mjs'),
  logLevel: 'silent',
})

const constantsMod = await import(
  pathToFileURL(join(buildDir, 'constants-patchk.standalone.mjs')).href
)
const { normalizeModelId, DEFAULT_MODEL, MODEL_DISPLAY_NAMES } = constantsMod

// ── esbuild: model-router (routeModel + normalization) ──
buildSync({
  entryPoints: [resolve(SRC, 'main', 'services', 'model-router.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'model-router-patchk.standalone.mjs'),
  logLevel: 'silent',
})

const { routeModel } = await import(
  pathToFileURL(join(buildDir, 'model-router-patchk.standalone.mjs')).href
)

// ── esbuild: ipc-channels ──
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'ipc-channels.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'ipc-channels-patchk.standalone.mjs'),
  logLevel: 'silent',
})

const ipcMod = await import(
  pathToFileURL(join(buildDir, 'ipc-channels-patchk.standalone.mjs')).href
)

console.log('\n=== Patch K — Preflight Pull + normalizeModelId ===\n')

// ─── T1: normalizeModelId — current models pass through ─────
console.log('--- T1: Current model IDs pass through ---')

const currentModels = Object.keys(MODEL_DISPLAY_NAMES)

test('T1a: gemini-2.5-flash passes through', () => {
  assert.equal(normalizeModelId('gemini-2.5-flash'), 'gemini-2.5-flash')
})

test('T1b: gemini-3-flash-preview passes through', () => {
  assert.equal(normalizeModelId('gemini-3-flash-preview'), 'gemini-3-flash-preview')
})

test('T1c: gemini-3.1-pro-preview passes through', () => {
  assert.equal(normalizeModelId('gemini-3.1-pro-preview'), 'gemini-3.1-pro-preview')
})

test('T1d: gemini-3.1-pro-preview-customtools passes through', () => {
  assert.equal(normalizeModelId('gemini-3.1-pro-preview-customtools'), 'gemini-3.1-pro-preview-customtools')
})

// ─── T2: normalizeModelId — legacy mapping ──────────────────
console.log('\n--- T2: Legacy model ID mapping ---')

test('T2a: gemini-2.0-flash maps to gemini-2.5-flash', () => {
  assert.equal(normalizeModelId('gemini-2.0-flash'), 'gemini-2.5-flash')
})

test('T2b: gemini-2.0-flash-lite maps to gemini-2.5-flash', () => {
  assert.equal(normalizeModelId('gemini-2.0-flash-lite'), 'gemini-2.5-flash')
})

test('T2c: gemini-2.5-pro maps to gemini-3.1-pro-preview', () => {
  assert.equal(normalizeModelId('gemini-2.5-pro'), 'gemini-3.1-pro-preview')
})

// ─── T3: normalizeModelId — unknown/empty fallback ──────────
console.log('\n--- T3: Unknown/empty fallback to DEFAULT_MODEL ---')

test('T3a: unknown model falls back to DEFAULT_MODEL', () => {
  assert.equal(normalizeModelId('gpt-4o'), DEFAULT_MODEL)
})

test('T3b: empty string falls back to DEFAULT_MODEL', () => {
  assert.equal(normalizeModelId(''), DEFAULT_MODEL)
})

test('T3c: random garbage falls back to DEFAULT_MODEL', () => {
  assert.equal(normalizeModelId('not-a-real-model-xyz'), DEFAULT_MODEL)
})

test('T3d: partial match does NOT pass through (requires exact match)', () => {
  assert.equal(normalizeModelId('gemini-2.5'), DEFAULT_MODEL)
})

// ─── T4: Preflight pull source verification ─────────────────
console.log('\n--- T4: Preflight pull (index.ts) source verification ---')
{
  const indexSrc = readSrc('main/index.ts')

  test('T4a: lastPreflightStatus module-level variable exists', () => {
    assert.ok(indexSrc.includes('let lastPreflightStatus'))
  })

  test('T4b: lastPreflightStatus typed as AccountGatewayStatus', () => {
    assert.ok(indexSrc.includes('lastPreflightStatus: AccountGatewayStatus'))
  })

  test('T4c: ACCOUNT_PREFLIGHT_GET handler registered via ipcMain.handle', () => {
    assert.ok(indexSrc.includes('IPC_CHANNELS.ACCOUNT_PREFLIGHT_GET'))
  })

  test('T4d: handler returns lastPreflightStatus in response', () => {
    assert.ok(indexSrc.includes('status: lastPreflightStatus'))
  })

  test('T4e: handler validates sender', () => {
    // The ACCOUNT_PREFLIGHT_GET handler block must call validateSender
    const handlerStart = indexSrc.indexOf('ACCOUNT_PREFLIGHT_GET')
    const handlerSlice = indexSrc.slice(handlerStart, handlerStart + 300)
    assert.ok(handlerSlice.includes('validateSender'))
  })

  test('T4f: firePreflightCheck updates lastPreflightStatus to validating', () => {
    assert.ok(indexSrc.includes("lastPreflightStatus = 'validating'"))
  })
}

// ─── T5: normalizeModelId integration source ────────────────
console.log('\n--- T5: normalizeModelId integration at entry points ---')
{
  const projectSrc = readSrc('main/services/project.service.ts')
  const settingsSrc = readSrc('renderer/src/hooks/useSettings.ts')
  const routerSrc = readSrc('main/services/model-router.ts')
  const accountSrc = readSrc('renderer/src/components/Settings/AccountManager.tsx')

  test('T5a: project.service.ts imports normalizeModelId', () => {
    assert.ok(projectSrc.includes("import { normalizeModelId }"))
  })

  test('T5b: rowToProject uses normalizeModelId(row.model)', () => {
    assert.ok(projectSrc.includes('normalizeModelId(row.model)'))
  })

  test('T5c: useSettings.ts imports normalizeModelId', () => {
    assert.ok(settingsSrc.includes('normalizeModelId'))
  })

  test('T5d: useSettings.ts does NOT contain VALID_MODELS array (dead code removed)', () => {
    assert.ok(!settingsSrc.includes('VALID_MODELS'))
  })

  test('T5e: model-router.ts uses normalizeModelId(userOverride)', () => {
    assert.ok(routerSrc.includes('normalizeModelId(userOverride)'))
  })

  test('T5f: AccountManager uses ACCOUNT_PREFLIGHT_GET pull invoke', () => {
    assert.ok(accountSrc.includes('ACCOUNT_PREFLIGHT_GET'))
  })
}

// ─── T6: routeModel + normalization functional ──────────────
console.log('\n--- T6: routeModel with legacy model normalization ---')

test('T6a: foreground + legacy gemini-2.0-flash → normalized to gemini-2.5-flash', () => {
  assert.equal(routeModel('foreground', 'gemini-2.0-flash'), 'gemini-2.5-flash')
})

test('T6b: foreground + legacy gemini-2.5-pro → normalized to gemini-3.1-pro-preview', () => {
  assert.equal(routeModel('foreground', 'gemini-2.5-pro'), 'gemini-3.1-pro-preview')
})

test('T6c: foreground + current model passes through', () => {
  assert.equal(routeModel('foreground', 'gemini-3-flash-preview'), 'gemini-3-flash-preview')
})

test('T6d: foreground + unknown model → DEFAULT_MODEL', () => {
  assert.equal(routeModel('foreground', 'unknown-model'), DEFAULT_MODEL)
})

test('T6e: background ignores override (even legacy)', () => {
  const result = routeModel('background', 'gemini-2.0-flash')
  assert.equal(result, 'gemini-3-flash-preview')
})

test('T6f: foreground no override → default routing', () => {
  assert.equal(routeModel('foreground'), 'gemini-2.5-flash')
})

// ─── T7: IPC channel count = 49 ─────────────────────────────
console.log('\n--- T7: IPC channel count ---')
{
  const ipcSrc = readSrc('shared/ipc-channels.ts')

  test('T7a: ACCOUNT_PREFLIGHT_GET channel exists', () => {
    assert.ok(ipcSrc.includes("ACCOUNT_PREFLIGHT_GET: 'account:preflight-get'"))
  })

  test('T7b: Total IPC channels = 49', () => {
    const channelPattern = /:\s*'([a-z][-a-z]*:[a-z][-a-z]*)'/g
    const channels = []
    let m
    while ((m = channelPattern.exec(ipcSrc)) !== null) channels.push(m[1])
    assert.equal(channels.length, 49, `Expected 49 channels, got ${channels.length}`)
  })
}

// ─── T8: DB migration coverage proof ────────────────────────
console.log('\n--- T8: Runtime normalization coverage (no DB migration needed) ---')
{
  const projectSrc = readSrc('main/services/project.service.ts')
  const settingsSrc = readSrc('renderer/src/hooks/useSettings.ts')
  const routerSrc = readSrc('main/services/model-router.ts')

  test('T8a: DB read path (rowToProject) normalizes model at runtime', () => {
    // Proves: any legacy model string stored in projects table is normalized on read
    assert.ok(projectSrc.includes('normalizeModelId(row.model)'))
  })

  test('T8b: Settings hydration normalizes model at runtime', () => {
    // Proves: any legacy model string stored in settings table is normalized on hydrate
    assert.ok(settingsSrc.includes('normalizeModelId(modelRes.data.value)'))
  })

  test('T8c: Model routing normalizes override at runtime', () => {
    // Proves: any legacy model selected by user is normalized before gateway call
    assert.ok(routerSrc.includes('normalizeModelId(userOverride)'))
  })
}

// ─── Summary ────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Patch K tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All Patch K tests pass.\n')
  process.exit(0)
}
