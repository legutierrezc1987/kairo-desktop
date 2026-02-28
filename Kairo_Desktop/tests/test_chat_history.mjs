/**
 * test_chat_history.mjs — Phase 4 Sprint C: Chat History + Concurrency Tests
 *
 * Tests Orchestrator streaming behavior with instrumented fakes:
 * 1. Concurrency guard: single-flight rejection (T01-T04)
 * 2. History lifecycle: append user/model, rollback on error, clear on archive (T05-T15)
 * 3. Token accounting: authoritative at completion only (T16-T20)
 * 4. Lifecycle: abort on project switch, abort on archive, abort on shutdown (T21-T28)
 * 5. P1: terminal error chunk always sent (T29-T33)
 * 6. Cut trigger wiring after streaming completion (T34-T38)
 *
 * Strategy: esbuild compiles Orchestrator with shimmed gateway from a patched
 * copy placed in the source tree (so relative imports resolve), then exercises
 * the real class against a fake SessionPersistencePort.
 *
 * Run: node tests/test_chat_history.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
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

// ─── Cleanup helper ──────────────────────────────────────────────────

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

// ─── Build Orchestrator with shimmed gateway ─────────────────────────

// Place patched file in core/ so relative imports resolve correctly
const coreDir = resolve(__dirname, '../src/main/core')
const patchedPath = join(coreDir, '_orchestrator-test-patched.ts')
const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

const orchestratorPath = resolve(__dirname, '../src/main/core/orchestrator.ts')
let orchSrc = readFileSync(orchestratorPath, 'utf8')

// Replace gateway import with inline shim
const shimCode = `
// ─── SHIMMED GATEWAY (test) ──────────────────────────────────────
let _initialized = false;
let _streaming = false;
let _streamCallback: any = null;
let _aborted = false;

export function initShim() { _initialized = true; }
export function resetShim() { _initialized = false; _streaming = false; _aborted = false; _streamCallback = null; }
export function getShimState() { return { streaming: _streaming, aborted: _aborted }; }

function isInitialized() { return _initialized; }
function generateContent(prompt: string, modelId: any): Promise<any> {
  return Promise.resolve({
    text: 'mock-response',
    tokenCount: { prompt: 10, completion: 20, total: 30 }
  });
}
function countTokens(content: string, modelId: any): Promise<number> {
  return Promise.resolve(Math.ceil(content.length / 4));
}
function streamChatMessage(prompt: string, modelId: any, history: any[], callbacks: any): Promise<void> {
  _streaming = true;
  _aborted = false;
  return new Promise<void>((resolve) => {
    _streamCallback = { callbacks, resolve };
    setTimeout(() => {
      if (_streamCallback && !_aborted) {
        callbacks.onChunk('Hello ');
        callbacks.onChunk('world');
        callbacks.onComplete({
          text: 'Hello world',
          tokenCount: { prompt: 10, completion: 15, total: 25 }
        });
        _streaming = false;
        resolve();
        _streamCallback = null;
      }
    }, 5);
  });
}
function abortActiveStream(): boolean {
  _aborted = true;
  _streaming = false;
  if (_streamCallback) {
    _streamCallback.callbacks.onError(new Error('Generation aborted by user'));
    _streamCallback.resolve();
    _streamCallback = null;
  }
  return true;
}
// ── end shim ──
`

// Remove the gateway import and inject shim (use [^}]* to stay within braces, not cross imports)
orchSrc = orchSrc.replace(
  /import \{[^}]*\} from '\.\.\/services\/gemini-gateway'/,
  shimCode
)

// Remove @google/generative-ai type import — replace with inline type
orchSrc = orchSrc.replace(
  /import type \{ Content \} from '@google\/generative-ai'/,
  'type Content = { role: string; parts: { text: string }[] }'
)

// Remove StreamChunk import from shared types (inline it)
orchSrc = orchSrc.replace(
  /  StreamChunk,\n/,
  ''
)

// Add StreamChunk interface inline
orchSrc = orchSrc.replace(
  'export class Orchestrator',
  `interface GeminiResponse { text: string; tokenCount: { prompt: number; completion: number; total: number } }
interface StreamChunk { messageId: string; delta: string; done: boolean; tokenCount?: number; error?: string }

export class Orchestrator`
)

// Write patched source alongside the real file (same dir = same relative imports)
writeFileSync(patchedPath, orchSrc)

try {
  buildSync({
    entryPoints: [patchedPath],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: join(buildDir, 'orchestrator-patched.mjs'),
    external: ['better-sqlite3', 'electron', '@google/generative-ai', 'node:crypto', 'node:fs/promises'],
    logLevel: 'silent',
  })
} finally {
  // Always clean up the patched file from source tree
  try { rmSync(patchedPath) } catch { /* ignore */ }
}

const orchUrl = pathToFileURL(join(buildDir, 'orchestrator-patched.mjs')).href
const { Orchestrator, initShim, resetShim } = await import(orchUrl)

// ─── Fake SessionPersistencePort ─────────────────────────────────────

function createFakePersistence() {
  const calls = []
  let sessionCounter = 0
  let activeSession = null

  return {
    calls,
    createSession(projectId) {
      sessionCounter++
      activeSession = { id: `sess-${sessionCounter}`, projectId, status: 'active' }
      calls.push({ method: 'createSession', projectId })
      return { success: true, data: { session: activeSession } }
    },
    getActiveSession(projectId) {
      calls.push({ method: 'getActiveSession', projectId })
      if (activeSession && activeSession.projectId === projectId) {
        return { success: true, data: { session: activeSession } }
      }
      return { success: true, data: { session: null } }
    },
    addTokens(sessionId, tokensToAdd) {
      calls.push({ method: 'addTokens', sessionId, tokensToAdd })
      return { success: true, data: { session: { id: sessionId, totalTokens: tokensToAdd } } }
    },
    archiveSession(sessionId, cutReason) {
      calls.push({ method: 'archiveSession', sessionId, cutReason })
      activeSession = null
      return { success: true, data: { session: { id: sessionId, status: 'archived' } } }
    },
    reset() {
      calls.length = 0
      sessionCounter = 0
      activeSession = null
    },
  }
}

// ═════════════════════════════════════════════════════════════════════
// T01-T04: Concurrency guard (single-flight)
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T01-T04: Concurrency guard ──')

{
  initShim()
  const persistence = createFakePersistence()
  const orch = new Orchestrator({ sessionPersistence: persistence })
  orch.setActiveProject('proj-1')

  const chunks1 = []
  const p1 = orch.handleStreamingChat(
    { content: 'hello' },
    (chunk) => chunks1.push(chunk)
  )

  // Immediately try second send while first is streaming
  const chunks2 = []
  const result2 = await orch.handleStreamingChat(
    { content: 'world' },
    (chunk) => chunks2.push(chunk)
  )

  assertEqual(result2.success, false, 'T01: overlapping send rejected')
  assert(
    result2.error.includes('already in progress'),
    'T02: rejection message mentions already in progress'
  )
  assertEqual(chunks2.length, 0, 'T03: no chunks sent for rejected request')

  await p1
  assertEqual(chunks1.length > 0, true, 'T04: first request received chunks')

  resetShim()
}

// ═════════════════════════════════════════════════════════════════════
// T05-T15: History lifecycle
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T05-T15: History lifecycle ──')

{
  initShim()
  const persistence = createFakePersistence()
  const orch = new Orchestrator({ sessionPersistence: persistence })
  orch.setActiveProject('proj-2')

  assertEqual(orch.getChatHistoryLength(), 0, 'T05: history starts empty')

  const chunks = []
  await orch.handleStreamingChat(
    { content: 'first message' },
    (chunk) => chunks.push(chunk)
  )

  assertEqual(orch.getChatHistoryLength(), 2, 'T06: history has 2 entries after first turn (user+model)')

  // Second turn
  await orch.handleStreamingChat(
    { content: 'second message' },
    (chunk) => chunks.push(chunk)
  )

  assertEqual(orch.getChatHistoryLength(), 4, 'T07: history has 4 entries after second turn')

  // Verify chunks include terminal done:true
  const doneChunks = chunks.filter(c => c.done === true)
  assert(doneChunks.length >= 2, 'T08: at least 2 terminal (done:true) chunks for 2 turns')

  // Verify token counts on terminal chunks
  const terminalWithTokens = doneChunks.filter(c => c.tokenCount !== undefined)
  assert(terminalWithTokens.length >= 2, 'T09: terminal chunks carry tokenCount')

  // Delta chunks have text
  const deltaChunks = chunks.filter(c => c.done === false && c.delta)
  assert(deltaChunks.length >= 2, 'T10: delta chunks carry text')

  // Archive clears history (requestArchive is async in Sprint D)
  await orch.requestArchive('manual')
  assertEqual(orch.getChatHistoryLength(), 0, 'T11: history cleared on archive')

  // Project switch clears history
  initShim()
  orch.setActiveProject('proj-3')
  await orch.handleStreamingChat(
    { content: 'msg in proj-3' },
    () => {}
  )
  assert(orch.getChatHistoryLength() > 0, 'T12: history populated in new project')

  orch.setActiveProject('proj-4')
  assertEqual(orch.getChatHistoryLength(), 0, 'T13: history cleared on project switch')

  // isStreaming false after completion
  assertEqual(orch.isStreaming(), false, 'T14: isStreaming false after completion')

  // History NOT in SendMessageRequest (verify type — content only, no history field)
  const typesSrc = readFileSync(
    resolve(__dirname, '../src/shared/types.ts'), 'utf8'
  )
  const sendMsgMatch = typesSrc.match(/export interface SendMessageRequest \{[\s\S]*?\}/)
  assert(
    sendMsgMatch && !sendMsgMatch[0].includes('history'),
    'T15: SendMessageRequest has NO history field (history lives only in main)'
  )

  resetShim()
}

// ═════════════════════════════════════════════════════════════════════
// T16-T20: Token accounting
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T16-T20: Token accounting ──')

{
  initShim()
  const persistence = createFakePersistence()
  const orch = new Orchestrator({ sessionPersistence: persistence })
  orch.setActiveProject('proj-tok')

  const chunks = []
  await orch.handleStreamingChat(
    { content: 'test tokens' },
    (chunk) => chunks.push(chunk)
  )

  // Token accounting via budgeter
  const budget = orch.getTokenBudgetState()
  assert(budget.totalUsed > 0, 'T16: budget records tokens after streaming')

  // Session manager turn count
  const session = orch.getSessionState()
  assertEqual(session.turnCount, 1, 'T17: session turn incremented by 1')

  // Persistence call: addTokens was invoked
  const addTokenCalls = persistence.calls.filter(c => c.method === 'addTokens')
  assert(addTokenCalls.length >= 1, 'T18: addTokens called on persistence')

  // Terminal chunk has tokenCount
  const doneChunk = chunks.find(c => c.done && !c.error)
  assert(doneChunk && doneChunk.tokenCount > 0, 'T19: terminal chunk has tokenCount > 0')

  // No pre-stream token accounting (only at completion)
  const orchSrc = readFileSync(
    resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf8'
  )
  const streamingMethod = orchSrc.substring(
    orchSrc.indexOf('async handleStreamingChat('),
    orchSrc.indexOf('// ─── Legacy one-shot')
  )
  // budgeter.record should only appear inside onComplete callback
  const recordCalls = streamingMethod.match(/this\.budgeter\.record\(/g) || []
  assertEqual(recordCalls.length, 1, 'T20: budgeter.record called exactly once in streaming path (at completion)')

  resetShim()
}

// ═════════════════════════════════════════════════════════════════════
// T21-T28: Lifecycle — abort on various triggers
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T21-T28: Lifecycle abort ──')

{
  // T21-T22: abortStream when idle is safe
  initShim()
  const orch1 = new Orchestrator()
  orch1.abortStream() // should not throw
  assert(true, 'T21: abortStream when idle does not throw')
  assertEqual(orch1.isStreaming(), false, 'T22: isStreaming still false after idle abort')

  // T23-T28: source verification
  const orchSrc = readFileSync(
    resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf8'
  )

  assert(
    orchSrc.includes('shutdown(): void') && orchSrc.includes('this.abortStream()'),
    'T23: shutdown() method calls abortStream()'
  )

  assert(
    orchSrc.includes('requestArchive(reason: CutReason)') &&
    orchSrc.includes('this.abortStream()'),
    'T24: requestArchive calls abortStream before archiving'
  )

  const setProjectMethod = orchSrc.substring(
    orchSrc.indexOf('setActiveProject(projectId:'),
    orchSrc.indexOf('getActiveProjectId()')
  )
  assert(
    setProjectMethod.includes('this.abortStream()'),
    'T25: setActiveProject calls abortStream()'
  )
  assert(
    setProjectMethod.includes("this.chatHistory = []"),
    'T26: setActiveProject clears chatHistory'
  )

  // Sprint D renamed to archiveCurrentSessionSync (sync variant for project switch)
  const archiveMethod = orchSrc.substring(
    orchSrc.indexOf('private archiveCurrentSessionSync('),
    orchSrc.indexOf('private archiveCurrentSessionSync(') + 700
  )
  assert(
    archiveMethod.includes('this.chatHistory = []'),
    'T27: archiveCurrentSession clears chatHistory'
  )
  assert(
    archiveMethod.includes('this.budgeter.reset()') &&
    archiveMethod.includes('this.sessionManager.startSession()'),
    'T28: archiveCurrentSession resets budgeter and starts new session'
  )

  resetShim()
}

// ═════════════════════════════════════════════════════════════════════
// T29-T33: P1 — terminal error chunk always sent
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T29-T33: P1 terminal error chunk ──')

{
  const orchSrc = readFileSync(
    resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf8'
  )

  assert(
    orchSrc.includes("done: true,\n              error: error.message"),
    'T29: onError sends terminal chunk with error field'
  )

  const defStart = orchSrc.indexOf('// Defensive: should not reach here')
  // Find the } finally { that comes AFTER the defensive catch (not the cut pipeline one)
  const defEnd = orchSrc.indexOf('} finally {', defStart)
  const defensiveCatch = orchSrc.substring(defStart, defEnd)
  assert(
    defensiveCatch.includes("done: true, error: msg"),
    'T30: defensive catch sends terminal error chunk'
  )

  assert(
    orchSrc.includes('} finally {\n      this._isStreaming = false'),
    'T31: finally block always clears _isStreaming'
  )

  const handlerSrc = readFileSync(
    resolve(__dirname, '../src/main/ipc/chat.handlers.ts'), 'utf8'
  )
  assert(
    handlerSrc.includes("// webContents may have been destroyed"),
    'T32: sendChunk wrapped in try-catch for destroyed webContents'
  )

  assert(
    orchSrc.includes("this.chatHistory.pop()"),
    'T33: onError pops user turn from history (rollback)'
  )
}

// ═════════════════════════════════════════════════════════════════════
// T34-T38: Cut trigger wiring
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T34-T38: Cut trigger wiring ──')

{
  const orchSrc = readFileSync(
    resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf8'
  )

  assert(
    orchSrc.includes('this.persistTokens(totalTokens)'),
    'T34: onComplete calls persistTokens'
  )
  assert(
    orchSrc.includes('private persistTokens('),
    'T35: persistTokens is private method'
  )
  assert(
    orchSrc.includes('this.checkSessionLimits()'),
    'T36: persistTokens calls checkSessionLimits'
  )
  assert(
    orchSrc.includes('MAX_TURNS_PER_SESSION'),
    'T37: checkSessionLimits checks turn limit'
  )
  assert(
    orchSrc.includes('SESSION_CUT_THRESHOLD_PERCENT'),
    'T38: checkSessionLimits checks token threshold'
  )
}

// ═════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`Chat History tests: ${passed} passed, ${failed} failed (${passed + failed} total)`)
console.log(`${'═'.repeat(60)}`)

process.exit(failed > 0 ? 1 : 0)
