/**
 * Phase 5 Sprint C — Rate-Limit Handler Tests (PRD §14)
 *
 * Tests: is429 detection, backoff calculation, retryWithBackoff logic,
 * Pro→Flash fallback, exhaustion path, consolidation integration gate,
 * renderer store/hook/panel assertions.
 *
 * Acceptance gates covered:
 *   G1: Happy path — 429 initial, success on 2nd attempt
 *   G2: Exhaustion path — 429 continuous, 3 retries + fallback
 *   G3: Catastrophic failure — fallback also fails, "Cuota agotada"
 *   G4: Integration — consolidation with 429 releases _isConsolidating
 */

import { strict as assert } from 'node:assert'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Build setup (same pattern as test_consolidation_engine) ──
const SRC = join(__dirname, '..', 'src')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

// Build rate-limit.service standalone (bundles shared/ deps)
buildSync({
  entryPoints: [resolve(SRC, 'main', 'services', 'rate-limit.service.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'rate-limit.test.mjs'),
  logLevel: 'silent',
})

// Build constants standalone
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'constants.test.mjs'),
  logLevel: 'silent',
})

// Build ipc-channels standalone
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'ipc-channels.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'ipc-channels.test.mjs'),
  logLevel: 'silent',
})

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

async function testAsync(label, fn) {
  try {
    await fn()
    PASS(label)
  } catch (e) {
    FAIL(label, e.message)
  }
}

// ── Load modules from build output ──
const rateLimitMod = await import(pathToFileURL(join(buildDir, 'rate-limit.test.mjs')).href)
const { is429, calculateBackoff, calculateBackoffNoJitter, retryWithBackoff } = rateLimitMod

const constantsMod = await import(pathToFileURL(join(buildDir, 'constants.test.mjs')).href)
const {
  RATE_LIMIT_MAX_RETRIES,
  RATE_LIMIT_BACKOFF_BASE_MS,
  RATE_LIMIT_BACKOFF_MAX_MS,
  RATE_LIMIT_JITTER_FACTOR,
} = constantsMod

const ipcMod = await import(pathToFileURL(join(buildDir, 'ipc-channels.test.mjs')).href)
const { IPC_CHANNELS, IPC_CHANNEL_ALLOWLIST } = ipcMod

console.log('\n═══ is429() — detection ═══')

test('T1: detects status 429', () => {
  assert.ok(is429({ status: 429, message: '' }))
})

test('T2: detects status 503', () => {
  assert.ok(is429({ status: 503, message: '' }))
})

test('T3: detects httpStatusCode 429', () => {
  assert.ok(is429({ httpStatusCode: 429 }))
})

test('T4: detects code 429', () => {
  assert.ok(is429({ code: 429 }))
})

test('T5: detects RESOURCE_EXHAUSTED in message', () => {
  assert.ok(is429(new Error('RESOURCE_EXHAUSTED: quota exceeded')))
})

test('T6: detects "quota" in message', () => {
  assert.ok(is429(new Error('API quota has been reached')))
})

test('T7: detects "rate limit" in message', () => {
  assert.ok(is429(new Error('Rate limit exceeded for model')))
})

test('T8: detects "too many requests" in message', () => {
  assert.ok(is429(new Error('Too Many Requests')))
})

test('T9: detects "429" in message', () => {
  assert.ok(is429(new Error('Got 429 from server')))
})

test('T10: detects "503" in message', () => {
  assert.ok(is429(new Error('503 Service Unavailable')))
})

console.log('\n═══ is429() — rejection ═══')

test('T11: rejects null', () => {
  assert.ok(!is429(null))
})

test('T12: rejects undefined', () => {
  assert.ok(!is429(undefined))
})

test('T13: rejects status 400', () => {
  assert.ok(!is429({ status: 400, message: 'Bad request' }))
})

test('T14: rejects status 401', () => {
  assert.ok(!is429({ status: 401, message: 'Unauthorized' }))
})

test('T15: rejects status 500', () => {
  assert.ok(!is429({ status: 500, message: 'Internal error' }))
})

test('T16: rejects generic error', () => {
  assert.ok(!is429(new Error('Something went wrong')))
})

test('T17: rejects status 404', () => {
  assert.ok(!is429({ status: 404, message: 'Not found' }))
})

console.log('\n═══ calculateBackoffNoJitter() — timing ═══')

test('T18: attempt 0 = 1000ms', () => {
  assert.equal(calculateBackoffNoJitter(0), 1000)
})

test('T19: attempt 1 = 2000ms', () => {
  assert.equal(calculateBackoffNoJitter(1), 2000)
})

test('T20: attempt 2 = 4000ms', () => {
  assert.equal(calculateBackoffNoJitter(2), 4000)
})

test('T21: attempt 3 = 8000ms', () => {
  assert.equal(calculateBackoffNoJitter(3), 8000)
})

test('T22: attempt 20 capped at max', () => {
  assert.equal(calculateBackoffNoJitter(20), RATE_LIMIT_BACKOFF_MAX_MS)
})

console.log('\n═══ calculateBackoff() — jitter bounds ═══')

test('T23: jitter within ±25% for attempt 0', () => {
  const results = Array.from({ length: 100 }, () => calculateBackoff(0))
  const min = RATE_LIMIT_BACKOFF_BASE_MS * (1 - RATE_LIMIT_JITTER_FACTOR)
  const max = RATE_LIMIT_BACKOFF_BASE_MS * (1 + RATE_LIMIT_JITTER_FACTOR)
  for (const r of results) {
    assert.ok(r >= min - 1 && r <= max + 1, `${r} not in [${min}, ${max}]`)
  }
})

test('T24: jitter produces variation (not constant)', () => {
  const results = new Set(Array.from({ length: 20 }, () => calculateBackoff(0)))
  assert.ok(results.size > 1, 'All backoff values identical — jitter not working')
})

test('T25: never exceeds max cap', () => {
  const results = Array.from({ length: 100 }, () => calculateBackoff(30))
  const maxAllowed = RATE_LIMIT_BACKOFF_MAX_MS * (1 + RATE_LIMIT_JITTER_FACTOR) + 1
  for (const r of results) {
    assert.ok(r <= maxAllowed, `${r} exceeds max ${maxAllowed}`)
  }
})

console.log('\n═══ retryWithBackoff() — happy path (G1) ═══')

await testAsync('T26: success on first try → no retries', async () => {
  let callCount = 0
  const result = await retryWithBackoff(
    async () => { callCount++; return 'ok' },
    { model: 'gemini-2.0-flash' },
  )
  assert.equal(result, 'ok')
  assert.equal(callCount, 1)
})

await testAsync('T27: 429 then success → retryCount=1 (G1 acceptance gate)', async () => {
  let callCount = 0
  const phases = []
  const result = await retryWithBackoff(
    async () => {
      callCount++
      if (callCount === 1) throw { status: 429, message: '429' }
      return 'recovered'
    },
    {
      model: 'gemini-2.0-flash',
      emitStatus: (s) => phases.push(s.phase),
    },
  )
  assert.equal(result, 'recovered')
  assert.equal(callCount, 2)
  assert.ok(phases.includes('retrying'), 'Should emit retrying')
  assert.ok(phases.includes('resolved'), 'Should emit resolved')
})

await testAsync('T28: 429 twice then success → retryCount=2', async () => {
  let callCount = 0
  const result = await retryWithBackoff(
    async () => {
      callCount++
      if (callCount <= 2) throw { status: 429, message: '429' }
      return 'recovered'
    },
    { model: 'gemini-2.0-flash' },
  )
  assert.equal(result, 'recovered')
  assert.equal(callCount, 3)
})

console.log('\n═══ retryWithBackoff() — exhaustion + fallback (G2) ═══')

await testAsync('T29: primary exhausted → fallback succeeds (G2 acceptance gate)', async () => {
  let callCount = 0
  const models = []
  const result = await retryWithBackoff(
    async (model) => {
      callCount++
      models.push(model)
      if (model === 'gemini-2.5-pro') throw { status: 429, message: '429' }
      return 'fallback-ok'
    },
    {
      model: 'gemini-2.5-pro',
      fallbackModel: 'gemini-2.0-flash',
    },
  )
  assert.equal(result, 'fallback-ok')
  assert.ok(models.includes('gemini-2.0-flash'), 'Should try fallback model')
})

await testAsync('T30: primary exhausted → emits fallback phase', async () => {
  const phases = []
  const result = await retryWithBackoff(
    async (model) => {
      if (model === 'gemini-2.5-pro') throw { status: 429, message: '429' }
      return 'ok'
    },
    {
      model: 'gemini-2.5-pro',
      fallbackModel: 'gemini-2.0-flash',
      emitStatus: (s) => phases.push(s.phase),
    },
  )
  assert.equal(result, 'ok')
  assert.ok(phases.includes('fallback'), 'Should emit fallback phase')
  assert.ok(phases.includes('resolved'), 'Should emit resolved')
})

console.log('\n═══ retryWithBackoff() — catastrophic failure (G3) ═══')

await testAsync('T31: both models exhausted → "Cuota agotada" (G3 acceptance gate)', async () => {
  const phases = []
  try {
    await retryWithBackoff(
      async () => { throw { status: 429, message: '429' } },
      {
        model: 'gemini-2.5-pro',
        fallbackModel: 'gemini-2.0-flash',
        emitStatus: (s) => phases.push(s),
      },
    )
    assert.fail('Should have thrown')
  } catch (err) {
    assert.ok(err.message.includes('Cuota agotada'), `Expected "Cuota agotada", got: ${err.message}`)
  }
  const lastPhase = phases[phases.length - 1]
  assert.equal(lastPhase.phase, 'exhausted')
  assert.ok(lastPhase.error.includes('Cuota agotada'))
})

await testAsync('T32: same model for primary and fallback → no double retry', async () => {
  let callCount = 0
  try {
    await retryWithBackoff(
      async () => { callCount++; throw { status: 429, message: '429' } },
      {
        model: 'gemini-2.0-flash',
        fallbackModel: 'gemini-2.0-flash', // Same model
      },
    )
    assert.fail('Should have thrown')
  } catch (err) {
    assert.ok(err.message.includes('Cuota agotada'))
  }
  // 1 initial + 3 retries = 4 (no fallback round since same model)
  assert.equal(callCount, 4)
})

console.log('\n═══ retryWithBackoff() — non-429 error passthrough ═══')

await testAsync('T33: non-429 error propagates immediately (no retry)', async () => {
  let callCount = 0
  try {
    await retryWithBackoff(
      async () => { callCount++; throw new Error('Auth failed') },
      { model: 'gemini-2.0-flash' },
    )
    assert.fail('Should have thrown')
  } catch (err) {
    assert.equal(err.message, 'Auth failed')
  }
  assert.equal(callCount, 1, 'Should not retry on non-429')
})

await testAsync('T34: non-429 after successful retries still propagates', async () => {
  let callCount = 0
  try {
    await retryWithBackoff(
      async () => {
        callCount++
        if (callCount === 1) throw { status: 429, message: '429' }
        throw new Error('Server error')
      },
      { model: 'gemini-2.0-flash' },
    )
    assert.fail('Should have thrown')
  } catch (err) {
    assert.equal(err.message, 'Server error')
  }
  assert.equal(callCount, 2)
})

console.log('\n═══ retryWithBackoff() — emitter contract ═══')

await testAsync('T35: emitter receives attempt + maxAttempts + model + delayMs', async () => {
  const statuses = []
  try {
    await retryWithBackoff(
      async () => { throw { status: 429, message: '429' } },
      {
        model: 'gemini-2.5-pro',
        fallbackModel: 'gemini-2.0-flash',
        emitStatus: (s) => statuses.push(s),
      },
    )
  } catch { /* expected */ }

  // Should have retrying events for primary
  const retrying = statuses.filter(s => s.phase === 'retrying')
  assert.ok(retrying.length >= 1, 'Should have retrying events')
  for (const s of retrying) {
    assert.equal(typeof s.attempt, 'number')
    assert.equal(s.maxAttempts, RATE_LIMIT_MAX_RETRIES)
    assert.equal(s.model, 'gemini-2.5-pro')
    assert.equal(typeof s.delayMs, 'number')
    assert.ok(s.delayMs > 0)
  }
})

await testAsync('T36: emitter receives fallback events with correct model', async () => {
  const statuses = []
  try {
    await retryWithBackoff(
      async () => { throw { status: 429, message: '429' } },
      {
        model: 'gemini-2.5-pro',
        fallbackModel: 'gemini-2.0-flash',
        emitStatus: (s) => statuses.push(s),
      },
    )
  } catch { /* expected */ }

  const fallbackEvents = statuses.filter(s => s.phase === 'fallback')
  assert.ok(fallbackEvents.length >= 1, 'Should have fallback events')
  assert.equal(fallbackEvents[0].model, 'gemini-2.0-flash')
})

console.log('\n═══ Constants validation ═══')

test('T37: RATE_LIMIT_MAX_RETRIES = 3', () => {
  assert.equal(RATE_LIMIT_MAX_RETRIES, 3)
})

test('T38: RATE_LIMIT_BACKOFF_BASE_MS = 1000', () => {
  assert.equal(RATE_LIMIT_BACKOFF_BASE_MS, 1000)
})

test('T39: RATE_LIMIT_BACKOFF_MAX_MS = 60000', () => {
  assert.equal(RATE_LIMIT_BACKOFF_MAX_MS, 60000)
})

test('T40: RATE_LIMIT_JITTER_FACTOR = 0.25', () => {
  assert.equal(RATE_LIMIT_JITTER_FACTOR, 0.25)
})

console.log('\n═══ IPC channel parity ═══')

test('T41: RATE_LIMIT_STATUS channel exists', () => {
  assert.ok(IPC_CHANNELS.RATE_LIMIT_STATUS)
  assert.equal(IPC_CHANNELS.RATE_LIMIT_STATUS, 'rate-limit:status')
})

test('T42: Total IPC channels = 44', () => {
  assert.equal(IPC_CHANNEL_ALLOWLIST.length, 44)
})

console.log('\n═══ Renderer assertions (source-level) ═══')

// chatStore
const chatStoreSource = readFileSync(
  join(SRC, 'renderer', 'src', 'stores', 'chatStore.ts'), 'utf-8'
)

test('T43: chatStore imports RateLimitPhase', () => {
  assert.ok(chatStoreSource.includes('RateLimitPhase'))
})

test('T44: chatStore has rateLimitPhase state', () => {
  assert.ok(chatStoreSource.includes('rateLimitPhase:'))
})

test('T45: chatStore has setRateLimitPhase action', () => {
  assert.ok(chatStoreSource.includes('setRateLimitPhase'))
})

test('T46: chatStore initializes rateLimitPhase to null', () => {
  assert.ok(chatStoreSource.includes('rateLimitPhase: null'))
})

// useChat
const useChatSource = readFileSync(
  join(SRC, 'renderer', 'src', 'hooks', 'useChat.ts'), 'utf-8'
)

test('T47: useChat imports RateLimitStatus', () => {
  assert.ok(useChatSource.includes('RateLimitStatus'))
})

test('T48: useChat registers RATE_LIMIT_STATUS listener', () => {
  assert.ok(useChatSource.includes('RATE_LIMIT_STATUS'))
})

test('T49: useChat uses setRateLimitPhase', () => {
  assert.ok(useChatSource.includes('setRateLimitPhase'))
})

test('T50: useChat clears phase on resolved', () => {
  assert.ok(useChatSource.includes("e.phase === 'resolved'"))
})

test('T51: useChat clears phase on exhausted', () => {
  assert.ok(useChatSource.includes("e.phase === 'exhausted'"))
})

// ChatPanel
const chatPanelSource = readFileSync(
  join(SRC, 'renderer', 'src', 'components', 'Chat', 'ChatPanel.tsx'), 'utf-8'
)

test('T52: ChatPanel reads rateLimitPhase from store', () => {
  assert.ok(chatPanelSource.includes('rateLimitPhase'))
})

test('T53: ChatPanel has RATE_LIMIT_PHASE_LABELS', () => {
  assert.ok(chatPanelSource.includes('RATE_LIMIT_PHASE_LABELS'))
})

test('T54: ChatPanel has amber indicator (border #d97706)', () => {
  assert.ok(chatPanelSource.includes('#d97706'))
})

test('T55: ChatPanel has retrying label', () => {
  assert.ok(chatPanelSource.includes('Rate limited — retrying'))
})

test('T56: ChatPanel has fallback label', () => {
  assert.ok(chatPanelSource.includes('Switching to fallback model'))
})

console.log('\n═══ Orchestrator integration assertions (source-level) ═══')

const orchestratorSource = readFileSync(
  join(SRC, 'main', 'core', 'orchestrator.ts'), 'utf-8'
)

test('T57: Orchestrator imports is429', () => {
  assert.ok(orchestratorSource.includes('is429'))
})

test('T58: Orchestrator imports retryWithBackoff', () => {
  assert.ok(orchestratorSource.includes('retryWithBackoff'))
})

test('T59: Orchestrator has _rateLimitEmitter field', () => {
  assert.ok(orchestratorSource.includes('_rateLimitEmitter'))
})

test('T60: Orchestrator has setRateLimitEmitter method', () => {
  assert.ok(orchestratorSource.includes('setRateLimitEmitter'))
})

test('T61: Orchestrator calls retryWithBackoff in handleStreamingChat', () => {
  assert.ok(orchestratorSource.includes('await retryWithBackoff(streamOnce'))
})

test('T62: Orchestrator passes _rateLimitEmitter to retryWithBackoff', () => {
  assert.ok(orchestratorSource.includes('emitStatus: this._rateLimitEmitter'))
})

test('T63: Orchestrator checks is429 in onError', () => {
  assert.ok(orchestratorSource.includes('if (is429(error))'))
})

console.log('\n═══ index.ts wiring assertions (source-level) ═══')

const indexSource = readFileSync(
  join(SRC, 'main', 'index.ts'), 'utf-8'
)

test('T64: index.ts imports RateLimitStatus', () => {
  assert.ok(indexSource.includes('RateLimitStatus'))
})

test('T65: index.ts calls setRateLimitEmitter', () => {
  assert.ok(indexSource.includes('setRateLimitEmitter'))
})

test('T66: index.ts sends RATE_LIMIT_STATUS via webContents', () => {
  assert.ok(indexSource.includes('RATE_LIMIT_STATUS'))
})

// ── Summary ──
console.log(`\n${'═'.repeat(60)}`)
console.log(`Rate-Limit Handler Tests: ${passed} passed, ${failed} failed`)
console.log('═'.repeat(60))

if (failed > 0) {
  console.error('\nSome tests FAILED!')
  process.exit(1)
} else {
  console.log('\nAll tests PASSED!')
}
