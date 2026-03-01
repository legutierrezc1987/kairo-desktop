/**
 * IPC Channel definitions — SINGLE SOURCE OF TRUTH
 * Rule: If a channel is not listed here, preload MUST reject it.
 * Rule: Add channels here ONLY through deliberate changes, never dynamically.
 */

export const IPC_CHANNELS = {
  // Chat domain
  CHAT_SEND_MESSAGE: 'chat:send-message',
  CHAT_ABORT: 'chat:abort',
  CHAT_STREAM_CHUNK: 'chat:stream-chunk',

  // Settings domain
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Token budget domain
  TOKEN_GET_BUDGET: 'token:get-budget',

  // Session domain
  SESSION_GET_STATE: 'session:get-state',

  // Terminal domain
  TERMINAL_SPAWN: 'terminal:spawn',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_KILL: 'terminal:kill',

  // Execution domain
  EXECUTION_CLASSIFY: 'execution:classify',

  // Broker domain
  BROKER_GET_MODE: 'broker:get-mode',
  BROKER_SET_MODE: 'broker:set-mode',
  BROKER_APPROVE: 'broker:approve',
  BROKER_REJECT: 'broker:reject',
  BROKER_GET_PENDING: 'broker:get-pending',
  BROKER_PENDING_ADDED: 'broker:pending-added',
  BROKER_PENDING_RESOLVED: 'broker:pending-resolved',

  // Kill switch domain
  KILLSWITCH_ACTIVATED: 'killswitch:activated',

  // Project domain
  PROJECT_CREATE: 'project:create',
  PROJECT_LIST: 'project:list',
  PROJECT_LOAD: 'project:load',

  // Account domain
  ACCOUNT_CREATE: 'account:create',
  ACCOUNT_LIST: 'account:list',
  ACCOUNT_SET_ACTIVE: 'account:set-active',
  ACCOUNT_DELETE: 'account:delete',
  ACCOUNT_PREFLIGHT_STATUS: 'account:preflight-status',
  ACCOUNT_PREFLIGHT_GET: 'account:preflight-get',

  // Session persistence domain
  SESSION_CREATE: 'session:create',
  SESSION_GET_ACTIVE: 'session:get-active',
  SESSION_ARCHIVE: 'session:archive',

  // Memory domain
  MEMORY_QUERY: 'memory:query',
  MEMORY_INDEX: 'memory:index',
  MEMORY_HEALTH: 'memory:health',
  MEMORY_PROVIDER_CHANGED: 'memory:provider-changed',

  // Cut pipeline domain (Phase 4 Sprint D)
  CUT_PIPELINE_STATE: 'cut:pipeline-state',

  // Recall strategy domain (Phase 5 Sprint A, DEC-026)
  RECALL_STATUS: 'recall:status',

  // Consolidation engine domain (Phase 5 Sprint B, DEC-022)
  CONSOLIDATION_STATUS: 'consolidation:status',

  // Rate-limit handler domain (Phase 5 Sprint C, PRD §14)
  RATE_LIMIT_STATUS: 'rate-limit:status',

  // File operations domain (Phase 6 Sprint A, PRD §6.1)
  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  // File explorer domain (Phase 6 Sprint B, PRD §6.2)
  FS_LIST_DIR: 'fs:list-dir',
  // Undo domain (Phase 6 Sprint D, DEC-017)
  FS_UNDO_PREVIEW: 'fs:undo-preview',
  FS_UNDO_APPLY: 'fs:undo-apply',

  // App domain
  APP_GET_CWD: 'app:get-cwd',
  APP_SELECT_FOLDER: 'app:select-folder',
} as const

/** Type representing any valid IPC channel value */
export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

/** Frozen allowlist array for preload validation */
export const IPC_CHANNEL_ALLOWLIST: readonly string[] = Object.freeze(
  Object.values(IPC_CHANNELS)
)

/** Runtime channel validation */
export function isAllowedChannel(channel: string): channel is IpcChannel {
  return IPC_CHANNEL_ALLOWLIST.includes(channel)
}
