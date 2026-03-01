import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Content } from '@google/generative-ai'
import type {
  SendMessageRequest,
  SendMessageResponse,
  ChatMessage,
  ModelId,
  IpcResult,
  CutReason,
  SessionRecord,
  CreateSessionResponse,
  GetActiveSessionResponse,
  StreamChunk,
  CutPipelinePhase,
  CutPipelineEvent,
  BridgeBuffer,
  MemoryQueryResponse,
  RecallTrigger,
  RecallStatusPhase,
  RecallStatusEvent,
} from '../../shared/types'
import {
  isInitialized,
  generateContent,
  countTokens,
  streamChatMessage,
  abortActiveStream,
  type GeminiResponse,
} from '../services/gemini-gateway'
import { is429, retryWithBackoff, type RateLimitEmitter } from '../services/rate-limit.service'
import { routeModel } from '../services/model-router'
import { TokenBudgeter } from '../services/token-budgeter'
import { SessionManager } from '../services/session-manager'
import { buildSystemPrompt } from '../config/system-prompt'
import { createSnapshot, type SnapshotResult } from '../services/snapshot.service'
import { shouldRecall, buildQuery, truncateToRecallBudget, type RecallContext } from '../memory/recall-strategy'
import {
  MAX_TURNS_PER_SESSION,
  SESSION_CUT_THRESHOLD_PERCENT,
  BRIDGE_BUFFER_TOKEN_TARGET,
  RECALL_QUERY_TIMEOUT_MS,
} from '../../shared/constants'

// ─── Port Interfaces (interface segregation — no circular imports) ────

export interface SessionPersistencePort {
  createSession(projectId: string): IpcResult<CreateSessionResponse>
  getActiveSession(projectId: string): IpcResult<GetActiveSessionResponse>
  addTokens(sessionId: string, tokensToAdd: number): IpcResult<{ session: SessionRecord }>
  archiveSession(sessionId: string, cutReason: CutReason): IpcResult<{ session: SessionRecord }>
  updatePaths?(sessionId: string, transcriptPath: string, summaryPath: string): void
}

export interface MemoryPort {
  query(query: string, maxResults?: number): Promise<IpcResult<MemoryQueryResponse>>
}

export interface UploadQueuePort {
  enqueue(sessionId: string, filePath: string, fileType: 'transcript' | 'summary' | 'master_summary'): void
}

export interface OrchestratorOptions {
  sessionPersistence?: SessionPersistencePort
  memoryPort?: MemoryPort
  uploadQueuePort?: UploadQueuePort
  projectFolderPath?: string
  projectName?: string
  totalBudget?: number
}

/**
 * Callback for sending stream chunks to the renderer via IPC push.
 * Registered by chat.handlers.ts at handler-registration time.
 */
export type StreamChunkSender = (chunk: StreamChunk) => void

/**
 * Callback for sending cut pipeline state to renderer via IPC push.
 * Registered by index.ts at startup.
 */
export type CutPipelineStateSender = (event: CutPipelineEvent) => void

/**
 * Callback for sending recall status to renderer via IPC push.
 * Registered by index.ts at startup. Codex guard #3: must always emit terminal state.
 */
export type RecallStatusSender = (event: RecallStatusEvent) => void

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
  private memoryPort: MemoryPort | null
  private uploadQueuePort: UploadQueuePort | null
  private activeProjectId: string | null = null
  private activeProjectName: string = ''
  private activeProjectFolderPath: string = ''
  private activeDbSessionId: string | null = null
  private activeSessionNumber = 0

  /** Multi-turn chat history (Gemini Content[] format). Lives ONLY in main. */
  private chatHistory: Content[] = []

  /** Single-flight guard: true while a stream is in progress. */
  private _isStreaming = false

  /** Concurrency guard: true while the cut pipeline is executing (Codex guard #1). */
  private _isCutting = false

  /** Concurrency guard: true while a recall query is in-flight (NO-GO remediation). */
  private _isRecalling = false

  /** Bridge buffer from last session cut (injected into next session context). */
  private _bridgeBuffer: BridgeBuffer | null = null

  /** Callback for pushing cut pipeline state to renderer. */
  private _cutStateSender: CutPipelineStateSender | null = null

  /** Callback for pushing recall status to renderer (Codex guard #3). */
  private _recallStatusSender: RecallStatusSender | null = null

  /** Callback for pushing rate-limit status to renderer (Phase 5 Sprint C, PRD §14). */
  private _rateLimitEmitter: RateLimitEmitter | null = null

  /** Turns since last recall was executed (for periodic trigger). */
  private _turnsSinceLastRecall = 0

  constructor(options?: OrchestratorOptions) {
    this.budgeter = new TokenBudgeter(options?.totalBudget)
    this.sessionManager = new SessionManager()
    this.sessionPersistence = options?.sessionPersistence ?? null
    this.memoryPort = options?.memoryPort ?? null
    this.uploadQueuePort = options?.uploadQueuePort ?? null
    if (options?.projectFolderPath) this.activeProjectFolderPath = options.projectFolderPath
    if (options?.projectName) this.activeProjectName = options.projectName
  }

  // ─── Cut State Sender Registration ─────────────────────────────

  setCutStateSender(sender: CutPipelineStateSender): void {
    this._cutStateSender = sender
  }

  private emitCutState(phase: CutPipelinePhase, error?: string): void {
    const event: CutPipelineEvent = {
      phase,
      sessionNumber: this.activeSessionNumber,
      error,
    }
    console.log(`[KAIRO_CUT_PIPELINE] Phase: ${phase}${error ? ` (error: ${error})` : ''}`)
    this._cutStateSender?.(event)
  }

  // ─── Recall Status Sender Registration (Phase 5 Sprint A) ────

  setRecallStatusSender(sender: RecallStatusSender): void {
    this._recallStatusSender = sender
  }

  // ─── Rate-Limit Emitter Registration (Phase 5 Sprint C, PRD §14) ────

  setRateLimitEmitter(emitter: RateLimitEmitter): void {
    this._rateLimitEmitter = emitter
  }

  /**
   * Emit recall status event. Codex guard #3: MUST always emit a terminal
   * state ('done' | 'skipped' | 'error') to prevent UI stale indicator.
   */
  private emitRecallStatus(phase: RecallStatusPhase, trigger: RecallTrigger, error?: string): void {
    const event: RecallStatusEvent = { phase, trigger, error }
    console.log(`[KAIRO_RECALL] Phase: ${phase}, trigger: ${trigger}${error ? ` (error: ${error})` : ''}`)
    this._recallStatusSender?.(event)
  }

  // ─── Project Context ────────────────────────────────────────

  setActiveProject(projectId: string | null, folderPath?: string, projectName?: string): void {
    if (projectId === this.activeProjectId) return
    // Abort any in-flight stream before switching projects
    this.abortStream()
    // Archive current session if switching projects (sync — no full pipeline)
    if (this.activeDbSessionId) {
      this.archiveCurrentSessionSync('manual')
    }
    this.activeProjectId = projectId
    this.activeProjectFolderPath = folderPath ?? ''
    this.activeProjectName = projectName ?? ''
    this.activeDbSessionId = null
    this.activeSessionNumber = 0
    this.chatHistory = []
    this._bridgeBuffer = null
    this._turnsSinceLastRecall = 0
    this.budgeter.reset()
    this.sessionManager.startSession()
    console.log(`[KAIRO_ORCHESTRATOR] Active project: ${projectId ?? 'none'}`)
  }

  getActiveProjectId(): string | null {
    return this.activeProjectId
  }

  // ─── Ports: runtime injection ─────────────────────────────────

  setMemoryPort(port: MemoryPort): void {
    this.memoryPort = port
  }

  setUploadQueuePort(port: UploadQueuePort): void {
    this.uploadQueuePort = port
  }

  // ─── Public archive request (async 12-step pipeline) ──────────

  /**
   * Request session archive — triggers the full 12-step cut pipeline.
   * Codex guard #1: rejects if already cutting (idempotent).
   * Codex guard #5: emits terminal state in finally (UI unlock guarantee).
   */
  async requestArchive(reason: CutReason): Promise<void> {
    // Codex guard #2: idempotent — reject re-entry
    if (this._isCutting) {
      console.warn('[KAIRO_ORCHESTRATOR] requestArchive rejected: cut already in progress')
      return
    }

    this._isCutting = true
    try {
      await this.executeCutPipeline(reason)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[KAIRO_CUT_PIPELINE] Pipeline error: ${msg}`)
      // Codex guard #5: always emit terminal error state
      this.emitCutState('error', msg)
    } finally {
      this._isCutting = false
    }
  }

  // ─── Streaming Guard ──────────────────────────────────────────

  isStreaming(): boolean {
    return this._isStreaming
  }

  isCutting(): boolean {
    return this._isCutting
  }

  isRecalling(): boolean {
    return this._isRecalling
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
    // Codex guard #1: reject chat while cutting
    if (this._isCutting) {
      return {
        success: false,
        error: 'Session cut in progress. Please wait.',
      }
    }

    // Single-flight guard: reject overlapping sends
    if (this._isStreaming) {
      return {
        success: false,
        error: 'A generation is already in progress. Wait or abort first.',
      }
    }

    // NO-GO remediation: reject chat while recall is injecting into history
    if (this._isRecalling) {
      return {
        success: false,
        error: 'Memory recall in progress. Please wait.',
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
      // Rate-limit aware streaming (Phase 5 Sprint C, PRD §14)
      // Each retry creates a fresh stream scope (P1 audit: no leaked listeners/AbortControllers).
      // streamChatMessage catches errors internally and calls onError — we reject on 429
      // so retryWithBackoff can intercept and retry with backoff.
      const streamOnce = (tryModelId: ModelId): Promise<void> => {
        return new Promise<void>((resolve, reject) => {
          streamChatMessage(
            request.content,
            tryModelId,
            this.chatHistory.slice(0, -1),
            {
              onChunk: (text: string) => {
                sendChunk({ messageId, delta: text, done: false })
              },

              onComplete: (response: GeminiResponse) => {
                this.chatHistory.push({
                  role: 'model',
                  parts: [{ text: response.text }],
                })

                const totalTokens = response.tokenCount.total
                this.budgeter.record('chat', totalTokens)
                this.sessionManager.incrementTurn(totalTokens)
                this.persistTokens(totalTokens)

                this._turnsSinceLastRecall++
                this.maybePeriodicRecall(request.content)

                sendChunk({
                  messageId,
                  delta: '',
                  done: true,
                  tokenCount: totalTokens,
                })
                resolve()
              },

              onError: (error: Error) => {
                if (is429(error)) {
                  // 429/transient: reject so retryWithBackoff can retry
                  reject(error)
                } else {
                  // Non-retryable: send error chunk, roll back user turn, resolve
                  sendChunk({
                    messageId,
                    delta: '',
                    done: true,
                    error: error.message,
                  })
                  if (this.chatHistory.length > 0 && this.chatHistory[this.chatHistory.length - 1].role === 'user') {
                    this.chatHistory.pop()
                  }
                  resolve()
                }
              },
            },
          ).catch(reject) // Defensive: handle any unexpected throws from gateway
        })
      }

      await retryWithBackoff(streamOnce, {
        model: modelId,
        emitStatus: this._rateLimitEmitter ?? undefined,
      })

      return { success: true, data: { messageId } }
    } catch (error: unknown) {
      // Reached on: "Cuota agotada" (all retries + fallback exhausted) or unexpected errors
      const msg = error instanceof Error ? error.message : 'Unknown streaming error'
      sendChunk({ messageId, delta: '', done: true, error: msg })
      // Roll back user turn on final exhaustion
      if (this.chatHistory.length > 0 && this.chatHistory[this.chatHistory.length - 1].role === 'user') {
        this.chatHistory.pop()
      }
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

  /** Expose bridge buffer for testing */
  getBridgeBuffer(): BridgeBuffer | null {
    return this._bridgeBuffer
  }

  // ─── Private: 12-Step Cut Pipeline (PRD §5.3) ─────────────────

  private async executeCutPipeline(reason: CutReason): Promise<void> {
    // Step 1: Block UI
    this.emitCutState('blocking')
    this.abortStream()

    const sessionId = this.activeDbSessionId
    const sessionNumber = this.activeSessionNumber
    const history = [...this.chatHistory] // snapshot before clearing
    const projectFolder = this.activeProjectFolderPath

    // Step 2: Count tokens (informational — budget already tracked)
    this.emitCutState('counting')

    // Step 3-4: Generate summary + save to disk
    this.emitCutState('generating')
    let snapshot: SnapshotResult | null = null
    if (projectFolder && history.length > 0) {
      try {
        snapshot = await createSnapshot(projectFolder, sessionNumber, history)
      } catch (err) {
        console.error(`[KAIRO_CUT_PIPELINE] Snapshot failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Step 4b: Save paths to DB
    this.emitCutState('saving')
    if (snapshot && sessionId && this.sessionPersistence?.updatePaths) {
      try {
        this.sessionPersistence.updatePaths(sessionId, snapshot.transcriptPath, snapshot.summaryPath)
      } catch (err) {
        console.error(`[KAIRO_CUT_PIPELINE] Failed to update session paths: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Step 5: Enqueue upload
    this.emitCutState('uploading')
    if (snapshot && sessionId && this.uploadQueuePort) {
      try {
        this.uploadQueuePort.enqueue(sessionId, snapshot.transcriptPath, 'transcript')
        this.uploadQueuePort.enqueue(sessionId, snapshot.summaryPath, 'summary')
      } catch (err) {
        console.error(`[KAIRO_CUT_PIPELINE] Enqueue failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Step 6: Upload happens async via SyncWorker (non-blocking)

    // Step 7: Clear history — archive current session in DB
    if (this.sessionPersistence && sessionId) {
      try {
        this.sessionPersistence.archiveSession(sessionId, reason)
        console.log(`[KAIRO_ORCHESTRATOR] Session archived (reason: ${reason})`)
      } catch (err) {
        console.error('[KAIRO_ORCHESTRATOR] Failed to archive session:', err)
      }
    }

    // Step 8: Extract bridge buffer (last ~10K tokens of history)
    this._bridgeBuffer = this.extractBridgeBuffer(history, sessionNumber)

    // Reset orchestrator state for new session
    this.activeDbSessionId = null
    this.chatHistory = []
    this.budgeter.reset()
    this.sessionManager.startSession()

    // Step 9-10: Recall from memory via RecallStrategy (session_start trigger)
    this.emitCutState('recalling')
    let recallContext = ''
    try {
      recallContext = await this.executeRecall('session_start')
    } catch {
      // executeRecall already handles errors and emits status — fallback to local file
    }
    // Fallback: if recall returned nothing and we have a local summary, use it
    if (!recallContext && snapshot?.summaryPath) {
      try {
        const localContent = await readFile(snapshot.summaryPath, 'utf-8')
        recallContext = truncateToRecallBudget(localContent)
      } catch {
        // No recall available — proceed without
      }
    }

    // Step 11: Build new context (system prompt with recall + bridge)
    const bridgeSummary = this._bridgeBuffer
      ? this._bridgeBuffer.messages.map(m => `${m.role}: ${m.text}`).join('\n')
      : ''

    // System prompt is built for potential future injection (Gemini systemInstruction)
    buildSystemPrompt(this.activeProjectName, recallContext, bridgeSummary)

    // Step 12: Unblock UI
    this.emitCutState('ready')
    console.log(`[KAIRO_CUT_PIPELINE] Pipeline complete for session #${sessionNumber}`)
  }

  // ─── Private: Recall Execution (Phase 5 Sprint A, DEC-026) ────

  /**
   * Check and fire periodic recall (trigger #4). Called after each completed turn.
   * Fire-and-forget: does not block the chat response.
   * Codex guard #1: runs inside single-flight lifecycle (stream already done).
   * Codex guard #3: always emits terminal recall status.
   */
  private maybePeriodicRecall(lastUserMessage: string): void {
    const context = this.buildRecallContext(lastUserMessage, false)
    if (!shouldRecall('periodic', context)) return

    // Fire-and-forget async recall
    this.executeRecall('periodic', context).catch(err => {
      console.error('[KAIRO_RECALL] Periodic recall error:', err)
    })
  }

  /**
   * Execute a recall query against long-term memory and inject results into chat history.
   * Codex guard #2: truncates to RECALL_BUDGET_TOKENS.
   * Codex guard #3: ALWAYS emits terminal state (done/skipped/error) in finally.
   */
  async executeRecall(trigger: RecallTrigger, context?: RecallContext): Promise<string> {
    const ctx = context ?? this.buildRecallContext('', trigger === 'session_start')

    if (!shouldRecall(trigger, ctx)) {
      this.emitRecallStatus('skipped', trigger)
      return ''
    }

    // NO-GO remediation: single-flight recall guard — prevents history corruption
    this._isRecalling = true
    this.emitRecallStatus('querying', trigger)
    try {
      const query = buildQuery(trigger, ctx)

      // Timeout guard for recall query
      const recallPromise = this.memoryPort!.query(query, 5)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Recall query timeout')), RECALL_QUERY_TIMEOUT_MS),
      )
      const result = await Promise.race([recallPromise, timeoutPromise])

      if (!result.success || !result.data || result.data.results.length === 0) {
        this.emitRecallStatus('done', trigger)
        this._turnsSinceLastRecall = 0
        return ''
      }

      // Merge results and truncate to budget (Codex guard #2)
      const rawContent = result.data.results.map(r => r.content).join('\n---\n')
      const truncated = truncateToRecallBudget(rawContent)

      // Inject as system-like context into chat history
      this.emitRecallStatus('injecting', trigger)
      this.chatHistory.push({
        role: 'user',
        parts: [{ text: `[RECALL — ${trigger}]\n${truncated}` }],
      })
      this.chatHistory.push({
        role: 'model',
        parts: [{ text: 'Understood. I have integrated the recalled context.' }],
      })

      // Record recall tokens in memory channel
      const recallTokens = Math.ceil(truncated.length / 4)
      this.budgeter.record('memory', recallTokens)

      this._turnsSinceLastRecall = 0
      this.emitRecallStatus('done', trigger)
      return truncated
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Codex guard #3: always emit terminal error state
      this.emitRecallStatus('error', trigger, msg)
      this._turnsSinceLastRecall = 0
      return ''
    } finally {
      this._isRecalling = false
    }
  }

  /** Build RecallContext from current orchestrator state */
  private buildRecallContext(lastUserMessage: string, isPostCut: boolean): RecallContext {
    const budgetState = this.budgeter.getState()
    return {
      turnsSinceLastRecall: this._turnsSinceLastRecall,
      isPostCut,
      lastUserMessage,
      currentTokensUsed: budgetState.totalUsed,
      totalBudget: budgetState.totalBudget,
      projectName: this.activeProjectName,
      hasMemoryPort: this.memoryPort !== null,
    }
  }

  // ─── Private: Bridge Buffer Extraction ────────────────────────

  private extractBridgeBuffer(history: Content[], sessionNumber: number): BridgeBuffer {
    const messages: Array<{ role: string; text: string }> = []
    let tokenEstimate = 0
    let lastUserTurn = ''

    // Walk history backwards, collecting turns until we hit target
    for (let i = history.length - 1; i >= 0 && tokenEstimate < BRIDGE_BUFFER_TOKEN_TARGET; i--) {
      const turn = history[i]
      const text = turn.parts?.map(p => ('text' in p ? p.text : '')).join('') ?? ''
      const turnTokens = estimateTokens(text)

      messages.unshift({ role: turn.role ?? 'user', text })
      tokenEstimate += turnTokens

      if (turn.role === 'user' && !lastUserTurn) {
        lastUserTurn = text
      }
    }

    return {
      messages,
      lastUserTurn,
      tokenEstimate,
      sourceSessionNumber: sessionNumber,
    }
  }

  // ─── Private: DB Session Lifecycle ──────────────────────────

  private ensureDbSession(): void {
    if (!this.sessionPersistence || !this.activeProjectId || this.activeDbSessionId) return

    const active = this.sessionPersistence.getActiveSession(this.activeProjectId)
    if (active.success && active.data?.session) {
      this.activeDbSessionId = active.data.session.id
      this.activeSessionNumber = active.data.session.sessionNumber
    } else {
      const created = this.sessionPersistence.createSession(this.activeProjectId)
      if (created.success && created.data) {
        this.activeDbSessionId = created.data.session.id
        this.activeSessionNumber = created.data.session.sessionNumber
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
      // Fire-and-forget: auto-archive on limit hit
      this.requestArchive('turns').catch(err => {
        console.error('[KAIRO_ORCHESTRATOR] Auto-archive failed:', err)
      })
      return
    }

    const budgetState = this.budgeter.getState()
    if (budgetState.totalUsed >= budgetState.totalBudget * SESSION_CUT_THRESHOLD_PERCENT) {
      this.requestArchive('tokens').catch(err => {
        console.error('[KAIRO_ORCHESTRATOR] Auto-archive failed:', err)
      })
    }
  }

  /**
   * Synchronous session archive — used only for project switch (setActiveProject).
   * Does NOT trigger the full 12-step pipeline (no snapshot/upload/recall).
   */
  private archiveCurrentSessionSync(reason: CutReason): void {
    if (this.sessionPersistence && this.activeDbSessionId) {
      try {
        this.sessionPersistence.archiveSession(this.activeDbSessionId, reason)
        console.log(`[KAIRO_ORCHESTRATOR] Session archived sync (reason: ${reason})`)
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
