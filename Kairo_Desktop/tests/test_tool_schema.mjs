/**
 * test_tool_schema.mjs — Phase 7 Sprint A Delta: JSON Contract Shape Verification
 *
 * Source-level validation that critical TypeScript interfaces and union types
 * in shared/types.ts maintain their expected fields. Catches accidental
 * regressions in the IPC contract surface.
 *
 * Run: node tests/test_tool_schema.mjs
 * Expected: 35 assertions PASS, exit 0
 */

import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '..', 'src')

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

/** Extract an interface block from source (between `interface X` and its closing `}`) */
function extractBlock(source, interfaceName) {
  const start = source.indexOf(`interface ${interfaceName}`)
  if (start === -1) throw new Error(`Interface ${interfaceName} not found in source`)
  const end = source.indexOf('}', start)
  return source.substring(start, end + 1)
}

const types = readFileSync(resolve(SRC, 'shared', 'types.ts'), 'utf-8')

console.log('\n=== Phase 7 Sprint A Delta — JSON Contract Shapes ===\n')

// ─── StreamChunk (5 assertions) ──────────────────────────────
console.log('--- StreamChunk ---')

test('JC01: StreamChunk.messageId: string', () => {
  const block = extractBlock(types, 'StreamChunk')
  assert(block.includes('messageId: string'), 'Missing messageId')
})

test('JC02: StreamChunk.delta: string', () => {
  const block = extractBlock(types, 'StreamChunk')
  assert(block.includes('delta: string'), 'Missing delta')
})

test('JC03: StreamChunk.done: boolean', () => {
  const block = extractBlock(types, 'StreamChunk')
  assert(block.includes('done: boolean'), 'Missing done')
})

test('JC04: StreamChunk.tokenCount?: number', () => {
  const block = extractBlock(types, 'StreamChunk')
  assert(block.includes('tokenCount?: number'), 'Missing tokenCount')
})

test('JC05: StreamChunk.error?: string', () => {
  const block = extractBlock(types, 'StreamChunk')
  assert(block.includes('error?: string'), 'Missing error')
})

// ─── IpcResult (3 assertions) ──────────────────────────────
console.log('\n--- IpcResult ---')

test('JC06: IpcResult.success: boolean', () => {
  const block = extractBlock(types, 'IpcResult')
  assert(block.includes('success: boolean'), 'Missing success')
})

test('JC07: IpcResult.data?: T', () => {
  const block = extractBlock(types, 'IpcResult')
  assert(block.includes('data?: T'), 'Missing data')
})

test('JC08: IpcResult.error?: string', () => {
  const block = extractBlock(types, 'IpcResult')
  assert(block.includes('error?: string'), 'Missing error')
})

// ─── ChatMessage (6 assertions) ──────────────────────────────
console.log('\n--- ChatMessage ---')

test('JC09: ChatMessage.id: string', () => {
  const block = extractBlock(types, 'ChatMessage')
  assert(block.includes('id: string'), 'Missing id')
})

test('JC10: ChatMessage.role: ChatRole', () => {
  const block = extractBlock(types, 'ChatMessage')
  assert(block.includes('role: ChatRole'), 'Missing role')
})

test('JC11: ChatMessage.content: string', () => {
  const block = extractBlock(types, 'ChatMessage')
  assert(block.includes('content: string'), 'Missing content')
})

test('JC12: ChatMessage.timestamp: number', () => {
  const block = extractBlock(types, 'ChatMessage')
  assert(block.includes('timestamp: number'), 'Missing timestamp')
})

test('JC13: ChatMessage.model?: ModelId', () => {
  const block = extractBlock(types, 'ChatMessage')
  assert(block.includes('model?: ModelId'), 'Missing model')
})

test('JC14: ChatMessage.tokenCount?: number', () => {
  const block = extractBlock(types, 'ChatMessage')
  assert(block.includes('tokenCount?: number'), 'Missing tokenCount')
})

// ─── TokenBudgetState (3 assertions) ────────────────────────
console.log('\n--- TokenBudgetState ---')

test('JC15: TokenBudgetState.totalBudget: number', () => {
  const block = extractBlock(types, 'TokenBudgetState')
  assert(block.includes('totalBudget: number'), 'Missing totalBudget')
})

test('JC16: TokenBudgetState.totalUsed: number', () => {
  const block = extractBlock(types, 'TokenBudgetState')
  assert(block.includes('totalUsed: number'), 'Missing totalUsed')
})

test('JC17: TokenBudgetState.channels: Record<TokenChannel, ChannelBudget>', () => {
  assert(types.includes('channels: Record<TokenChannel, ChannelBudget>'))
})

// ─── ChannelBudget (4 assertions) ────────────────────────────
console.log('\n--- ChannelBudget ---')

test('JC18: ChannelBudget.channel: TokenChannel', () => {
  const block = extractBlock(types, 'ChannelBudget')
  assert(block.includes('channel: TokenChannel'), 'Missing channel')
})

test('JC19: ChannelBudget.allocated: number', () => {
  const block = extractBlock(types, 'ChannelBudget')
  assert(block.includes('allocated: number'), 'Missing allocated')
})

test('JC20: ChannelBudget.used: number', () => {
  const block = extractBlock(types, 'ChannelBudget')
  assert(block.includes('used: number'), 'Missing used')
})

test('JC21: ChannelBudget.percentage: number', () => {
  const block = extractBlock(types, 'ChannelBudget')
  assert(block.includes('percentage: number'), 'Missing percentage')
})

// ─── Union Types (8 assertions) ──────────────────────────────
console.log('\n--- Union Types ---')

test('JC22: CutPipelinePhase has all 8 values', () => {
  const vals = ['blocking', 'counting', 'generating', 'saving', 'uploading', 'recalling', 'ready', 'error']
  for (const v of vals) {
    assert(types.includes(`'${v}'`), `CutPipelinePhase missing '${v}'`)
  }
})

test('JC23: RecallTrigger has all 6 values', () => {
  const vals = ['session_start', 'task_change', 'critical_action', 'periodic', 'contradiction', 'manual']
  for (const v of vals) {
    assert(types.includes(`'${v}'`), `RecallTrigger missing '${v}'`)
  }
})

test('JC24: ConsolidationPhase has all 7 values', () => {
  const vals = ['claiming', 'merging', 'uploading', 'deleting', 'done', 'skipped', 'error']
  for (const v of vals) {
    assert(types.includes(`'${v}'`), `ConsolidationPhase missing '${v}'`)
  }
})

test('JC25: RateLimitPhase has all 4 values', () => {
  const vals = ['retrying', 'fallback', 'resolved', 'exhausted']
  for (const v of vals) {
    assert(types.includes(`'${v}'`), `RateLimitPhase missing '${v}'`)
  }
})

test('JC26: ModelId has all 3 values', () => {
  const vals = ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  for (const v of vals) {
    assert(types.includes(`'${v}'`), `ModelId missing '${v}'`)
  }
})

test('JC27: VisibilityMode has both values', () => {
  assert(types.includes("'concise'"), 'Missing concise')
  assert(types.includes("'detailed'"), 'Missing detailed')
})

test('JC28: TokenChannel has all 6 values', () => {
  const vals = ['chat', 'terminal', 'diffs', 'memory', 'system', 'buffer']
  for (const v of vals) {
    assert(types.includes(`'${v}'`), `TokenChannel missing '${v}'`)
  }
})

test('JC29: RoutingContext has both values', () => {
  assert(types.includes("'foreground'"), 'Missing foreground')
  assert(types.includes("'background'"), 'Missing background')
})

// ─── Request/Response Shapes (6 assertions) ──────────────────
console.log('\n--- Request/Response Shapes ---')

test('JC30: SendMessageRequest.content: string', () => {
  const block = extractBlock(types, 'SendMessageRequest')
  assert(block.includes('content: string'), 'Missing content')
})

test('JC31: SendMessageResponse has tokenUsage', () => {
  const block = extractBlock(types, 'SendMessageResponse')
  assert(block.includes('tokenUsage'), 'Missing tokenUsage')
})

test('JC32: RateLimitStatus.phase: RateLimitPhase', () => {
  const block = extractBlock(types, 'RateLimitStatus')
  assert(block.includes('phase: RateLimitPhase'), 'Missing phase')
})

test('JC33: RateLimitStatus.attempt: number', () => {
  const block = extractBlock(types, 'RateLimitStatus')
  assert(block.includes('attempt: number'), 'Missing attempt')
})

test('JC34: RateLimitStatus.maxAttempts: number', () => {
  const block = extractBlock(types, 'RateLimitStatus')
  assert(block.includes('maxAttempts: number'), 'Missing maxAttempts')
})

test('JC35: RateLimitStatus.model: string', () => {
  const block = extractBlock(types, 'RateLimitStatus')
  assert(block.includes('model: string'), 'Missing model')
})

// ─── Summary ──────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

if (failed > 0) {
  console.error('\nFAILED — Contract shape tests have errors.')
  process.exit(1)
} else {
  console.log('\nPASSED — All JSON contract shape tests pass.\n')
  process.exit(0)
}
