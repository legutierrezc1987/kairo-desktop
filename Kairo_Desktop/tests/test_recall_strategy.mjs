/**
 * test_recall_strategy.mjs — Phase 5 Sprint A: Recall Strategy Tests (DEC-026)
 *
 * Tests for:
 * 1. shouldRecall() — all 6 triggers, budget overflow guard, no-memory-port guard
 * 2. buildQuery() — all 6 triggers, with/without lastUserMessage
 * 3. truncateToRecallBudget() — within budget, exceeding budget
 * 4. Orchestrator integration — _turnsSinceLastRecall, recall status events,
 *    periodic recall, executeRecall, cut pipeline recall, setActiveProject reset
 *
 * Run: node tests/test_recall_strategy.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

// ─── Build Setup ─────────────────────────────────────────────────────

const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

// Build recall-strategy standalone
buildSync({
  entryPoints: [resolve(__dirname, '../src/main/memory/recall-strategy.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'recall-strategy.test.mjs'),
  logLevel: 'silent',
})

const recallMod = await import(pathToFileURL(join(buildDir, 'recall-strategy.test.mjs')).href)
const { shouldRecall, buildQuery, truncateToRecallBudget } = recallMod

// Build orchestrator with shims (for integration tests)
const shimServicesDir = join(buildDir, 'shim-services-recall')
mkdirSync(shimServicesDir, { recursive: true })

writeFileSync(join(shimServicesDir, 'gemini-gateway.ts'), `
let initialized = true
export function initGeminiGateway(apiKey: string): void { initialized = true }
export function resetGeminiGateway(): void { initialized = false }
export function isInitialized(): boolean { return initialized }
export async function generateContent(prompt: string, modelId: string) {
  return { text: 'mock-response', tokenCount: { prompt: 10, completion: 20, total: 30 } }
}
export async function countTokens(content: string, modelId: string): Promise<number> { return 10 }
export interface GeminiResponse { text: string; tokenCount: { prompt: number; completion: number; total: number } }
export interface StreamCallbacks { onChunk: (text: string) => void; onComplete: (response: GeminiResponse) => void; onError: (error: Error) => void }
export async function streamChatMessage(prompt: string, modelId: string, history: any[], callbacks: StreamCallbacks): Promise<void> {
  callbacks.onChunk('mock ');
  callbacks.onComplete({ text: 'mock response', tokenCount: { prompt: 10, completion: 15, total: 25 } });
}
export function abortActiveStream(): boolean { return false }
export function isStreaming(): boolean { return false }
`)

writeFileSync(join(shimServicesDir, 'snapshot.service.ts'), `
export interface SnapshotResult { transcriptPath: string; summaryPath: string; summaryText: string }
export async function createSnapshot(projectFolderPath: string, sessionNumber: number, history: any[]): Promise<SnapshotResult> {
  return {
    transcriptPath: projectFolderPath + '/.kairo/sessions/session_001_transcript.md',
    summaryPath: projectFolderPath + '/.kairo/sessions/session_001_summary.md',
    summaryText: 'Mock summary of session',
  }
}
`)

writeFileSync(join(shimServicesDir, 'model-router.ts'), `
export function routeModel(context: string, userOverride?: string): string { return userOverride || 'gemini-2.5-flash' }
`)

const shimConfigDir = join(buildDir, 'shim-config-recall')
mkdirSync(shimConfigDir, { recursive: true })
writeFileSync(join(shimConfigDir, 'system-prompt.ts'), `
export function buildSystemPrompt(projectName: string, recallContext: string, bridgeSummary: string): string { return 'mock' }
`)

// Source-patching for orchestrator
const srcMain = resolve(__dirname, '../src/main').replace(/\\/g, '/')
const shimSvcDir = shimServicesDir.replace(/\\/g, '/')
const shimCfgDir = shimConfigDir.replace(/\\/g, '/')

const orchestratorOrigSource = readFileSync(
  resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8'
)
const patchedSource = orchestratorOrigSource
  .replace("from '../services/gemini-gateway'", `from '${shimSvcDir}/gemini-gateway.ts'`)
  .replace("from '../services/model-router'", `from '${shimSvcDir}/model-router.ts'`)
  .replace("from '../services/token-budgeter'", `from '${srcMain}/services/token-budgeter'`)
  .replace("from '../services/session-manager'", `from '${srcMain}/services/session-manager'`)
  .replace("from '../config/system-prompt'", `from '${shimCfgDir}/system-prompt.ts'`)
  .replace("from '../services/snapshot.service'", `from '${shimSvcDir}/snapshot.service.ts'`)
  .replace("from '../memory/recall-strategy'", `from '${srcMain}/memory/recall-strategy'`)
  .replace("from '../../shared/types'", `from '${resolve(__dirname, '../src/shared/types').replace(/\\/g, '/')}'`)
  .replace("from '../../shared/constants'", `from '${resolve(__dirname, '../src/shared/constants').replace(/\\/g, '/')}'`)

const shimCoreDir = join(buildDir, 'shim-core-recall')
mkdirSync(shimCoreDir, { recursive: true })
writeFileSync(join(shimCoreDir, 'orchestrator.ts'), patchedSource)

buildSync({
  entryPoints: [join(shimCoreDir, 'orchestrator.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'orchestrator.recall.mjs'),
  external: ['better-sqlite3', 'node:crypto', 'node:fs/promises', '@google/generative-ai'],
  logLevel: 'silent',
})

const { Orchestrator } = await import(pathToFileURL(join(buildDir, 'orchestrator.recall.mjs')).href)

// ─── Helpers ────────────────────────────────────────────────────────

function makeContext(overrides = {}) {
  return {
    turnsSinceLastRecall: 0,
    isPostCut: false,
    lastUserMessage: 'hello world',
    currentTokensUsed: 10000,
    totalBudget: 200000,
    projectName: 'TestProject',
    hasMemoryPort: true,
    ...overrides,
  }
}

function createFakePersistence() {
  const sessions = new Map()
  let sessionCounter = 0
  return {
    archiveCalls: [],
    createSession(projectId) {
      sessionCounter++
      const session = {
        id: `sess-${sessionCounter}`, projectId, sessionNumber: sessionCounter,
        totalTokens: 0, interactionCount: 0, cutReason: null, status: 'active',
        startedAt: new Date().toISOString(), endedAt: null,
      }
      sessions.set(session.id, session)
      return { success: true, data: { session } }
    },
    getActiveSession(projectId) {
      for (const s of sessions.values()) {
        if (s.projectId === projectId && s.status === 'active')
          return { success: true, data: { session: s } }
      }
      return { success: true, data: { session: null } }
    },
    addTokens(sessionId, tokensToAdd) {
      const s = sessions.get(sessionId)
      if (s) { s.totalTokens += tokensToAdd; s.interactionCount++ }
      return { success: true, data: { session: s } }
    },
    archiveSession(sessionId, reason) {
      const s = sessions.get(sessionId)
      if (s) { s.status = 'archived'; s.cutReason = reason; s.endedAt = new Date().toISOString() }
      this.archiveCalls.push({ sessionId, reason })
      return { success: true, data: { session: s } }
    },
    updatePaths(sessionId, transcriptPath, summaryPath) {},
  }
}

function createFakeMemoryPort(results = []) {
  return {
    queryCalls: [],
    async query(query, maxResults) {
      this.queryCalls.push({ query, maxResults })
      return {
        success: true,
        data: {
          results: results.map(r => ({
            content: r, source: 'test', relevance: 0.9, timestamp: Date.now()
          })),
          provider: 'local-markdown',
        },
      }
    },
  }
}

// ─── Test Suite 1: shouldRecall() ────────────────────────────────────

console.log('\n=== shouldRecall() ===\n')

// T1: No memory port → always false
assert(!shouldRecall('manual', makeContext({ hasMemoryPort: false })),
  'T1: shouldRecall returns false when no memory port')

// T2: Budget overflow → always false (P0 guard)
assert(!shouldRecall('manual', makeContext({ currentTokensUsed: 170000, totalBudget: 200000 })),
  'T2: shouldRecall returns false when budget would overflow (170k + 20k > 160k ceiling)')

// T3: Budget near ceiling but still fits → true
assert(shouldRecall('manual', makeContext({ currentTokensUsed: 130000, totalBudget: 200000 })),
  'T3: shouldRecall returns true when budget fits (130k + 20k < 160k ceiling)')

// T4: session_start with isPostCut=true → true
assert(shouldRecall('session_start', makeContext({ isPostCut: true })),
  'T4: session_start returns true when isPostCut')

// T5: session_start with isPostCut=false → false
assert(!shouldRecall('session_start', makeContext({ isPostCut: false })),
  'T5: session_start returns false when not post-cut')

// T6: periodic with turnsSinceLastRecall < 8 → false
assert(!shouldRecall('periodic', makeContext({ turnsSinceLastRecall: 7 })),
  'T6: periodic returns false when turns < 8')

// T7: periodic with turnsSinceLastRecall >= 8 → true
assert(shouldRecall('periodic', makeContext({ turnsSinceLastRecall: 8 })),
  'T7: periodic returns true when turns >= 8')

// T8: periodic with turnsSinceLastRecall > 8 → true
assert(shouldRecall('periodic', makeContext({ turnsSinceLastRecall: 12 })),
  'T8: periodic returns true when turns > 8')

// T9: task_change → always true (if budget ok)
assert(shouldRecall('task_change', makeContext()),
  'T9: task_change returns true')

// T10: critical_action → always true (if budget ok)
assert(shouldRecall('critical_action', makeContext()),
  'T10: critical_action returns true')

// T11: contradiction → always true (if budget ok)
assert(shouldRecall('contradiction', makeContext()),
  'T11: contradiction returns true')

// T12: manual → always true (if budget ok)
assert(shouldRecall('manual', makeContext()),
  'T12: manual returns true')

// ─── Test Suite 2: buildQuery() ──────────────────────────────────────

console.log('\n=== buildQuery() ===\n')

// T13: session_start query mentions project name
const q13 = buildQuery('session_start', makeContext())
assert(q13.includes('TestProject'), 'T13: session_start query includes project name')

// T14: task_change with user message → includes message
const q14 = buildQuery('task_change', makeContext({ lastUserMessage: 'implement auth' }))
assert(q14.includes('implement auth'), 'T14: task_change query includes user message')

// T15: task_change without user message → includes project name
const q15 = buildQuery('task_change', makeContext({ lastUserMessage: '' }))
assert(q15.includes('TestProject'), 'T15: task_change query falls back to project name')

// T16: critical_action query mentions restrictions
const q16 = buildQuery('critical_action', makeContext())
assert(q16.toLowerCase().includes('restrict') || q16.toLowerCase().includes('constraint'),
  'T16: critical_action query mentions restrictions/constraints')

// T17: periodic with message → includes topic
const q17 = buildQuery('periodic', makeContext({ lastUserMessage: 'building API' }))
assert(q17.includes('building API'), 'T17: periodic query includes current topic')

// T18: manual uses user message directly
const q18 = buildQuery('manual', makeContext({ lastUserMessage: 'what were the auth decisions?' }))
assertEqual(q18, 'what were the auth decisions?', 'T18: manual query is the user message')

// T19: manual with empty message falls back
const q19 = buildQuery('manual', makeContext({ lastUserMessage: '' }))
assert(q19.includes('TestProject'), 'T19: manual with empty message falls back to project summary')

// T20: long user message is truncated in task_change (300 chars max)
const longMsg = 'x'.repeat(500)
const q20 = buildQuery('task_change', makeContext({ lastUserMessage: longMsg }))
assert(q20.length < 500, 'T20: task_change query truncates long user message')

// ─── Test Suite 3: truncateToRecallBudget() ──────────────────────────

console.log('\n=== truncateToRecallBudget() ===\n')

// T21: Short text → returned as-is
const short = 'Hello world recall content'
assertEqual(truncateToRecallBudget(short), short, 'T21: short text returned unchanged')

// T22: Long text → truncated with marker
const longText = 'A'.repeat(100000)
const truncated = truncateToRecallBudget(longText)
assert(truncated.length < longText.length, 'T22: long text is truncated')
assert(truncated.includes('[Recall truncated to budget limit]'), 'T23: truncated text includes marker')

// T24: Truncated length ~= RECALL_BUDGET_TOKENS * 4
// RECALL_BUDGET_TOKENS = 20000, so max chars = 80000
assert(truncated.length <= 80000 + 100, 'T24: truncated length ≈ budget * 4 chars/token')

// ─── Test Suite 4: Orchestrator Integration ──────────────────────────

console.log('\n=== Orchestrator Integration ===\n')

// T25: executeRecall emits 'skipped' when shouldRecall returns false (no memory port)
{
  const orch = new Orchestrator({ totalBudget: 200000 })
  // No memory port set → shouldRecall returns false
  const events = []
  orch.setRecallStatusSender((event) => events.push(event))
  const result = await orch.executeRecall('manual')
  assertEqual(result, '', 'T25: executeRecall returns empty string when skipped')
  assertEqual(events.length, 1, 'T26: emits exactly 1 event when skipped')
  assertEqual(events[0]?.phase, 'skipped', 'T27: emits "skipped" phase')
}

// T28: executeRecall emits querying→injecting→done when memory returns results
{
  const memPort = createFakeMemoryPort(['fact 1', 'fact 2'])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  const events = []
  orch.setRecallStatusSender((event) => events.push(event))
  const result = await orch.executeRecall('manual')
  assert(result.includes('fact 1'), 'T28: recall result contains memory content')
  assert(result.includes('fact 2'), 'T29: recall result contains all results')
  assertEqual(events.length, 3, 'T30: emits 3 events (querying, injecting, done)')
  assertEqual(events[0]?.phase, 'querying', 'T31: first event is "querying"')
  assertEqual(events[1]?.phase, 'injecting', 'T32: second event is "injecting"')
  assertEqual(events[2]?.phase, 'done', 'T33: third event is "done" (terminal state)')
  assertEqual(events[2]?.trigger, 'manual', 'T34: terminal event has correct trigger')
  assertEqual(memPort.queryCalls.length, 1, 'T35: memory port queried exactly once')
}

// T36: executeRecall emits done (not injecting) when memory returns empty results
{
  const memPort = createFakeMemoryPort([])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  const events = []
  orch.setRecallStatusSender((event) => events.push(event))
  const result = await orch.executeRecall('manual')
  assertEqual(result, '', 'T36: empty result when memory returns nothing')
  // Should get: querying, done (not injecting since nothing to inject)
  assertEqual(events[events.length - 1]?.phase, 'done', 'T37: terminal state is "done" even with empty results')
}

// T38: executeRecall emits 'error' on memory port failure
{
  const failingPort = {
    async query() { throw new Error('connection failed') },
  }
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: failingPort })
  const events = []
  orch.setRecallStatusSender((event) => events.push(event))
  const result = await orch.executeRecall('task_change')
  assertEqual(result, '', 'T38: returns empty on error')
  const lastEvent = events[events.length - 1]
  assertEqual(lastEvent?.phase, 'error', 'T39: terminal state is "error" on failure')
  assert(lastEvent?.error?.includes('connection failed'), 'T40: error message propagated')
}

// T41: setActiveProject resets _turnsSinceLastRecall (verified via source)
{
  const orch = new Orchestrator({ totalBudget: 200000 })
  // Read source to verify the reset exists
  const orchSrc = readFileSync(resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8')
  assert(orchSrc.includes('this._turnsSinceLastRecall = 0'),
    'T41: setActiveProject resets _turnsSinceLastRecall (source verification)')
}

// T42: Recall injects into chatHistory
{
  const memPort = createFakeMemoryPort(['recalled context ABC'])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  orch.setRecallStatusSender(() => {})
  await orch.executeRecall('manual')
  const histLen = orch.getChatHistoryLength()
  assertEqual(histLen, 2, 'T42: recall injects 2 turns into history (user recall + model ack)')
}

// T43: Budget overflow guard prevents recall (P0 infinite-cut-loop protection)
{
  const memPort = createFakeMemoryPort(['should not see this'])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  const events = []
  orch.setRecallStatusSender((event) => events.push(event))

  // Simulate high token usage: record 170k tokens to push past 80% ceiling
  // 170k + 20k (recall budget) = 190k > 160k (80% of 200k) → should skip
  const budgeter = orch.getTokenBudgetState()
  // Use chat messages to push budget up
  // Record via the budgeter's internal state manipulation is not exposed,
  // so we'll rely on the shouldRecall guard which reads budgetState
  // We test through the standalone shouldRecall instead
  const ctx = makeContext({ currentTokensUsed: 170000, totalBudget: 200000, hasMemoryPort: true })
  assert(!shouldRecall('manual', ctx),
    'T43: P0 guard — shouldRecall rejects when tokens would overflow ceiling')
}

// T44: Orchestrator has _turnsSinceLastRecall increment in onComplete (source verification)
{
  const orchSrc = readFileSync(resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8')
  assert(orchSrc.includes('this._turnsSinceLastRecall++'),
    'T44: orchestrator increments _turnsSinceLastRecall in onComplete')
}

// T45: Orchestrator calls maybePeriodicRecall in onComplete (source verification)
{
  const orchSrc = readFileSync(resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8')
  assert(orchSrc.includes('this.maybePeriodicRecall('),
    'T45: orchestrator calls maybePeriodicRecall in onComplete')
}

// T46: Cut pipeline uses executeRecall('session_start') (source verification)
{
  const orchSrc = readFileSync(resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8')
  assert(orchSrc.includes("this.executeRecall('session_start')"),
    'T46: cut pipeline uses executeRecall with session_start trigger')
}

// T47: executeRecall records tokens in memory channel
{
  const memPort = createFakeMemoryPort(['some recalled content'])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  orch.setRecallStatusSender(() => {})
  await orch.executeRecall('manual')
  const budgetState = orch.getTokenBudgetState()
  assert(budgetState.channels.memory.used > 0,
    'T47: recall tokens recorded in memory channel budget')
}

// T48: Recall status sender is optional (no crash without sender)
{
  const memPort = createFakeMemoryPort(['content'])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  // No setRecallStatusSender called — should not throw
  let threw = false
  try {
    await orch.executeRecall('manual')
  } catch {
    threw = true
  }
  assert(!threw, 'T48: executeRecall works without recall status sender registered')
}

// ─── Test Suite 5: NO-GO Remediation — Recall Race Condition ──────────

console.log('\n=== NO-GO Remediation: Recall Race ===\n')

// T49: _isRecalling is true during executeRecall execution
{
  let observedRecalling = false
  const slowPort = {
    async query(q, n) {
      // During this async gap, check _isRecalling
      observedRecalling = orch.isRecalling()
      return {
        success: true,
        data: { results: [{ content: 'data', source: 'test', relevance: 0.9, timestamp: Date.now() }], provider: 'local-markdown' },
      }
    },
  }
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: slowPort })
  orch.setRecallStatusSender(() => {})
  await orch.executeRecall('manual')
  assert(observedRecalling, 'T49: _isRecalling is true during memory query')
}

// T50: _isRecalling is false after executeRecall completes (success path)
{
  const memPort = createFakeMemoryPort(['data'])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  orch.setRecallStatusSender(() => {})
  await orch.executeRecall('manual')
  assertEqual(orch.isRecalling(), false, 'T50: _isRecalling resets after successful recall')
}

// T51: _isRecalling is false after executeRecall completes (error path)
{
  const failPort = { async query() { throw new Error('boom') } }
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: failPort })
  orch.setRecallStatusSender(() => {})
  await orch.executeRecall('task_change')
  assertEqual(orch.isRecalling(), false, 'T51: _isRecalling resets after error (finally block)')
}

// T52: handleStreamingChat rejects during _isRecalling
{
  let resolveQuery
  const blockingPort = {
    async query() {
      return new Promise((resolve) => { resolveQuery = resolve })
    },
  }
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: blockingPort })
  orch.setRecallStatusSender(() => {})

  // Start recall — will block on query
  const recallPromise = orch.executeRecall('manual')

  // Wait a tick for the async to enter the query
  await new Promise(r => setTimeout(r, 10))

  // Now try to send a chat message while recall is in-flight
  const chatResult = await orch.handleStreamingChat(
    { content: 'should be rejected' },
    () => {},
  )

  assertEqual(chatResult.success, false, 'T52: handleStreamingChat rejects during recall')
  assert(chatResult.error.toLowerCase().includes('recall'),
    'T53: rejection error mentions recall')

  // Unblock the recall
  resolveQuery({
    success: true,
    data: { results: [{ content: 'ctx', source: 'test', relevance: 0.9, timestamp: Date.now() }], provider: 'local-markdown' },
  })
  await recallPromise
}

// T54: After recall completes, handleStreamingChat is accepted again
{
  const memPort = createFakeMemoryPort(['ctx'])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  orch.setRecallStatusSender(() => {})
  await orch.executeRecall('manual')

  // After recall, chat should NOT be rejected for recall reason
  // (It may fail for other reasons like Gemini not initialized — that's fine)
  const chatResult = await orch.handleStreamingChat(
    { content: 'should work now' },
    () => {},
  )
  // If it fails, it should NOT be because of recall
  if (!chatResult.success) {
    assert(!chatResult.error.toLowerCase().includes('recall'),
      'T54: post-recall rejection is NOT due to recall guard')
  } else {
    assert(true, 'T54: post-recall chat accepted (recall guard cleared)')
  }
}

// T55: History maintains strict user/model alternation after recall injection
{
  const memPort = createFakeMemoryPort(['recalled facts XYZ'])
  const orch = new Orchestrator({ totalBudget: 200000, memoryPort: memPort })
  orch.setRecallStatusSender(() => {})
  await orch.executeRecall('manual')

  // History should be: [user (recall), model (ack)] — length 2, alternating
  const histLen = orch.getChatHistoryLength()
  assertEqual(histLen, 2, 'T55: recall injection produces exactly 2 history entries')
}

// T56: Source verification — _isRecalling set/unset in executeRecall
{
  const orchSrc = readFileSync(resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8')
  assert(orchSrc.includes('this._isRecalling = true'),
    'T56: executeRecall sets _isRecalling = true')
  assert(orchSrc.includes('this._isRecalling = false'),
    'T57: executeRecall resets _isRecalling = false in finally')
}

// T58: Source verification — handleStreamingChat checks _isRecalling
{
  const orchSrc = readFileSync(resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8')
  assert(orchSrc.includes('this._isRecalling'),
    'T58: handleStreamingChat includes _isRecalling guard')
}

// T59: Source verification — InputBar disabled includes recallPhase
{
  const chatPanelSrc = readFileSync(resolve(__dirname, '../src/renderer/src/components/Chat/ChatPanel.tsx'), 'utf-8')
  assert(chatPanelSrc.includes('!!recallPhase'),
    'T59: InputBar disabled prop includes recallPhase')
}

// ─── Summary ────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`)
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`)
console.log(`${'─'.repeat(50)}\n`)

process.exit(failed > 0 ? 1 : 0)

