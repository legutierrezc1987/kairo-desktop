/**
 * test_streaming_gateway.mjs — Phase 4 Sprint C: Streaming Gateway Tests
 *
 * Validates gemini-gateway.ts streaming infrastructure:
 * 1. Source structure verification (T01-T05)
 * 2. StreamChunk type + IPC channel (T06-T09)
 * 3. ChatAbortResponse type (T10-T11)
 * 4. Chat handlers streaming dispatch (T12-T18)
 * 5. Orchestrator streaming API surface (T19-T25)
 * 6. Gateway abort/lifecycle (T26-T30)
 * 7. Preload allowlist includes new channel (T31-T33)
 * 8. index.ts wiring (T34-T38)
 *
 * Run: node tests/test_streaming_gateway.mjs
 * Expected: All assertions PASS, exit 0
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// ─── Read source files ───────────────────────────────────────────────

const gatewaySrc = readFileSync(
  resolve(__dirname, '../src/main/services/gemini-gateway.ts'), 'utf8'
)
const typesSrc = readFileSync(
  resolve(__dirname, '../src/shared/types.ts'), 'utf8'
)
const channelsSrc = readFileSync(
  resolve(__dirname, '../src/shared/ipc-channels.ts'), 'utf8'
)
const chatHandlersSrc = readFileSync(
  resolve(__dirname, '../src/main/ipc/chat.handlers.ts'), 'utf8'
)
const orchestratorSrc = readFileSync(
  resolve(__dirname, '../src/main/core/orchestrator.ts'), 'utf8'
)
const preloadSrc = readFileSync(
  resolve(__dirname, '../src/preload/index.ts'), 'utf8'
)
const indexSrc = readFileSync(
  resolve(__dirname, '../src/main/index.ts'), 'utf8'
)

// ═════════════════════════════════════════════════════════════════════
// T01-T05: Gateway source structure
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T01-T05: Gateway source structure ──')

assert(
  gatewaySrc.includes('export async function streamChatMessage('),
  'T01: gateway exports streamChatMessage'
)
assert(
  gatewaySrc.includes('export function abortActiveStream('),
  'T02: gateway exports abortActiveStream'
)
assert(
  gatewaySrc.includes('export function isStreaming('),
  'T03: gateway exports isStreaming'
)
assert(
  gatewaySrc.includes('model.startChat({ history })'),
  'T04: streamChatMessage uses startChat with history'
)
assert(
  gatewaySrc.includes('chat.sendMessageStream(prompt, {'),
  'T05: streamChatMessage calls sendMessageStream'
)

// ═════════════════════════════════════════════════════════════════════
// T06-T09: StreamChunk type definition
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T06-T09: StreamChunk type ──')

assert(
  typesSrc.includes('export interface StreamChunk'),
  'T06: StreamChunk interface exported'
)
assert(
  typesSrc.includes('messageId: string') && typesSrc.includes('delta: string'),
  'T07: StreamChunk has messageId and delta fields'
)
assert(
  typesSrc.includes('done: boolean'),
  'T08: StreamChunk has done boolean (terminal marker)'
)
assert(
  /error\?: string/.test(typesSrc),
  'T09: StreamChunk has optional error field (P1 fix)'
)

// ═════════════════════════════════════════════════════════════════════
// T10-T11: ChatAbortResponse type
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T10-T11: ChatAbortResponse type ──')

assert(
  typesSrc.includes('export interface ChatAbortResponse'),
  'T10: ChatAbortResponse interface exported'
)
assert(
  typesSrc.includes('aborted: boolean'),
  'T11: ChatAbortResponse has aborted boolean'
)

// ═════════════════════════════════════════════════════════════════════
// T12-T18: Chat handlers streaming dispatch
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T12-T18: Chat handlers streaming dispatch ──')

assert(
  chatHandlersSrc.includes('getMainWindow: () => BrowserWindow | null'),
  'T12: registerChatHandlers accepts getMainWindow param'
)
assert(
  chatHandlersSrc.includes('event.sender.send(IPC_CHANNELS.CHAT_STREAM_CHUNK'),
  'T13: streaming chunks sent via event.sender.send'
)
assert(
  chatHandlersSrc.includes('orchestrator.handleStreamingChat(data, sendChunk)'),
  'T14: CHAT_SEND_MESSAGE delegates to handleStreamingChat'
)
assert(
  chatHandlersSrc.includes("ipcMain.handle(IPC_CHANNELS.CHAT_ABORT"),
  'T15: CHAT_ABORT handler registered'
)
assert(
  chatHandlersSrc.includes('orchestrator.isStreaming()'),
  'T16: CHAT_ABORT checks orchestrator.isStreaming()'
)
assert(
  chatHandlersSrc.includes('orchestrator.abortStream()'),
  'T17: CHAT_ABORT calls orchestrator.abortStream()'
)
assert(
  chatHandlersSrc.includes("reason: 'No active generation'"),
  'T18: CHAT_ABORT returns reason when no active stream (idempotent)'
)

// ═════════════════════════════════════════════════════════════════════
// T19-T25: Orchestrator streaming API
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T19-T25: Orchestrator streaming API ──')

assert(
  orchestratorSrc.includes('private chatHistory: Content[] = []'),
  'T19: orchestrator has chatHistory (Content[]) — lives in main only'
)
assert(
  orchestratorSrc.includes("private _isStreaming = false"),
  'T20: orchestrator has _isStreaming single-flight guard'
)
assert(
  orchestratorSrc.includes('async handleStreamingChat('),
  'T21: orchestrator exports handleStreamingChat method'
)
assert(
  orchestratorSrc.includes("error: 'A generation is already in progress"),
  'T22: handleStreamingChat rejects overlapping sends'
)
assert(
  orchestratorSrc.includes("this.chatHistory.push({\n      role: 'user'"),
  'T23: handleStreamingChat appends user turn to history'
)
assert(
  orchestratorSrc.includes("role: 'model'") && orchestratorSrc.includes('this.chatHistory.push('),
  'T24: onComplete appends model turn to history'
)
assert(
  orchestratorSrc.includes('this.chatHistory.pop()'),
  'T25: onError rolls back user turn from history'
)

// ═════════════════════════════════════════════════════════════════════
// T26-T30: Gateway abort and lifecycle
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T26-T30: Gateway abort and lifecycle ──')

assert(
  gatewaySrc.includes('let activeAbortController: AbortController | null = null'),
  'T26: gateway manages activeAbortController'
)
assert(
  gatewaySrc.includes('signal: controller.signal'),
  'T27: AbortSignal passed to sendMessageStream'
)
assert(
  gatewaySrc.includes('activeAbortController.abort()'),
  'T28: abortActiveStream calls abort() on controller'
)
assert(
  gatewaySrc.includes('export function resetGeminiGateway(): void {') &&
  gatewaySrc.includes('abortActiveStream()') &&
  gatewaySrc.indexOf('abortActiveStream()') <
    gatewaySrc.indexOf('models.clear()'),
  'T29: resetGeminiGateway aborts stream before clearing models'
)
assert(
  gatewaySrc.includes("callbacks.onError(new Error('Generation aborted by user'))"),
  'T30: aborted stream triggers onError with descriptive message'
)

// ═════════════════════════════════════════════════════════════════════
// T31-T33: Preload + IPC channel
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T31-T33: Preload + IPC channel ──')

assert(
  channelsSrc.includes("CHAT_STREAM_CHUNK: 'chat:stream-chunk'"),
  'T31: CHAT_STREAM_CHUNK channel declared in IPC_CHANNELS'
)
assert(
  preloadSrc.includes('isAllowedChannel'),
  'T32: preload uses isAllowedChannel for validation'
)
assert(
  preloadSrc.includes('ipcRenderer.on(channel, listener)'),
  'T33: preload on() method registers ipcRenderer listener (supports push events)'
)

// ═════════════════════════════════════════════════════════════════════
// T34-T38: index.ts wiring
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T34-T38: index.ts wiring ──')

assert(
  indexSrc.includes('registerChatHandlers(orchestrator, () => mainWindow)'),
  'T34: registerChatHandlers receives mainWindow getter'
)
assert(
  indexSrc.includes('orchestrator.shutdown()'),
  'T35: before-quit calls orchestrator.shutdown()'
)
assert(
  indexSrc.includes('orchestrator.requestArchive') &&
  indexSrc.includes("'emergency'"),
  'T36: kill switch calls orchestrator.requestArchive(emergency)'
)
assert(
  orchestratorSrc.includes('shutdown(): void {') &&
  orchestratorSrc.includes('this.abortStream()'),
  'T37: orchestrator.shutdown() calls abortStream()'
)
assert(
  orchestratorSrc.includes('requestArchive(reason: CutReason)') &&
  orchestratorSrc.includes('this.abortStream()'),
  'T38: requestArchive aborts stream before archiving'
)

// ═════════════════════════════════════════════════════════════════════
// T39-T40: Gateway safety patterns
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T39-T40: Gateway safety patterns ──')

assert(
  gatewaySrc.includes('} finally {') &&
  gatewaySrc.includes('activeAbortController = null'),
  'T39: gateway finally block nullifies controller (prevents stale reference leak)'
)
assert(
  gatewaySrc.includes('if (activeAbortController === controller)'),
  'T40: gateway checks identity before nullifying (prevents cross-stream race)'
)

// ═════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`Streaming Gateway tests: ${passed} passed, ${failed} failed (${passed + failed} total)`)
console.log(`${'═'.repeat(60)}`)

process.exit(failed > 0 ? 1 : 0)
