/**
 * IPC Channel definitions — SINGLE SOURCE OF TRUTH
 * Rule: If a channel is not listed here, preload MUST reject it.
 * Rule: Add channels here ONLY through deliberate changes, never dynamically.
 */

export const IPC_CHANNELS = {
  // Chat domain
  CHAT_SEND_MESSAGE: 'chat:send-message',
  CHAT_ABORT: 'chat:abort',

  // Settings domain
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Token budget domain
  TOKEN_GET_BUDGET: 'token:get-budget',

  // Session domain
  SESSION_GET_STATE: 'session:get-state',
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
