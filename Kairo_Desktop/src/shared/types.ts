// ─── Chat Domain ─────────────────────────────────────────────

export type ChatRole = 'user' | 'model' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
  model?: ModelId
  tokenCount?: number
}

export interface SendMessageRequest {
  content: string
  model?: ModelId
}

export interface SendMessageResponse {
  message: ChatMessage
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
}

// ─── Model Domain ────────────────────────────────────────────

export type ModelId = 'gemini-2.5-pro' | 'gemini-2.0-flash' | 'gemini-2.0-flash-lite'

export type RoutingContext = 'foreground' | 'background'

// ─── Token Budget Domain ─────────────────────────────────────

export type TokenChannel = 'chat' | 'terminal' | 'diffs' | 'memory' | 'system' | 'buffer'

export interface ChannelBudget {
  channel: TokenChannel
  allocated: number
  used: number
  percentage: number
}

export interface TokenBudgetState {
  totalBudget: number
  totalUsed: number
  channels: Record<TokenChannel, ChannelBudget>
}

// ─── Settings Domain ─────────────────────────────────────────

export interface SettingsState {
  selectedModel: ModelId
  budgetPreset: 'conservative' | 'balanced' | 'extended' | 'custom'
  customBudget?: number
}

// ─── Session Domain ──────────────────────────────────────────

export interface SessionState {
  sessionId: string
  turnCount: number
  totalTokens: number
  startedAt: number
}

// ─── IPC Envelope ────────────────────────────────────────────

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}
