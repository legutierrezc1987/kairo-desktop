import { randomUUID } from 'node:crypto'
import type { Content } from '@google/generative-ai'
import type {
  SendMessageRequest,
  SendMessageResponse,
  ChatMessage,
  IpcResult,
  CutReason,
  SessionRecord,
  CreateSessionResponse,
  GetActiveSessionResponse,
  StreamChunk,
} from '../../shared/types'
import {
  isInitialized,
  generateContent,
  countTokens,
  streamChatMessage,
  abortActiveStream,
  type GeminiResponse,
} from '../services/gemini-gateway'
import { routeModel } from '../services/model-router'
import { TokenBudgeter } from '../services/token-budgeter'
import { SessionManager } from '../services/session-manager'
import { MAX_TURNS_PER_SESSION, SESSION_CUT_THRESHOLD_PERCENT } from '../../shared/constants'

// ─── Port Interface (interface segregation — no circular imports) ────

export interface SessionPersistencePort {
  createSession(projectId: string): IpcResult<CreateSessionResponse>
  getActiveSession(projectId: string): IpcResult<GetActiveSessionResponse>
  addTokens(sessionId: string, tokensToAdd: number): IpcResult<{ session: SessionRecord }>
  archiveSession(sessionId: string, cutReason: CutReason): IpcResult<{ session: SessionRecord }>
}

export interface OrchestratorOptions {
  sessionPersistence?: SessionPersistencePort
  totalBudget?: number
}

/**
 * Callback for sending stream chunks to the renderer via IPC push.
 * Registered by chat.handlers.ts at handler-registration time.
 */
export type StreamChunkSender = (chunk: StreamChunk) => void

/**
 * Fallback token estimate when countTokens API is unavailable (e.g. 429 quota).
 * Uses ~4 characters per token heuristic — conservative for English text.
 * Documented: DEC-021 budget allocations require metering even when API is down.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export class Orchestrator {
  private budgeter: TokenBudgeter
  private sessionManager: SessionManager
  private sessionPersistence: SessionPersistencePort | null
  private activeProjectId: string | null = null
  private activeDbSessionId: string | null = null

  /** Multi-turn chat history (Gemini Content[] format). Lives ONLY in main. */
  private chatHistory: Content[] = []

  /** Single-flight guard: true while a stream is in progress. */
  private _isStreaming = false

  constructor(options?: OrchestratorOptions) {
    this.budgeter = new TokenBudgeter(options?.totalBudget)
    this.sessionManager = new SessionManager()
    this.sessionPersistence = options?.sessionPersistence ?? null
  }

  // ─── Project Context ────────────────────────────────────────

  setActiveProject(projectId: string | null): void {
    if (projectId === this.activeProjectId) return
    // Abort any in-flight stream before switching projects
    this.abortStream()
    // Archive current session if switching projects
    if (this.activeDbSessionId) {
      this.archiveCurrentSession('manual')
    }
    this.activeProjectId = projectId
    this.activeDbSessionId = null
    this.chatHistory = []
    this.budgeter.reset()
    this.sessionManager.startSession()
    console.log(`[KAIRO_ORCHESTRATOR] Active project: ${projectId ?? 'none'}`)
  }

  getActiveProjectId(): string | null {
    return this.activeProjectId
  }

  // ─── Public archive request (for kill switch / external triggers) ──

  requestArchive(reason: CutReason): void {
    this.abortStream()
    this.archiveCurrentSession(reason)
  }

  // ─── Streaming Guard ──────────────────────────────────────────

  isStreaming(): boolean {
    return this._isStreaming
  }

  // ─── Abort ────────────────────────────────────────────────────

  /** Abort active stream + cleanup. Safe to call when idle. */
  abortStream(): void {
    if (this._isStreaming) {
      abortActiveStream()
      this._isStreaming = false
    }
  }

  // ─── Shutdown (app quit) ──────────────────────────────────────

  shutdown(): void {
    this.abortStream()
  }

  // ─── Streaming Chat Message Handler (Phase 4 Sprint C) ────────

  async handleStreamingChat(
    request: SendMessageRequest,
    sendChunk: StreamChunkSender,
  ): Promise<IpcResult<{ messageId: string }>> {
    // Single-flight guard: reject overlapping sends
    if (this._isStreaming) {
      return {
        success: false,
        error: 'A generation is already in progress. Wait or abort first.',
      }
    }

    if (!isInitialized()) {
      return {
        success: false,
        error: 'Gemini API not initialized. Configure an account or set GEMINI_API_KEY environment variable.',
      }
    }

    const messageId = randomUUID()
    const modelId = routeModel('foreground', request.model)

    // Ensure DB session exists (lazy creation)
    this.ensureDbSession()

    // Append user turn to history
    this.chatHistory.push({
      role: 'user',
      parts: [{ text: request.content }],
    })

    this._isStreaming = true

    try {
      await streamChatMessage(
        request.content,
        modelId,
        // Pass history WITHOUT the current user message (SDK adds it internally)
        this.chatHistory.slice(0, -1),
        {
          onChunk: (text: string) => {
            sendChunk({ messageId, delta: text, done: false })
          },

          onComplete: (response: GeminiResponse) => {
            // Append model turn to history
            this.chatHistory.push({
              role: 'model',
              parts: [{ text: response.text }],
            })

            // Token accounting: authoritative, at completion only
            const totalTokens = response.tokenCount.total
            this.budgeter.record('chat', totalTokens)
            this.sessionManager.incrementTurn(totalTokens)
            this.persistTokens(totalTokens)

            // Terminal chunk with token count
            sendChunk({
              messageId,
              delta: '',
              done: true,
              tokenCount: totalTokens,
            })
          },

          onError: (error: Error) => {
            // P1 FIX: ALWAYS send terminal error chunk to prevent UI zombie
            sendChunk({
              messageId,
              delta: '',
              done: true,
              error: error.message,
            })

            // Roll back the user turn from history on error
            if (this.chatHistory.length > 0 && this.chatHistory[this.chatHistory.length - 1].role === 'user') {
              this.chatHistory.pop()
            }
          },
        },
      )

      return { success: true, data: { messageId } }
    } catch (error: unknown) {
      // Defensive: should not reach here (streamChatMessage catches internally)
      const msg = error instanceof Error ? error.message : 'Unknown streaming error'
      sendChunk({ messageId, delta: '', done: true, error: msg })
      return { success: false, error: msg }
    } finally {
      this._isStreaming = false
    }
  }

  // ─── Legacy one-shot (kept for backward compat / tests) ──────

  async handleChatMessage(
    request: SendMessageRequest,
  ): Promise<IpcResult<SendMessageResponse>> {
    if (!isInitialized()) {
      return {
        success: false,
        error: 'Gemini API not initialized. Configure an account or set GEMINI_API_KEY environment variable.',
      }
    }

    try {
      const modelId = routeModel('foreground', request.model)

      this.ensureDbSession()

      let inputTokenCount: number
      try {
        inputTokenCount = await countTokens(request.content, modelId)
      } catch {
        inputTokenCount = estimateTokens(request.content)
      }

      this.budgeter.record('chat', inputTokenCount)
      const result = await generateContent(request.content, modelId)
      const outputTokens = result.tokenCount.completion
      this.budgeter.record('chat', outputTokens)
      this.sessionManager.incrementTurn(result.tokenCount.total)
      this.persistTokens(result.tokenCount.total)

      const responseMessage: ChatMessage = {
        id: randomUUID(),
        role: 'model',
        content: result.text,
        timestamp: Date.now(),
        model: modelId,
        tokenCount: result.tokenCount.total,
      }

      return {
        success: true,
        data: {
          message: responseMessage,
          tokenUsage: result.tokenCount,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      return { success: false, error: message }
    }
  }

  getTokenBudgetState() {
    return this.budgeter.getState()
  }

  getSessionState() {
    return this.sessionManager.getState()
  }

  /** Expose history length for testing/diagnostics */
  getChatHistoryLength(): number {
    return this.chatHistory.length
  }

  // ─── Private: DB Session Lifecycle ──────────────────────────

  private ensureDbSession(): void {
    if (!this.sessionPersistence || !this.activeProjectId || this.activeDbSessionId) return

    const active = this.sessionPersistence.getActiveSession(this.activeProjectId)
    if (active.success && active.data?.session) {
      this.activeDbSessionId = active.data.session.id
    } else {
      const created = this.sessionPersistence.createSession(this.activeProjectId)
      if (created.success && created.data) {
        this.activeDbSessionId = created.data.session.id
      }
    }
  }

  private persistTokens(totalTokens: number): void {
    if (!this.sessionPersistence || !this.activeDbSessionId) return

    try {
      this.sessionPersistence.addTokens(this.activeDbSessionId, totalTokens)
    } catch (err) {
      console.error('[KAIRO_ORCHESTRATOR] Failed to persist tokens:', err)
    }

    this.checkSessionLimits()
  }

  private checkSessionLimits(): void {
    const sessionState = this.sessionManager.getState()
    if (sessionState.turnCount >= MAX_TURNS_PER_SESSION) {
      this.archiveCurrentSession('turns')
      return
    }

    const budgetState = this.budgeter.getState()
    if (budgetState.totalUsed >= budgetState.totalBudget * SESSION_CUT_THRESHOLD_PERCENT) {
      this.archiveCurrentSession('tokens')
    }
  }

  private archiveCurrentSession(reason: CutReason): void {
    if (this.sessionPersistence && this.activeDbSessionId) {
      try {
        this.sessionPersistence.archiveSession(this.activeDbSessionId, reason)
        console.log(`[KAIRO_ORCHESTRATOR] Session archived (reason: ${reason})`)
      } catch (err) {
        console.error('[KAIRO_ORCHESTRATOR] Failed to archive session:', err)
      }
    }
    this.activeDbSessionId = null
    this.chatHistory = []
    this.budgeter.reset()
    this.sessionManager.startSession()
  }
}
