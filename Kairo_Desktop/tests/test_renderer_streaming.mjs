/**
 * test_renderer_streaming.mjs — Phase 4 Sprint C: Renderer Streaming Tests
 *
 * Source cross-verification for renderer streaming infrastructure:
 * 1. chatStore streaming state/actions (T01-T10)
 * 2. useChat streaming listener + abort (T11-T20)
 * 3. ChatPanel streaming bubble + stop button (T21-T28)
 * 4. MessageBubble compatibility (T29-T30)
 * 5. InputBar disable during streaming (T31-T32)
 *
 * Run: node tests/test_renderer_streaming.mjs
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

const chatStoreSrc = readFileSync(
  resolve(__dirname, '../src/renderer/src/stores/chatStore.ts'), 'utf8'
)
const useChatSrc = readFileSync(
  resolve(__dirname, '../src/renderer/src/hooks/useChat.ts'), 'utf8'
)
const chatPanelSrc = readFileSync(
  resolve(__dirname, '../src/renderer/src/components/Chat/ChatPanel.tsx'), 'utf8'
)
const messageBubbleSrc = readFileSync(
  resolve(__dirname, '../src/renderer/src/components/Chat/MessageBubble.tsx'), 'utf8'
)
const inputBarSrc = readFileSync(
  resolve(__dirname, '../src/renderer/src/components/Chat/InputBar.tsx'), 'utf8'
)

// ═════════════════════════════════════════════════════════════════════
// T01-T10: chatStore streaming state/actions
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T01-T10: chatStore streaming state ──')

assert(
  chatStoreSrc.includes('isStreaming: boolean'),
  'T01: chatStore has isStreaming state'
)
assert(
  chatStoreSrc.includes('streamingMessageId: string | null'),
  'T02: chatStore has streamingMessageId state'
)
assert(
  chatStoreSrc.includes('startStreaming: (messageId: string) => void'),
  'T03: chatStore has startStreaming action'
)
assert(
  chatStoreSrc.includes('appendDelta: (messageId: string, delta: string) => void'),
  'T04: chatStore has appendDelta action'
)
assert(
  chatStoreSrc.includes('finishStreaming: (messageId: string, tokenCount?: number) => void'),
  'T05: chatStore has finishStreaming action'
)
assert(
  chatStoreSrc.includes('failStreaming: (messageId: string, error: string) => void'),
  'T06: chatStore has failStreaming action'
)

// startStreaming creates empty model bubble
assert(
  chatStoreSrc.includes("role: 'model'") && chatStoreSrc.includes("content: ''"),
  'T07: startStreaming creates empty model message placeholder'
)

// appendDelta concatenates to existing message
assert(
  chatStoreSrc.includes('m.content + delta'),
  'T08: appendDelta concatenates delta to message content'
)

// finishStreaming clears streaming state
assert(
  chatStoreSrc.includes('isStreaming: false') &&
  chatStoreSrc.includes('streamingMessageId: null') &&
  chatStoreSrc.includes('isLoading: false'),
  'T09: finishStreaming clears all streaming flags'
)

// failStreaming removes empty placeholder
assert(
  chatStoreSrc.includes("m.id === messageId && m.content === ''"),
  'T10: failStreaming removes empty placeholder message'
)

// ═════════════════════════════════════════════════════════════════════
// T11-T20: useChat streaming listener + abort
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T11-T20: useChat streaming listener ──')

assert(
  useChatSrc.includes("import { useCallback, useEffect } from 'react'"),
  'T11: useChat imports useEffect for listener registration'
)
assert(
  useChatSrc.includes('CHAT_STREAM_CHUNK'),
  'T12: useChat references CHAT_STREAM_CHUNK channel'
)
assert(
  useChatSrc.includes('api.on('),
  'T13: useChat registers listener via api.on()'
)
assert(
  useChatSrc.includes('return unsubscribe'),
  'T14: useChat returns cleanup from useEffect (unsubscribe)'
)
assert(
  useChatSrc.includes('appendDelta(c.messageId, c.delta)'),
  'T15: listener calls appendDelta for non-done chunks'
)
assert(
  useChatSrc.includes('failStreaming(c.messageId, c.error)'),
  'T16: listener calls failStreaming when chunk has error'
)
assert(
  useChatSrc.includes('finishStreaming(c.messageId, c.tokenCount)'),
  'T17: listener calls finishStreaming for done chunks without error'
)
assert(
  useChatSrc.includes('startStreaming(result.data.messageId)'),
  'T18: sendMessage calls startStreaming with messageId from response'
)
assert(
  useChatSrc.includes('abortGeneration'),
  'T19: useChat exports abortGeneration function'
)
assert(
  useChatSrc.includes('IPC_CHANNELS.CHAT_ABORT'),
  'T20: abortGeneration invokes CHAT_ABORT channel'
)

// ═════════════════════════════════════════════════════════════════════
// T21-T28: ChatPanel streaming UI
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T21-T28: ChatPanel streaming UI ──')

assert(
  chatPanelSrc.includes("useChatStore((s) => s.isStreaming)"),
  'T21: ChatPanel reads isStreaming from store'
)
assert(
  chatPanelSrc.includes('abortGeneration'),
  'T22: ChatPanel destructures abortGeneration from useChat'
)
assert(
  chatPanelSrc.includes('Stop generating'),
  'T23: ChatPanel renders stop button text'
)
assert(
  chatPanelSrc.includes('{isStreaming && ('),
  'T24: Stop button only visible during streaming'
)
assert(
  chatPanelSrc.includes('onClick={abortGeneration}'),
  'T25: Stop button onClick calls abortGeneration'
)
assert(
  chatPanelSrc.includes('isLoading && !isStreaming'),
  'T26: "Thinking..." shown only when loading but NOT streaming'
)
assert(
  chatPanelSrc.includes('disabled={isLoading') && chatPanelSrc.includes('disabled='),
  'T27: InputBar disabled during loading (includes streaming and cut phase)'
)
assert(
  chatPanelSrc.includes("border: '1px solid #ef4444'"),
  'T28: Stop button styled with red border'
)

// ═════════════════════════════════════════════════════════════════════
// T29-T30: MessageBubble compatibility
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T29-T30: MessageBubble compatibility ──')

assert(
  messageBubbleSrc.includes('message.content'),
  'T29: MessageBubble renders message.content (works with streaming accumulation)'
)
assert(
  messageBubbleSrc.includes('message.tokenCount !== undefined'),
  'T30: MessageBubble conditionally shows tokenCount (undefined during streaming)'
)

// ═════════════════════════════════════════════════════════════════════
// T31-T32: InputBar disable
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T31-T32: InputBar disable ──')

assert(
  inputBarSrc.includes('disabled: boolean'),
  'T31: InputBar accepts disabled prop'
)
assert(
  inputBarSrc.includes('disabled={disabled}'),
  'T32: InputBar textarea uses disabled prop'
)

// ═════════════════════════════════════════════════════════════════════
// T33-T34: Store safety patterns
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T33-T34: Store safety patterns ──')

assert(
  chatStoreSrc.includes("messages: state.messages.filter(") &&
  chatStoreSrc.includes("m.content === ''"),
  'T33: failStreaming removes empty placeholder (prevents ghost bubble)'
)
assert(
  chatStoreSrc.includes('clearMessages') &&
  chatStoreSrc.includes('isStreaming: false, streamingMessageId: null'),
  'T34: clearMessages resets streaming state (prevents orphaned streaming flag)'
)

// ═════════════════════════════════════════════════════════════════════
// T35-T38: Consolidation status in chatStore (Phase 5 Sprint B)
// ═════════════════════════════════════════════════════════════════════
console.log('\n── T35-T38: Consolidation status in chatStore ──')

assert(
  chatStoreSrc.includes('consolidationPhase: ConsolidationPhase | null'),
  'T35: chatStore has consolidationPhase state'
)
assert(
  chatStoreSrc.includes('setConsolidationPhase: (phase: ConsolidationPhase | null) => void'),
  'T36: chatStore has setConsolidationPhase action'
)
assert(
  chatStoreSrc.includes('consolidationPhase: null,'),
  'T37: consolidationPhase initialized to null'
)
assert(
  chatStoreSrc.includes('setConsolidationPhase: (consolidationPhase) => set({ consolidationPhase })'),
  'T38: setConsolidationPhase setter implemented'
)

// useChat hook consolidation listener (useChatSrc already loaded above)
assert(
  useChatSrc.includes('CONSOLIDATION_STATUS'),
  'T39: useChat registers CONSOLIDATION_STATUS listener'
)
assert(
  useChatSrc.includes('ConsolidationStatusEvent'),
  'T40: useChat imports ConsolidationStatusEvent type'
)
assert(
  useChatSrc.includes('setConsolidationPhase'),
  'T41: useChat calls setConsolidationPhase'
)

// ChatPanel consolidation indicator (chatPanelSrc already loaded above)
assert(
  chatPanelSrc.includes('consolidationPhase'),
  'T42: ChatPanel reads consolidationPhase from store'
)
assert(
  chatPanelSrc.includes('CONSOLIDATION_PHASE_LABELS'),
  'T43: ChatPanel uses CONSOLIDATION_PHASE_LABELS for display'
)
assert(
  chatPanelSrc.includes('Consolidating memory...'),
  'T44: ChatPanel has fallback consolidation label'
)

// ═════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`)
console.log(`Renderer Streaming tests: ${passed} passed, ${failed} failed (${passed + failed} total)`)
console.log(`${'═'.repeat(60)}`)

process.exit(failed > 0 ? 1 : 0)
