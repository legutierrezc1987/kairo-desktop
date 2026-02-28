import { GoogleGenerativeAI, type GenerativeModel, type Content } from '@google/generative-ai'
import type { ModelId } from '../../shared/types'

// ─── Types ──────────────────────────────────────────────────

export interface GeminiResponse {
  text: string
  tokenCount: {
    prompt: number
    completion: number
    total: number
  }
}

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onComplete: (response: GeminiResponse) => void
  onError: (error: Error) => void
}

// ─── Module State ───────────────────────────────────────────

let sdk: GoogleGenerativeAI | null = null
const models: Map<ModelId, GenerativeModel> = new Map()

/** Active AbortController for current stream. Null when idle. */
let activeAbortController: AbortController | null = null

// ─── Init / Reset ───────────────────────────────────────────

export function initGeminiGateway(apiKey: string): void {
  sdk = new GoogleGenerativeAI(apiKey)
  const modelIds: ModelId[] = ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  for (const modelId of modelIds) {
    models.set(modelId, sdk.getGenerativeModel({ model: modelId }))
  }
}

export function resetGeminiGateway(): void {
  abortActiveStream()
  sdk = null
  models.clear()
}

export function isInitialized(): boolean {
  return sdk !== null
}

function getModel(modelId: ModelId): GenerativeModel {
  const model = models.get(modelId)
  if (!model) {
    throw new Error(`[GeminiGateway] Model "${modelId}" not initialized. Call initGeminiGateway first.`)
  }
  return model
}

// ─── One-shot (legacy, kept for non-streaming paths) ────────

export async function generateContent(prompt: string, modelId: ModelId): Promise<GeminiResponse> {
  const model = getModel(modelId)
  const result = await model.generateContent(prompt)
  const response = result.response
  const text = response.text()
  const usage = response.usageMetadata

  return {
    text,
    tokenCount: {
      prompt: usage?.promptTokenCount ?? 0,
      completion: usage?.candidatesTokenCount ?? 0,
      total: usage?.totalTokenCount ?? 0,
    },
  }
}

export async function countTokens(content: string, modelId: ModelId): Promise<number> {
  const model = getModel(modelId)
  const result = await model.countTokens(content)
  return result.totalTokens
}

// ─── Streaming (Phase 4 Sprint C) ──────────────────────────

/**
 * Stream a multi-turn chat message.
 * Uses ChatSession.sendMessageStream() for history-aware generation.
 * Caller provides history (from orchestrator) and callbacks.
 *
 * AbortController is managed internally — one active stream at a time.
 * Returns only after the stream completes, errors, or is aborted.
 */
export async function streamChatMessage(
  prompt: string,
  modelId: ModelId,
  history: Content[],
  callbacks: StreamCallbacks,
): Promise<void> {
  const model = getModel(modelId)
  const controller = new AbortController()
  activeAbortController = controller

  try {
    const chat = model.startChat({ history })
    const streamResult = await chat.sendMessageStream(prompt, {
      signal: controller.signal,
    })

    for await (const chunk of streamResult.stream) {
      if (controller.signal.aborted) break
      const text = chunk.text()
      if (text) {
        callbacks.onChunk(text)
      }
    }

    // Aggregated response has authoritative token counts
    const finalResponse = await streamResult.response
    const usage = finalResponse.usageMetadata
    const fullText = finalResponse.text()

    callbacks.onComplete({
      text: fullText,
      tokenCount: {
        prompt: usage?.promptTokenCount ?? 0,
        completion: usage?.candidatesTokenCount ?? 0,
        total: usage?.totalTokenCount ?? 0,
      },
    })
  } catch (error: unknown) {
    if (controller.signal.aborted) {
      callbacks.onError(new Error('Generation aborted by user'))
    } else {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
    }
  } finally {
    if (activeAbortController === controller) {
      activeAbortController = null
    }
  }
}

// ─── Abort ──────────────────────────────────────────────────

/** Abort the active stream. Returns true if a stream was actually aborted. */
export function abortActiveStream(): boolean {
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
    return true
  }
  return false
}

/** Returns true if a stream is currently active. */
export function isStreaming(): boolean {
  return activeAbortController !== null
}
