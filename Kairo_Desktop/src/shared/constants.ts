import type { ModelId, TokenChannel } from './types'

// ─── Token Budgets (DEC-017, DEC-018, DEC-021) ──────────────

export const DEFAULT_BUDGET = 200_000

export const BUDGET_PRESETS = {
  conservative: 120_000,
  balanced: 200_000,
  extended: 300_000,
} as const

/** DEC-021: Channel allocation percentages (of total budget) */
export const CHANNEL_ALLOCATIONS: Record<TokenChannel, number> = {
  chat: 0.55,
  terminal: 0.15,
  diffs: 0.13,
  memory: 0.10,
  system: 0.02,
  buffer: 0.05,
}

// ─── Model Configuration (DEC-002, DEC-019) ─────────────────

export const DEFAULT_MODEL: ModelId = 'gemini-2.0-flash'

export const MODEL_DISPLAY_NAMES: Record<ModelId, string> = {
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
}

/** DEC-019: Pro for foreground, Flash for background */
export const MODEL_ROUTING: Record<string, ModelId> = {
  foreground: 'gemini-2.5-pro',
  background: 'gemini-2.0-flash',
}

export const MAX_TURNS_PER_SESSION = 40
export const SESSION_CUT_THRESHOLD_PERCENT = 0.80
