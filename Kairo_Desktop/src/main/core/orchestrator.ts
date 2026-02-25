import { randomUUID } from 'node:crypto'
import type {
  SendMessageRequest,
  SendMessageResponse,
  ChatMessage,
  IpcResult,
} from '../../shared/types'
import { generateContent, countTokens, isInitialized } from '../services/gemini-gateway'
import { routeModel } from '../services/model-router'
import { TokenBudgeter } from '../services/token-budgeter'
import { SessionManager } from '../services/session-manager'

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

  constructor() {
    this.budgeter = new TokenBudgeter()
    this.sessionManager = new SessionManager()
  }

  async handleChatMessage(
    request: SendMessageRequest
  ): Promise<IpcResult<SendMessageResponse>> {
    if (!isInitialized()) {
      return {
        success: false,
        error: 'Gemini API not initialized. Set GEMINI_API_KEY environment variable.',
      }
    }

    try {
      const modelId = routeModel('foreground', request.model)

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
}
