import { randomUUID } from 'node:crypto'
import type {
  SendMessageRequest,
  SendMessageResponse,
  ChatMessage,
  IpcResult,
  CutReason,
  SessionRecord,
  CreateSessionResponse,
  GetActiveSessionResponse,
} from '../../shared/types'
import { generateContent, countTokens, isInitialized } from '../services/gemini-gateway'
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

  constructor(options?: OrchestratorOptions) {
    this.budgeter = new TokenBudgeter(options?.totalBudget)
    this.sessionManager = new SessionManager()
    this.sessionPersistence = options?.sessionPersistence ?? null
  }

  // ─── Project Context ────────────────────────────────────────

  setActiveProject(projectId: string | null): void {
    if (projectId === this.activeProjectId) return
    // Archive current session if switching projects
    if (this.activeDbSessionId) {
      this.archiveCurrentSession('manual')
    }
    this.activeProjectId = projectId
    this.activeDbSessionId = null
    this.budgeter.reset()
    this.sessionManager.startSession()
    console.log(`[KAIRO_ORCHESTRATOR] Active project: ${projectId ?? 'none'}`)
  }

  getActiveProjectId(): string | null {
    return this.activeProjectId
  }

  // ─── Public archive request (for kill switch / external triggers) ──

  requestArchive(reason: CutReason): void {
    this.archiveCurrentSession(reason)
  }

  // ─── Chat Message Handler ───────────────────────────────────

  async handleChatMessage(
    request: SendMessageRequest
  ): Promise<IpcResult<SendMessageResponse>> {
    if (!isInitialized()) {
      return {
        success: false,
        error: 'Gemini API not initialized. Configure an account or set GEMINI_API_KEY environment variable.',
      }
    }

    try {
      const modelId = routeModel('foreground', request.model)

      // Ensure DB session exists (lazy creation)
      this.ensureDbSession()

      // Pre-count input tokens via countTokens API.
      // If countTokens fails (429 quota, network, etc.), fall back to estimate.
      let inputTokenCount: number
      try {
        inputTokenCount = await countTokens(request.content, modelId)
      } catch {
        inputTokenCount = estimateTokens(request.content)
      }

      // Record input tokens BEFORE the generation call.
      // This ensures ContextMeter reflects usage even if generation fails midway.
      this.budgeter.record('chat', inputTokenCount)

      const result = await generateContent(request.content, modelId)

      // Record output tokens (completion) from the actual response.
      // Subtract the input we already recorded to avoid double-counting
      // if usageMetadata.total includes both prompt + completion.
      const outputTokens = result.tokenCount.completion
      this.budgeter.record('chat', outputTokens)
      this.sessionManager.incrementTurn(result.tokenCount.total)

      // Persist tokens to DB (best-effort, never blocks response)
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
    this.budgeter.reset()
    this.sessionManager.startSession()
  }
}
