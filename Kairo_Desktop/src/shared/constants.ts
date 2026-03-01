import type { ModelId, TokenChannel } from './types'

// ─── Token Budgets (DEC-017, DEC-018, DEC-021) ──────────────

export const DEFAULT_BUDGET = 200_000

export const BUDGET_PRESETS = {
  conservative: 120_000,
  balanced: 200_000,
  extended: 300_000,
} as const

/** Minimum custom budget (tokens) */
export const CUSTOM_BUDGET_MIN = 50_000

/** Maximum custom budget (tokens) */
export const CUSTOM_BUDGET_MAX = 1_000_000

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

/** Pragmatic default for broad key compatibility and lower quota friction. */
export const DEFAULT_MODEL: ModelId = 'gemini-2.5-flash'

export const MODEL_DISPLAY_NAMES: Record<ModelId, string> = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-3-flash-preview': 'Gemini 3 Flash',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro (High)',
  'gemini-3.1-pro-preview-customtools': 'Gemini 3.1 Pro (Low)',
}

/** Foreground defaults to 2.5 Flash; background fallback uses 3 Flash preview. */
export const MODEL_ROUTING: Record<string, ModelId> = {
  foreground: 'gemini-2.5-flash',
  background: 'gemini-3-flash-preview',
}

// ─── Legacy Model Normalization (Patch K) ───────────────────

const LEGACY_MODEL_MAP: Record<string, ModelId> = {
  'gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini-2.0-flash-lite': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-3.1-pro-preview',
}

const VALID_MODEL_IDS: ReadonlySet<string> = new Set(
  Object.keys(MODEL_DISPLAY_NAMES),
)

/** Normalize a model ID from DB/settings to a current valid ModelId. */
export function normalizeModelId(raw: string): ModelId {
  if (VALID_MODEL_IDS.has(raw)) return raw as ModelId
  return LEGACY_MODEL_MAP[raw] ?? DEFAULT_MODEL
}

export const MAX_TURNS_PER_SESSION = 40
export const SESSION_CUT_THRESHOLD_PERCENT = 0.80

// ─── Broker Configuration (DEC-024) ─────────────────────────

import type { BrokerMode } from './types'

export const DEFAULT_BROKER_MODE: BrokerMode = 'supervised'
export const PENDING_COMMAND_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ─── Kill Switch Configuration (DEC-025) ────────────────────

export const KILL_SWITCH_ACCELERATOR = 'Ctrl+Shift+K'
export const KILL_SWITCH_BANNER_DURATION_MS = 4000

// ─── MCP Process Configuration (DEC-020) ────────────────────

export const MCP_SPAWN_TIMEOUT_MS = 15_000
export const MCP_HEALTH_CHECK_TIMEOUT_MS = 5_000
export const MCP_MAX_RESTART_ATTEMPTS = 3
export const MCP_RESTART_BACKOFF_BASE_MS = 2_000
export const MCP_JSONRPC_VERSION = '2.0' as const

/** Maximum allowed size for MCP stdout input buffer (bytes). Prevents unbounded growth from hostile/broken servers. */
export const MCP_STDOUT_BUFFER_MAX_BYTES = 1_048_576 // 1 MB

// ─── Memory Provider Configuration ─────────────────────────

export const MEMORY_QUERY_MAX_RESULTS_DEFAULT = 5
export const MEMORY_SETTINGS_KEY_MCP_PATH = 'mcp_server_path'
export const MEMORY_SETTINGS_KEY_PROVIDER = 'memory_provider'

// ─── Memory Hardening Limits (Phase 4 Sprint A Hardening) ──

/** Maximum allowed length for a memory query string (characters) */
export const MEMORY_QUERY_MAX_LENGTH = 2_000

/** Minimum allowed value for maxResults parameter */
export const MEMORY_MAX_RESULTS_MIN = 1

/** Maximum allowed value for maxResults parameter */
export const MEMORY_MAX_RESULTS_MAX = 50

// ─── Cut Pipeline Configuration (Phase 4 Sprint D) ─────────

/** Target token count for bridge buffer preserved across session cuts (PRD §5.3 Step 8) */
export const BRIDGE_BUFFER_TOKEN_TARGET = 10_000

/** Timeout for overall cut pipeline when triggered by kill switch / before-quit (ms) */
export const CUT_PIPELINE_TIMEOUT_MS = 30_000

/** Timeout per single upload attempt via MemoryProvider.index() (ms) */
export const UPLOAD_TIMEOUT_MS = 60_000

/** Maximum upload retry attempts before escalating to MANUAL_INTERVENTION */
export const UPLOAD_MAX_RETRIES = 10

/** Base delay for upload retry exponential backoff (ms) — 5 minutes */
export const UPLOAD_RETRY_BASE_MS = 300_000

/** Timeout for snapshot generation via LLM (ms) */
export const SNAPSHOT_GENERATION_TIMEOUT_MS = 15_000

/** Interval for SyncWorker tick cycle (ms) — 2 minutes */
export const SYNC_WORKER_INTERVAL_MS = 120_000

// ─── Recall Strategy Configuration (Phase 5 Sprint A, DEC-026) ──

/** Maximum tokens for recall injection (DEC-021: memory channel = 10% of budget) */
export const RECALL_BUDGET_TOKENS = 20_000

/** Number of turns between periodic recall triggers (DEC-026 trigger #4) */
export const RECALL_PERIODIC_INTERVAL = 8

/** Timeout for a single recall query (ms) */
export const RECALL_QUERY_TIMEOUT_MS = 10_000

// ─── Consolidation Engine Configuration (Phase 5 Sprint B, DEC-022) ──

/** Number of SYNCED sources that triggers consolidation ("40-1 Rule") */
export const CONSOLIDATION_SOURCE_THRESHOLD = 40

/** Number of oldest SYNCED sources to merge into Master Summary */
export const CONSOLIDATION_MERGE_COUNT = 20

/** Maximum characters for merged consolidation input (~20K tokens at 4 chars/token) */
export const CONSOLIDATION_INPUT_CAP_CHARS = 80_000

/** Timeout for consolidation LLM generation (ms) */
export const CONSOLIDATION_TIMEOUT_MS = 60_000

// ─── Rate-Limit Handler Configuration (Phase 5 Sprint C, PRD §14) ──

/** Maximum retry attempts before fallback (PRD §14: 3 retries) */
export const RATE_LIMIT_MAX_RETRIES = 3

/** Base delay for exponential backoff (ms) — first retry waits ~1s */
export const RATE_LIMIT_BACKOFF_BASE_MS = 1_000

/** Multiplier for exponential backoff — 1s, 2s, 4s */
export const RATE_LIMIT_BACKOFF_MULTIPLIER = 2

/** Maximum backoff delay cap (ms) — PRD §14: max 60s */
export const RATE_LIMIT_BACKOFF_MAX_MS = 60_000

/** Jitter factor: ±25% randomization on each delay */
export const RATE_LIMIT_JITTER_FACTOR = 0.25

// ─── File Operations Configuration (Phase 6 Sprint A, PRD §6.1) ──

/** Maximum file size allowed for read operations (bytes) — 5 MB */
export const FS_READ_FILE_MAX_BYTES = 5_242_880

/** Number of initial bytes to scan for binary (null byte) detection */
export const FS_BINARY_DETECTION_BYTES = 8_192

// ─── Undo Manager Configuration (Phase 6 Sprint D, DEC-017) ──

/** Maximum entries in the ephemeral LIFO undo stack (per-session, not persisted) */
export const UNDO_STACK_MAX_ENTRIES = 15

/** Maximum file size (bytes) for which a pre-write snapshot is captured */
export const UNDO_MAX_FILE_BYTES = 2_097_152 // 2 MB

// ─── File Explorer Configuration (Phase 6 Sprint B, PRD §6.2) ──

/** Maximum directory traversal depth for listDir (default 1 for lazy-load) */
export const FS_LIST_DIR_MAX_DEPTH = 5

/** Maximum total entries returned by a single listDir call */
export const FS_LIST_DIR_MAX_ENTRIES = 5_000

/** Directory names excluded from listing by default */
export const FS_LIST_DIR_EXCLUDED: readonly string[] = Object.freeze([
  '.git',
  'node_modules',
  '__pycache__',
  '.kairo',
  '.venv',
  'venv',
  '.next',
  'dist',
  '.cache',
])
