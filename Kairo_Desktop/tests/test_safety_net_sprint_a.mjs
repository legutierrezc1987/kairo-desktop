/**
 * test_safety_net_sprint_a.mjs — Phase 7 Sprint A: Safety Net Tests
 *
 * Contract validation + prompt construction + budget/router coverage.
 * Zero sealed production files modified — test-only sprint.
 *
 * Sections:
 *   T1: TokenBudgeter functional (20 assertions)
 *   T2: Model Router functional (9 assertions)
 *   T3: System Prompt Builder functional (18 assertions)
 *   T4: JSON Contract Shape verification (35 assertions)
 *   T5: Constants Integrity (25 assertions)
 *
 * Run: node tests/test_safety_net_sprint_a.mjs
 * Expected: 107 assertions PASS, exit 0
 */

import { strict as assert } from 'node:assert'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

// ── esbuild: TokenBudgeter ──
buildSync({
  entryPoints: [resolve(SRC, 'main', 'services', 'token-budgeter.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'token-budgeter.test.mjs'),
  logLevel: 'silent',
})

// ── esbuild: Model Router ──
buildSync({
  entryPoints: [resolve(SRC, 'main', 'services', 'model-router.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'model-router.test.mjs'),
  logLevel: 'silent',
})

// ── esbuild: System Prompt Builder ──
buildSync({
  entryPoints: [resolve(SRC, 'main', 'config', 'system-prompt.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'system-prompt.test.mjs'),
  logLevel: 'silent',
})

// ── esbuild: Constants ──
buildSync({
  entryPoints: [resolve(SRC, 'shared', 'constants.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'constants-safety.test.mjs'),
  logLevel: 'silent',
})

// ── Dynamic imports ──
const { TokenBudgeter } = await import(pathToFileURL(join(buildDir, 'token-budgeter.test.mjs')).href)
const { routeModel } = await import(pathToFileURL(join(buildDir, 'model-router.test.mjs')).href)
const { buildSystemPrompt } = await import(pathToFileURL(join(buildDir, 'system-prompt.test.mjs')).href)
const constants = await import(pathToFileURL(join(buildDir, 'constants-safety.test.mjs')).href)

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

// ═══════════════════════════════════════════════════════════════
// T1: TokenBudgeter Functional Tests (20 assertions)
// ═══════════════════════════════════════════════════════════════
console.log('\n=== Phase 7 Sprint A — Safety Net Tests ===\n')
console.log('--- T1: TokenBudgeter ---')

test('TB01: default budget = 200,000', () => {
  const b = new TokenBudgeter()
  assert.equal(b.getState().totalBudget, 200_000)
})

test('TB02: custom budget accepted', () => {
  const b = new TokenBudgeter(500_000)
  assert.equal(b.getState().totalBudget, 500_000)
})

test('TB03: record() accumulates on single channel', () => {
  const b = new TokenBudgeter()
  b.record('chat', 100)
  b.record('chat', 100)
  b.record('chat', 100)
  assert.equal(b.getChannelBudget('chat').used, 300)
})

test('TB04: record() accumulates on multiple channels independently', () => {
  const b = new TokenBudgeter()
  b.record('chat', 500)
  b.record('terminal', 200)
  assert.equal(b.getChannelBudget('chat').used, 500)
  assert.equal(b.getChannelBudget('terminal').used, 200)
})

test('TB05: getChannelBudget() allocated = floor(totalBudget * allocation)', () => {
  const b = new TokenBudgeter(200_000)
  const chatBudget = b.getChannelBudget('chat')
  assert.equal(chatBudget.allocated, Math.floor(200_000 * 0.55)) // 110_000
})

test('TB06: getChannelBudget() percentage = (used/allocated)*100', () => {
  const b = new TokenBudgeter(200_000)
  b.record('chat', 55_000) // 55K / 110K = 50%
  const chatBudget = b.getChannelBudget('chat')
  assert.equal(chatBudget.percentage, 50)
})

test('TB07: zero usage → percentage = 0', () => {
  const b = new TokenBudgeter()
  assert.equal(b.getChannelBudget('chat').percentage, 0)
})

test('TB08: isOverBudget at exactly 100% → true', () => {
  const b = new TokenBudgeter(200_000)
  const bufferAlloc = Math.floor(200_000 * 0.05) // 10_000
  b.record('buffer', bufferAlloc)
  assert.equal(b.isOverBudget('buffer'), true)
})

test('TB09: isOverBudget at 99.99% → false', () => {
  const b = new TokenBudgeter(200_000)
  const bufferAlloc = Math.floor(200_000 * 0.05) // 10_000
  b.record('buffer', bufferAlloc - 1)
  assert.equal(b.isOverBudget('buffer'), false)
})

test('TB10: isOverBudget at 101% → true', () => {
  const b = new TokenBudgeter(200_000)
  const bufferAlloc = Math.floor(200_000 * 0.05) // 10_000
  b.record('buffer', bufferAlloc + 1)
  assert.equal(b.isOverBudget('buffer'), true)
})

test('TB11: isOverBudget at 0% → false', () => {
  const b = new TokenBudgeter()
  assert.equal(b.isOverBudget('chat'), false)
})

test('TB12: getState() returns 6 channels', () => {
  const b = new TokenBudgeter()
  assert.equal(Object.keys(b.getState().channels).length, 6)
})

test('TB13: channel keys match TokenChannel', () => {
  const b = new TokenBudgeter()
  const keys = Object.keys(b.getState().channels).sort()
  assert.deepEqual(keys, ['buffer', 'chat', 'diffs', 'memory', 'system', 'terminal'])
})

test('TB14: totalUsed = sum of all usage', () => {
  const b = new TokenBudgeter()
  b.record('chat', 1000)
  b.record('terminal', 500)
  b.record('memory', 300)
  assert.equal(b.getState().totalUsed, 1800)
})

test('TB15: totalUsed = 0 on fresh budgeter', () => {
  const b = new TokenBudgeter()
  assert.equal(b.getState().totalUsed, 0)
})

test('TB16: reset() zeros all channels', () => {
  const b = new TokenBudgeter()
  b.record('chat', 5000)
  b.record('terminal', 3000)
  b.reset()
  assert.equal(b.getChannelBudget('chat').used, 0)
  assert.equal(b.getChannelBudget('terminal').used, 0)
})

test('TB17: reset() preserves totalBudget', () => {
  const b = new TokenBudgeter(500_000)
  b.record('chat', 10_000)
  b.reset()
  assert.equal(b.getState().totalBudget, 500_000)
})

test('TB18: reset() → totalUsed = 0', () => {
  const b = new TokenBudgeter()
  b.record('chat', 10_000)
  b.reset()
  assert.equal(b.getState().totalUsed, 0)
})

test('TB19: allocation percentages sum to 1.0', () => {
  const allocs = constants.CHANNEL_ALLOCATIONS
  const sum = Object.values(allocs).reduce((a, b) => a + b, 0)
  assert(Math.abs(sum - 1.0) < 0.001, `Sum was ${sum}`)
})

test('TB20: all 6 TokenChannel keys present in CHANNEL_ALLOCATIONS', () => {
  const keys = Object.keys(constants.CHANNEL_ALLOCATIONS).sort()
  assert.deepEqual(keys, ['buffer', 'chat', 'diffs', 'memory', 'system', 'terminal'])
})

// ═══════════════════════════════════════════════════════════════
// T2: Model Router Functional Tests (9 assertions)
// ═══════════════════════════════════════════════════════════════
console.log('\n--- T2: Model Router ---')

test('MR01: foreground no override → gemini-2.5-pro', () => {
  assert.equal(routeModel('foreground'), 'gemini-2.5-pro')
})

test('MR02: foreground + Flash override → Flash', () => {
  assert.equal(routeModel('foreground', 'gemini-2.0-flash'), 'gemini-2.0-flash')
})

test('MR03: foreground + Lite override → Lite', () => {
  assert.equal(routeModel('foreground', 'gemini-2.0-flash-lite'), 'gemini-2.0-flash-lite')
})

test('MR04: background no override → gemini-2.0-flash', () => {
  assert.equal(routeModel('background'), 'gemini-2.0-flash')
})

test('MR05: background + Pro override → ignores override (Flash)', () => {
  assert.equal(routeModel('background', 'gemini-2.5-pro'), 'gemini-2.0-flash')
})

test('MR06: background + undefined → Flash', () => {
  assert.equal(routeModel('background', undefined), 'gemini-2.0-flash')
})

test('MR07: foreground + undefined → Pro', () => {
  assert.equal(routeModel('foreground', undefined), 'gemini-2.5-pro')
})

test('MR08: MODEL_ROUTING.foreground = gemini-2.5-pro', () => {
  assert.equal(constants.MODEL_ROUTING.foreground, 'gemini-2.5-pro')
})

test('MR09: MODEL_ROUTING.background = gemini-2.0-flash', () => {
  assert.equal(constants.MODEL_ROUTING.background, 'gemini-2.0-flash')
})

// ═══════════════════════════════════════════════════════════════
// T3: System Prompt Builder Functional Tests (18 assertions)
// ═══════════════════════════════════════════════════════════════
console.log('\n--- T3: System Prompt Builder ---')

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

test('SP09: all params → all 4 sections present', () => {
  const result = buildSystemPrompt('Proj', 'recall', 'bridge', 'concise')
  assert(result.includes('## Response Style'), 'Missing visibility')
  assert(result.includes('## Active Project'), 'Missing project')
  assert(result.includes('## Previous Session Context'), 'Missing bridge')
  assert(result.includes('## Memory Recall'), 'Missing recall')
})

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

test('SP17: return type is string', () => {
  const result = buildSystemPrompt('', '', '')
  assert.equal(typeof result, 'string')
})

test('SP18: starts with "You are Kairo"', () => {
  const result = buildSystemPrompt('', '', '')
  assert(result.startsWith('You are Kairo'), `Starts with: "${result.substring(0, 30)}"`)
})

// ═══════════════════════════════════════════════════════════════
// T4: JSON Contract Shape Verification (35 assertions)
// ═══════════════════════════════════════════════════════════════
console.log('\n--- T4: JSON Contract Shapes ---')
{
  const types = readSrc('shared/types.ts')

  // StreamChunk (5)
  test('JC01: StreamChunk.messageId', () => { assert(types.includes('messageId: string')) })
  test('JC02: StreamChunk.delta', () => { assert(types.includes('delta: string')) })
  test('JC03: StreamChunk.done', () => { assert(types.includes('done: boolean')) })
  test('JC04: StreamChunk.tokenCount?', () => { assert(types.includes('tokenCount?: number')) })
  test('JC05: StreamChunk.error?', () => {
    // error?: string appears in multiple interfaces; verify it's in StreamChunk region
    const scStart = types.indexOf('interface StreamChunk')
    const scEnd = types.indexOf('}', scStart)
    const scBlock = types.substring(scStart, scEnd)
    assert(scBlock.includes('error?: string'), 'StreamChunk missing error?')
  })

  // IpcResult (3)
  test('JC06: IpcResult.success', () => { assert(types.includes('success: boolean')) })
  test('JC07: IpcResult.data?', () => { assert(types.includes('data?: T')) })
  test('JC08: IpcResult.error?', () => {
    const irStart = types.indexOf('interface IpcResult')
    const irEnd = types.indexOf('}', irStart)
    const irBlock = types.substring(irStart, irEnd)
    assert(irBlock.includes('error?: string'), 'IpcResult missing error?')
  })

  // ChatMessage (6)
  test('JC09: ChatMessage.id', () => {
    const cmStart = types.indexOf('interface ChatMessage')
    const cmEnd = types.indexOf('}', cmStart)
    const cmBlock = types.substring(cmStart, cmEnd)
    assert(cmBlock.includes('id: string'), 'ChatMessage missing id')
  })
  test('JC10: ChatMessage.role', () => { assert(types.includes('role: ChatRole')) })
  test('JC11: ChatMessage.content', () => {
    const cmStart = types.indexOf('interface ChatMessage')
    const cmEnd = types.indexOf('}', cmStart)
    const cmBlock = types.substring(cmStart, cmEnd)
    assert(cmBlock.includes('content: string'), 'ChatMessage missing content')
  })
  test('JC12: ChatMessage.timestamp', () => {
    const cmStart = types.indexOf('interface ChatMessage')
    const cmEnd = types.indexOf('}', cmStart)
    const cmBlock = types.substring(cmStart, cmEnd)
    assert(cmBlock.includes('timestamp: number'), 'ChatMessage missing timestamp')
  })
  test('JC13: ChatMessage.model?', () => { assert(types.includes('model?: ModelId')) })
  test('JC14: ChatMessage.tokenCount?', () => {
    const cmStart = types.indexOf('interface ChatMessage')
    const cmEnd = types.indexOf('}', cmStart)
    const cmBlock = types.substring(cmStart, cmEnd)
    assert(cmBlock.includes('tokenCount?: number'), 'ChatMessage missing tokenCount?')
  })

  // TokenBudgetState (3)
  test('JC15: TokenBudgetState.totalBudget', () => {
    const tbStart = types.indexOf('interface TokenBudgetState')
    const tbEnd = types.indexOf('}', tbStart)
    const tbBlock = types.substring(tbStart, tbEnd)
    assert(tbBlock.includes('totalBudget: number'), 'TokenBudgetState missing totalBudget')
  })
  test('JC16: TokenBudgetState.totalUsed', () => {
    const tbStart = types.indexOf('interface TokenBudgetState')
    const tbEnd = types.indexOf('}', tbStart)
    const tbBlock = types.substring(tbStart, tbEnd)
    assert(tbBlock.includes('totalUsed: number'), 'TokenBudgetState missing totalUsed')
  })
  test('JC17: TokenBudgetState.channels', () => {
    assert(types.includes('channels: Record<TokenChannel, ChannelBudget>'))
  })

  // ChannelBudget (4)
  test('JC18: ChannelBudget.channel', () => { assert(types.includes('channel: TokenChannel')) })
  test('JC19: ChannelBudget.allocated', () => { assert(types.includes('allocated: number')) })
  test('JC20: ChannelBudget.used', () => {
    const cbStart = types.indexOf('interface ChannelBudget')
    const cbEnd = types.indexOf('}', cbStart)
    const cbBlock = types.substring(cbStart, cbEnd)
    assert(cbBlock.includes('used: number'), 'ChannelBudget missing used')
  })
  test('JC21: ChannelBudget.percentage', () => { assert(types.includes('percentage: number')) })

  // Union types — CutPipelinePhase (8 values)
  test('JC22: CutPipelinePhase has all 8 values', () => {
    const vals = ['blocking', 'counting', 'generating', 'saving', 'uploading', 'recalling', 'ready', 'error']
    for (const v of vals) {
      assert(types.includes(`'${v}'`), `CutPipelinePhase missing '${v}'`)
    }
  })

  // RecallTrigger (6 values)
  test('JC23: RecallTrigger has all 6 values', () => {
    const vals = ['session_start', 'task_change', 'critical_action', 'periodic', 'contradiction', 'manual']
    for (const v of vals) {
      assert(types.includes(`'${v}'`), `RecallTrigger missing '${v}'`)
    }
  })

  // ConsolidationPhase (7 values)
  test('JC24: ConsolidationPhase has all 7 values', () => {
    const vals = ['claiming', 'merging', 'uploading', 'deleting', 'done', 'skipped', 'error']
    for (const v of vals) {
      assert(types.includes(`'${v}'`), `ConsolidationPhase missing '${v}'`)
    }
  })

  // RateLimitPhase (4 values)
  test('JC25: RateLimitPhase has all 4 values', () => {
    const vals = ['retrying', 'fallback', 'resolved', 'exhausted']
    for (const v of vals) {
      assert(types.includes(`'${v}'`), `RateLimitPhase missing '${v}'`)
    }
  })

  // ModelId (3 values)
  test('JC26: ModelId has all 3 values', () => {
    const vals = ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
    for (const v of vals) {
      assert(types.includes(`'${v}'`), `ModelId missing '${v}'`)
    }
  })

  // VisibilityMode (2 values)
  test('JC27: VisibilityMode has both values', () => {
    assert(types.includes("'concise'"), 'Missing concise')
    assert(types.includes("'detailed'"), 'Missing detailed')
  })

  // TokenChannel (6 values)
  test('JC28: TokenChannel has all 6 values', () => {
    const vals = ['chat', 'terminal', 'diffs', 'memory', 'system', 'buffer']
    for (const v of vals) {
      assert(types.includes(`'${v}'`), `TokenChannel missing '${v}'`)
    }
  })

  // RoutingContext (2 values)
  test('JC29: RoutingContext has both values', () => {
    assert(types.includes("'foreground'"), 'Missing foreground')
    assert(types.includes("'background'"), 'Missing background')
  })

  // Request/Response shapes (6)
  test('JC30: SendMessageRequest.content', () => {
    const smStart = types.indexOf('interface SendMessageRequest')
    const smEnd = types.indexOf('}', smStart)
    const smBlock = types.substring(smStart, smEnd)
    assert(smBlock.includes('content: string'), 'SendMessageRequest missing content')
  })

  test('JC31: SendMessageResponse.tokenUsage', () => {
    assert(types.includes('tokenUsage:'), 'SendMessageResponse missing tokenUsage')
  })

  test('JC32: RateLimitStatus.phase', () => {
    const rlStart = types.indexOf('interface RateLimitStatus')
    const rlEnd = types.indexOf('}', rlStart)
    const rlBlock = types.substring(rlStart, rlEnd)
    assert(rlBlock.includes('phase: RateLimitPhase'), 'RateLimitStatus missing phase')
  })

  test('JC33: RateLimitStatus.attempt', () => {
    const rlStart = types.indexOf('interface RateLimitStatus')
    const rlEnd = types.indexOf('}', rlStart)
    const rlBlock = types.substring(rlStart, rlEnd)
    assert(rlBlock.includes('attempt: number'), 'RateLimitStatus missing attempt')
  })

  test('JC34: RateLimitStatus.maxAttempts', () => {
    const rlStart = types.indexOf('interface RateLimitStatus')
    const rlEnd = types.indexOf('}', rlStart)
    const rlBlock = types.substring(rlStart, rlEnd)
    assert(rlBlock.includes('maxAttempts: number'), 'RateLimitStatus missing maxAttempts')
  })

  test('JC35: RateLimitStatus.model', () => {
    const rlStart = types.indexOf('interface RateLimitStatus')
    const rlEnd = types.indexOf('}', rlStart)
    const rlBlock = types.substring(rlStart, rlEnd)
    assert(rlBlock.includes('model: string'), 'RateLimitStatus missing model')
  })
}

// ═══════════════════════════════════════════════════════════════
// T5: Constants Integrity (25 assertions)
// ═══════════════════════════════════════════════════════════════
console.log('\n--- T5: Constants Integrity ---')

test('CI01: CHANNEL_ALLOCATIONS has 6 keys', () => {
  assert.equal(Object.keys(constants.CHANNEL_ALLOCATIONS).length, 6)
})

test('CI02: CHANNEL_ALLOCATIONS values sum to 1.0', () => {
  const sum = Object.values(constants.CHANNEL_ALLOCATIONS).reduce((a, b) => a + b, 0)
  assert(Math.abs(sum - 1.0) < 0.001, `Sum was ${sum}`)
})

test('CI03: DEFAULT_BUDGET = 200,000', () => {
  assert.equal(constants.DEFAULT_BUDGET, 200_000)
})

test('CI04: DEFAULT_BUDGET > 0', () => {
  assert(constants.DEFAULT_BUDGET > 0)
})

test('CI05: SESSION_CUT_THRESHOLD_PERCENT = 0.80', () => {
  assert.equal(constants.SESSION_CUT_THRESHOLD_PERCENT, 0.80)
})

test('CI06: SESSION_CUT_THRESHOLD_PERCENT between 0 and 1', () => {
  assert(constants.SESSION_CUT_THRESHOLD_PERCENT > 0 && constants.SESSION_CUT_THRESHOLD_PERCENT < 1)
})

test('CI07: MODEL_ROUTING has foreground key', () => {
  assert('foreground' in constants.MODEL_ROUTING)
})

test('CI08: MODEL_ROUTING has background key', () => {
  assert('background' in constants.MODEL_ROUTING)
})

test('CI09: MODEL_ROUTING.foreground = gemini-2.5-pro', () => {
  assert.equal(constants.MODEL_ROUTING.foreground, 'gemini-2.5-pro')
})

test('CI10: MODEL_ROUTING.background = gemini-2.0-flash', () => {
  assert.equal(constants.MODEL_ROUTING.background, 'gemini-2.0-flash')
})

test('CI11: BUDGET_PRESETS.conservative > CUSTOM_BUDGET_MIN', () => {
  assert(constants.BUDGET_PRESETS.conservative > constants.CUSTOM_BUDGET_MIN)
})

test('CI12: BUDGET_PRESETS.balanced > CUSTOM_BUDGET_MIN', () => {
  assert(constants.BUDGET_PRESETS.balanced > constants.CUSTOM_BUDGET_MIN)
})

test('CI13: BUDGET_PRESETS.extended > CUSTOM_BUDGET_MIN', () => {
  assert(constants.BUDGET_PRESETS.extended > constants.CUSTOM_BUDGET_MIN)
})

test('CI14: CUSTOM_BUDGET_MAX > CUSTOM_BUDGET_MIN', () => {
  assert(constants.CUSTOM_BUDGET_MAX > constants.CUSTOM_BUDGET_MIN)
})

test('CI15: CUSTOM_BUDGET_MIN = 50,000', () => {
  assert.equal(constants.CUSTOM_BUDGET_MIN, 50_000)
})

test('CI16: CUSTOM_BUDGET_MAX = 1,000,000', () => {
  assert.equal(constants.CUSTOM_BUDGET_MAX, 1_000_000)
})

test('CI17: RATE_LIMIT_BACKOFF_BASE_MS > 0', () => {
  assert(constants.RATE_LIMIT_BACKOFF_BASE_MS > 0)
})

test('CI18: RATE_LIMIT_BACKOFF_MULTIPLIER > 1', () => {
  assert(constants.RATE_LIMIT_BACKOFF_MULTIPLIER > 1)
})

test('CI19: RATE_LIMIT_BACKOFF_MAX_MS > RATE_LIMIT_BACKOFF_BASE_MS', () => {
  assert(constants.RATE_LIMIT_BACKOFF_MAX_MS > constants.RATE_LIMIT_BACKOFF_BASE_MS)
})

test('CI20: RATE_LIMIT_JITTER_FACTOR between 0 and 1', () => {
  assert(constants.RATE_LIMIT_JITTER_FACTOR > 0 && constants.RATE_LIMIT_JITTER_FACTOR < 1)
})

test('CI21: IPC channels = 47', () => {
  const ipcSrc = readSrc('shared/ipc-channels.ts')
  const channelPattern = /:\s*'([a-z][-a-z]*:[a-z][-a-z]*)'/g
  const channels = []
  let m
  while ((m = channelPattern.exec(ipcSrc)) !== null) channels.push(m[1])
  assert.equal(channels.length, 47, `Expected 47 channels, got ${channels.length}`)
})

test('CI22: MAX_TURNS_PER_SESSION = 40', () => {
  assert.equal(constants.MAX_TURNS_PER_SESSION, 40)
})

test('CI23: CONSOLIDATION_SOURCE_THRESHOLD = 40', () => {
  assert.equal(constants.CONSOLIDATION_SOURCE_THRESHOLD, 40)
})

test('CI24: all BUDGET_PRESETS values > 0', () => {
  assert(constants.BUDGET_PRESETS.conservative > 0)
  assert(constants.BUDGET_PRESETS.balanced > 0)
  assert(constants.BUDGET_PRESETS.extended > 0)
})

test('CI25: RECALL_BUDGET_TOKENS > 0', () => {
  assert(constants.RECALL_BUDGET_TOKENS > 0)
})

// ═══════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Safety net tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All safety net Sprint A tests pass.\n')
  process.exit(0)
}
