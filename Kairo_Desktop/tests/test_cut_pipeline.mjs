/**
 * test_cut_pipeline.mjs — Phase 4 Sprint D: Cut Pipeline Tests
 *
 * Tests the 12-step cut pipeline orchestrator behavior including:
 * - _isCutting concurrency guard (Codex guard #1)
 * - Idempotent requestArchive (Codex guard #2)
 * - Bridge buffer extraction
 * - Pipeline state emission (Codex guard #5)
 * - Chat rejection during cut
 * - Memory recall fallback
 *
 * Run: node tests/test_cut_pipeline.mjs
 * Expected: All assertions PASS, exit 0
 */

import { buildSync } from 'esbuild'
import { readFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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

// ─── Build orchestrator with shims ──────────────────────────────────

const buildDir = resolve(__dirname, '../.test-build')
mkdirSync(buildDir, { recursive: true })

const shimServicesDir = join(buildDir, 'shim-services')
mkdirSync(shimServicesDir, { recursive: true })

// Gateway shim
writeFileSync(join(shimServicesDir, 'gemini-gateway.ts'), `
let initialized = true
export function initGeminiGateway(apiKey: string): void { initialized = true }
export function resetGeminiGateway(): void { initialized = false }
export function isInitialized(): boolean { return initialized }
export async function generateContent(prompt: string, modelId: string) {
  return { text: 'mock-summary', tokenCount: { prompt: 10, completion: 20, total: 30 } }
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

// Snapshot service shim — avoids fs writes during tests
writeFileSync(join(shimServicesDir, 'snapshot.service.ts'), `
export interface SnapshotResult {
  transcriptPath: string
  summaryPath: string
  summaryText: string
}
export async function createSnapshot(
  projectFolderPath: string,
  sessionNumber: number,
  history: any[],
): Promise<SnapshotResult> {
  return {
    transcriptPath: projectFolderPath + '/.kairo/sessions/session_001_transcript.md',
    summaryPath: projectFolderPath + '/.kairo/sessions/session_001_summary.md',
    summaryText: 'Mock summary of session',
  }
}
`)

// System prompt shim
const shimConfigDir = join(buildDir, 'shim-config')
mkdirSync(shimConfigDir, { recursive: true })
writeFileSync(join(shimConfigDir, 'system-prompt.ts'), `
export function buildSystemPrompt(projectName: string, recallContext: string, bridgeSummary: string): string { return 'mock' }
`)

// Model router shim
writeFileSync(join(shimServicesDir, 'model-router.ts'), `
export function routeModel(context: string, userOverride?: string): string { return userOverride || 'gemini-2.0-flash' }
`)

// Source-patching approach (esbuild alias doesn't support relative paths)
const shimCoreDir = join(buildDir, 'shim-core')
mkdirSync(shimCoreDir, { recursive: true })

const orchestratorOrigSource = readFileSync(
  resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf-8'
)
const srcMain = resolve(__dirname, '../src/main').replace(/\\/g, '/')
const shimSvcDir = shimServicesDir.replace(/\\/g, '/')
const shimCfgDir = shimConfigDir.replace(/\\/g, '/')
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
writeFileSync(join(shimCoreDir, 'orchestrator.ts'), patchedSource)

buildSync({
  entryPoints: [join(shimCoreDir, 'orchestrator.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(buildDir, 'orchestrator.pipeline.mjs'),
  external: ['better-sqlite3', 'node:crypto', 'node:fs/promises', '@google/generative-ai'],
  logLevel: 'silent',
})

const { Orchestrator } = await import(pathToFileURL(join(buildDir, 'orchestrator.pipeline.mjs')).href)

// ─── Fake Ports ────────────────────────────────────────────────────

function createFakePersistence() {
  const sessions = new Map()
  let sessionCounter = 0

  return {
    archiveCalls: [],
    createCalls: [],
    updatePathsCalls: [],

    createSession(projectId) {
      sessionCounter++
      const session = {
        id: `sess-${sessionCounter}`,
        projectId,
        sessionNumber: sessionCounter,
        totalTokens: 0,
        interactionCount: 0,
        cutReason: null,
        status: 'active',
        startedAt: new Date().toISOString(),
        endedAt: null,
      }
      sessions.set(session.id, session)
      this.createCalls.push(projectId)
      return { success: true, data: { session } }
    },

    getActiveSession(projectId) {
      for (const s of sessions.values()) {
        if (s.projectId === projectId && s.status === 'active') {
          return { success: true, data: { session: s } }
        }
      }
      return { success: true, data: { session: null } }
    },

    addTokens(sessionId, tokensToAdd) {
      const s = sessions.get(sessionId)
      if (s) {
        s.totalTokens += tokensToAdd
        s.interactionCount++
        return { success: true, data: { session: s } }
      }
      return { success: false, error: 'Session not found' }
    },

    archiveSession(sessionId, cutReason) {
      const s = sessions.get(sessionId)
      if (s) {
        s.status = 'archived'
        s.cutReason = cutReason
        s.endedAt = new Date().toISOString()
        this.archiveCalls.push({ sessionId, cutReason })
        return { success: true, data: { session: s } }
      }
      return { success: false, error: 'Session not found' }
    },

    updatePaths(sessionId, transcriptPath, summaryPath) {
      this.updatePathsCalls.push({ sessionId, transcriptPath, summaryPath })
    },
  }
}

function createFakeMemoryPort() {
  return {
    queryCalls: [],
    async query(query, maxResults) {
      this.queryCalls.push({ query, maxResults })
      return {
        success: true,
        data: {
          results: [{ content: 'recalled context', source: 'test', relevance: 1, timestamp: Date.now() }],
          provider: 'local-markdown',
        },
      }
    },
  }
}

function createFakeUploadQueue() {
  return {
    entries: [],
    enqueue(sessionId, filePath, fileType) {
      this.entries.push({ sessionId, filePath, fileType })
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\n=== Phase 4 Sprint D: Cut Pipeline Tests ===\n')

// ── T01: _isCutting guard rejects chat during cut ────────────────

console.log('\n--- T01: Chat rejection during cut ---')
{
  const orch = new Orchestrator()
  // Force _isCutting via reflection
  orch['_isCutting'] = true
  const result = await orch.handleStreamingChat(
    { content: 'hello' },
    () => {},
  )
  assertEqual(result.success, false, 'T01a: Chat rejected when cutting')
  assert(result.error.includes('Session cut in progress'), 'T01b: Error message mentions cut in progress')
  orch['_isCutting'] = false
}

// ── T02: Idempotent requestArchive (Codex guard #2) ─────────────

console.log('\n--- T02: Idempotent requestArchive ---')
{
  const persistence = createFakePersistence()
  const orch = new Orchestrator({ sessionPersistence: persistence })
  orch.setActiveProject('proj1', '/tmp/proj', 'Test')

  // Manually create a session
  const createResult = persistence.createSession('proj1')
  orch['activeDbSessionId'] = createResult.data.session.id
  orch['activeSessionNumber'] = 1

  // First archive call should work
  const p1 = orch.requestArchive('manual')
  // Second call while first is in progress should be rejected (idempotent)
  assertEqual(orch.isCutting(), true, 'T02a: _isCutting is true during pipeline')
  const p2 = orch.requestArchive('manual')
  await p1
  await p2

  // Only one archive should have been called
  assertEqual(persistence.archiveCalls.length, 1, 'T02b: Only one archive call made (idempotent)')
}

// ── T03: Pipeline emits state phases ────────────────────────────

console.log('\n--- T03: Pipeline state emissions ---')
{
  const persistence = createFakePersistence()
  const emittedPhases = []
  const orch = new Orchestrator({
    sessionPersistence: persistence,
    projectFolderPath: '/tmp/proj',
    projectName: 'Test',
  })
  orch.setCutStateSender((event) => emittedPhases.push(event.phase))
  orch.setActiveProject('proj2', '/tmp/proj', 'Test')

  // Create session
  const cr = persistence.createSession('proj2')
  orch['activeDbSessionId'] = cr.data.session.id
  orch['activeSessionNumber'] = 1

  await orch.requestArchive('manual')

  assert(emittedPhases.includes('blocking'), 'T03a: Emitted blocking phase')
  assert(emittedPhases.includes('counting'), 'T03b: Emitted counting phase')
  assert(emittedPhases.includes('generating'), 'T03c: Emitted generating phase')
  assert(emittedPhases.includes('saving'), 'T03d: Emitted saving phase')
  assert(emittedPhases.includes('uploading'), 'T03e: Emitted uploading phase')
  assert(emittedPhases.includes('recalling'), 'T03f: Emitted recalling phase')
  assert(emittedPhases.includes('ready'), 'T03g: Emitted ready (terminal) phase')
  assertEqual(orch.isCutting(), false, 'T03h: _isCutting is false after pipeline')
}

// ── T04: Bridge buffer extraction ───────────────────────────────

console.log('\n--- T04: Bridge buffer extraction ---')
{
  const persistence = createFakePersistence()
  const orch = new Orchestrator({ sessionPersistence: persistence })
  orch.setActiveProject('proj3', '/tmp/proj', 'Test')

  const cr = persistence.createSession('proj3')
  orch['activeDbSessionId'] = cr.data.session.id
  orch['activeSessionNumber'] = 1

  // Inject chat history
  orch['chatHistory'] = [
    { role: 'user', parts: [{ text: 'Hello Kairo' }] },
    { role: 'model', parts: [{ text: 'Hi! How can I help?' }] },
    { role: 'user', parts: [{ text: 'What is the weather?' }] },
    { role: 'model', parts: [{ text: 'I cannot check weather directly.' }] },
  ]

  await orch.requestArchive('manual')

  const bridge = orch.getBridgeBuffer()
  assert(bridge !== null, 'T04a: Bridge buffer created')
  assert(bridge.messages.length > 0, 'T04b: Bridge has messages')
  assertEqual(bridge.sourceSessionNumber, 1, 'T04c: Bridge source session number')
  assert(bridge.lastUserTurn.length > 0, 'T04d: Bridge has lastUserTurn')
  assert(bridge.tokenEstimate > 0, 'T04e: Bridge has token estimate')
}

// ── T05: Upload queue integration ───────────────────────────────

console.log('\n--- T05: Upload queue enqueue ---')
{
  const persistence = createFakePersistence()
  const uploadQueue = createFakeUploadQueue()
  const orch = new Orchestrator({
    sessionPersistence: persistence,
    projectFolderPath: '/tmp/proj',
  })
  orch.setUploadQueuePort(uploadQueue)
  orch.setActiveProject('proj4', '/tmp/proj', 'Test')

  const cr = persistence.createSession('proj4')
  orch['activeDbSessionId'] = cr.data.session.id
  orch['activeSessionNumber'] = 1
  orch['chatHistory'] = [{ role: 'user', parts: [{ text: 'test' }] }]

  await orch.requestArchive('manual')

  assertEqual(uploadQueue.entries.length, 2, 'T05a: Two entries enqueued (transcript + summary)')
  assertEqual(uploadQueue.entries[0].fileType, 'transcript', 'T05b: First entry is transcript')
  assertEqual(uploadQueue.entries[1].fileType, 'summary', 'T05c: Second entry is summary')
}

// ── T06: Memory port recall ─────────────────────────────────────

console.log('\n--- T06: Memory port recall ---')
{
  const persistence = createFakePersistence()
  const memoryPort = createFakeMemoryPort()
  const orch = new Orchestrator({
    sessionPersistence: persistence,
    projectFolderPath: '/tmp/proj',
  })
  orch.setMemoryPort(memoryPort)
  orch.setActiveProject('proj5', '/tmp/proj', 'Test')

  const cr = persistence.createSession('proj5')
  orch['activeDbSessionId'] = cr.data.session.id
  orch['activeSessionNumber'] = 1
  orch['chatHistory'] = [{ role: 'user', parts: [{ text: 'test' }] }]

  await orch.requestArchive('tokens')

  assert(memoryPort.queryCalls.length > 0, 'T06a: Memory port query was called')
  assertEqual(persistence.archiveCalls[0].cutReason, 'tokens', 'T06b: Archive reason is tokens')
}

// ── T07: Session paths updated ──────────────────────────────────

console.log('\n--- T07: Session paths updated ---')
{
  const persistence = createFakePersistence()
  const orch = new Orchestrator({
    sessionPersistence: persistence,
    projectFolderPath: '/tmp/proj',
  })
  orch.setActiveProject('proj6', '/tmp/proj', 'Test')

  const cr = persistence.createSession('proj6')
  orch['activeDbSessionId'] = cr.data.session.id
  orch['activeSessionNumber'] = 1
  orch['chatHistory'] = [{ role: 'user', parts: [{ text: 'test' }] }]

  await orch.requestArchive('manual')

  assertEqual(persistence.updatePathsCalls.length, 1, 'T07a: updatePaths called once')
  assert(persistence.updatePathsCalls[0].transcriptPath.includes('transcript'), 'T07b: Transcript path recorded')
  assert(persistence.updatePathsCalls[0].summaryPath.includes('summary'), 'T07c: Summary path recorded')
}

// ── T08: Pipeline error emits error state (guard #5) ────────────

console.log('\n--- T08: Pipeline error emits error state ---')
{
  const emittedPhases = []
  const orch = new Orchestrator()
  orch.setCutStateSender((event) => emittedPhases.push(event))

  // Force an error by setting invalid project folder with active session
  orch['activeProjectId'] = 'broken'
  orch['activeDbSessionId'] = 'bad-session'
  orch['activeSessionNumber'] = 99
  // Give it a persistence port that will throw
  orch['sessionPersistence'] = {
    archiveSession() { throw new Error('DB exploded') },
    createSession() { return { success: false } },
    getActiveSession() { return { success: false } },
    addTokens() { return { success: false } },
  }

  await orch.requestArchive('emergency')

  // Should still emit ready at the end (pipeline completes despite non-fatal errors)
  const lastPhase = emittedPhases[emittedPhases.length - 1]
  assert(lastPhase.phase === 'ready' || lastPhase.phase === 'error', 'T08a: Terminal state emitted after error')
  assertEqual(orch.isCutting(), false, 'T08b: _isCutting cleared after error')
}

// ── T09: setActiveProject clears bridge buffer ──────────────────

console.log('\n--- T09: setActiveProject clears state ---')
{
  const orch = new Orchestrator()
  orch['_bridgeBuffer'] = { messages: [], lastUserTurn: '', tokenEstimate: 0, sourceSessionNumber: 1 }
  orch.setActiveProject('new-proj', '/tmp/new', 'NewProj')
  assertEqual(orch.getBridgeBuffer(), null, 'T09a: Bridge buffer cleared on project switch')
  assertEqual(orch.getChatHistoryLength(), 0, 'T09b: Chat history cleared')
}

// ── T10: isCutting() accessor ───────────────────────────────────

console.log('\n--- T10: isCutting accessor ---')
{
  const orch = new Orchestrator()
  assertEqual(orch.isCutting(), false, 'T10a: isCutting false initially')
  orch['_isCutting'] = true
  assertEqual(orch.isCutting(), true, 'T10b: isCutting true after setting')
  orch['_isCutting'] = false
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
