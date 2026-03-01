/**
 * Rate-Limit Handler (Phase 5 Sprint C, PRD §14)
 *
 * Detects HTTP 429 / RESOURCE_EXHAUSTED / 503 transient errors from Google Gemini API.
 * Provides exponential backoff with jitter (1s, 2s, 4s) and Pro→Flash fallback.
 *
 * Design constraints:
 *   - Pure functions + explicit state — no singletons.
 *   - Each retry creates a fresh scope (P1 Gemini audit: no leaked listeners).
 *   - Caller provides the work function and the status emitter (port-based).
 */

import type { ModelId, RateLimitPhase, RateLimitStatus } from '../../shared/types'
import {
  RATE_LIMIT_MAX_RETRIES,
  RATE_LIMIT_BACKOFF_BASE_MS,
  RATE_LIMIT_BACKOFF_MULTIPLIER,
  RATE_LIMIT_BACKOFF_MAX_MS,
  RATE_LIMIT_JITTER_FACTOR,
} from '../../shared/constants'
import { MODEL_ROUTING } from '../../shared/constants'

// ─── 429 Detection ─────────────────────────────────────────

/**
 * Multi-signal detection: status code + message patterns.
 * Returns true for transient rate-limit or overload errors that warrant retry.
 */
export function is429(error: unknown): boolean {
  if (error == null) return false

  const asRecord = error as Record<string, unknown>

  // Signal 1: explicit HTTP status code (Google SDK error objects)
  const status = asRecord.status ?? asRecord.httpStatusCode ?? asRecord.code
  if (status === 429 || status === 503) return true

  // Signal 2: error message patterns
  const message = typeof asRecord.message === 'string' ? asRecord.message : String(error)
  const lower = message.toLowerCase()
  if (lower.includes('429')) return true
  if (lower.includes('resource_exhausted')) return true
  if (lower.includes('503')) return true
  if (lower.includes('quota')) return true
  if (lower.includes('rate limit')) return true
  if (lower.includes('too many requests')) return true

  return false
}

// ─── 401/403 Authentication Detection (Phase 7 Hotfix J) ────

/**
 * Multi-signal detection for authentication/authorization errors.
 * Returns true for invalid API key, revoked key, or permission denied errors.
 */
export function is401(error: unknown): boolean {
  if (error == null) return false

  const asRecord = error as Record<string, unknown>

  // Signal 1: explicit HTTP status code (Google SDK error objects)
  const status = asRecord.status ?? asRecord.httpStatusCode ?? asRecord.code
  if (status === 401 || status === 403) return true

  // Signal 2: error message patterns
  const message = typeof asRecord.message === 'string' ? asRecord.message : String(error)
  const lower = message.toLowerCase()
  if (lower.includes('401')) return true
  if (lower.includes('403')) return true
  if (lower.includes('unauthenticated')) return true
  if (lower.includes('invalid api key')) return true
  if (lower.includes('api key not valid')) return true
  if (lower.includes('permission_denied')) return true

  return false
}

// ─── Backoff Calculation ───────────────────────────────────

/**
 * Exponential backoff with jitter.
 * attempt 0 → ~1000ms, attempt 1 → ~2000ms, attempt 2 → ~4000ms, etc.
 * Jitter applies ±JITTER_FACTOR randomization.
 */
export function calculateBackoff(attempt: number): number {
  const base = RATE_LIMIT_BACKOFF_BASE_MS * Math.pow(RATE_LIMIT_BACKOFF_MULTIPLIER, attempt)
  const capped = Math.min(base, RATE_LIMIT_BACKOFF_MAX_MS)
  const jitter = 1 + (Math.random() * 2 - 1) * RATE_LIMIT_JITTER_FACTOR
  return Math.round(capped * jitter)
}

/** Deterministic backoff (for testing — no jitter). */
export function calculateBackoffNoJitter(attempt: number): number {
  const base = RATE_LIMIT_BACKOFF_BASE_MS * Math.pow(RATE_LIMIT_BACKOFF_MULTIPLIER, attempt)
  return Math.min(base, RATE_LIMIT_BACKOFF_MAX_MS)
}

// ─── Sleep ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Retry With Backoff ────────────────────────────────────

export type RateLimitEmitter = (status: RateLimitStatus) => void

export interface RetryOptions {
  /** Current model being used for the request */
  model: ModelId
  /** Fallback model to try after primary budget exhausted (default: MODEL_ROUTING.background) */
  fallbackModel?: ModelId
  /** Emit rate-limit status updates to IPC/UI */
  emitStatus?: RateLimitEmitter
}

/**
 * Execute `fn` with rate-limit retry logic.
 *
 * 1. Try fn() with `model`.
 * 2. On 429 → retry up to MAX_RETRIES with exponential backoff.
 * 3. If primary budget exhausted → switch to fallbackModel, retry up to MAX_RETRIES.
 * 4. If fallback also exhausted → throw with "Cuota agotada" message.
 * 5. Non-429 errors → propagate immediately (no retry).
 *
 * Each retry iteration is a clean scope — no leaked listeners or AbortControllers.
 */
export async function retryWithBackoff<T>(
  fn: (model: ModelId) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { model, emitStatus } = options
  const fallbackModel = options.fallbackModel ?? (MODEL_ROUTING.background as ModelId)

  // Phase 1: Primary model retries
  const primaryResult = await attemptWithRetries(fn, model, emitStatus, 'retrying')
  if (primaryResult.success) {
    emitStatus?.({ phase: 'resolved', attempt: primaryResult.attempt, maxAttempts: RATE_LIMIT_MAX_RETRIES, model })
    return primaryResult.value!
  }

  // Phase 2: Fallback model (skip if same model)
  if (fallbackModel !== model) {
    emitStatus?.({ phase: 'fallback', attempt: 0, maxAttempts: RATE_LIMIT_MAX_RETRIES, model: fallbackModel })

    const fallbackResult = await attemptWithRetries(fn, fallbackModel, emitStatus, 'fallback')
    if (fallbackResult.success) {
      emitStatus?.({ phase: 'resolved', attempt: fallbackResult.attempt, maxAttempts: RATE_LIMIT_MAX_RETRIES, model: fallbackModel })
      return fallbackResult.value!
    }
  }

  // Phase 3: Exhausted
  const exhaustedMsg = 'Cuota agotada. Cambia de cuenta o modelo.'
  emitStatus?.({ phase: 'exhausted', attempt: RATE_LIMIT_MAX_RETRIES, maxAttempts: RATE_LIMIT_MAX_RETRIES, model: fallbackModel, error: exhaustedMsg })
  throw new Error(exhaustedMsg)
}

interface AttemptResult<T> {
  success: boolean
  value?: T
  attempt: number
}

async function attemptWithRetries<T>(
  fn: (model: ModelId) => Promise<T>,
  model: ModelId,
  emitStatus: RateLimitEmitter | undefined,
  phase: RateLimitPhase,
): Promise<AttemptResult<T>> {
  // Attempt 0: initial try (no backoff)
  try {
    const value = await fn(model)
    return { success: true, value, attempt: 0 }
  } catch (error) {
    if (!is429(error)) throw error // Non-transient → propagate immediately
  }

  // Attempts 1..MAX_RETRIES: with backoff
  for (let attempt = 1; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    const delayMs = calculateBackoff(attempt - 1)

    emitStatus?.({
      phase,
      attempt,
      maxAttempts: RATE_LIMIT_MAX_RETRIES,
      model,
      delayMs,
    })

    console.log(`[KAIRO_RATE_LIMIT] ${phase}: attempt ${attempt}/${RATE_LIMIT_MAX_RETRIES}, model=${model}, delay=${delayMs}ms`)
    await sleep(delayMs)

    try {
      const value = await fn(model)
      return { success: true, value, attempt }
    } catch (error) {
      if (!is429(error)) throw error // Non-transient → propagate immediately
      // 429 continues to next retry
    }
  }

  return { success: false, attempt: RATE_LIMIT_MAX_RETRIES }
}
