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

// ─── Terminal Domain ─────────────────────────────────────────

export interface TerminalSpawnRequest {
  cwd: string
  shell?: string
  cols?: number
  rows?: number
}

export interface TerminalSpawnResponse {
  terminalId: string
}

export interface TerminalInputRequest {
  terminalId: string
  data: string
}

export interface TerminalResizeRequest {
  terminalId: string
  cols: number
  rows: number
}

// ─── Execution Broker Domain ─────────────────────────────────

export type CommandZone = 'green' | 'yellow' | 'red'

export interface ClassificationResult {
  command: string
  zone: CommandZone
  reason: string
  matchedPattern: string | null
  timestamp: number
}

export type CommandAction = 'executed' | 'blocked' | 'pending_approval' | 'approved' | 'rejected' | 'expired'

export type BrokerMode = 'auto' | 'supervised'

export type ApprovalActor = 'system' | 'user'

export type PendingStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface PendingCommand {
  id: string
  terminalId: string
  command: string
  classification: ClassificationResult
  createdAt: number
  expiresAt: number
  status: PendingStatus
  resolvedAt?: number
  resolvedBy?: ApprovalActor
}

export interface ApprovalRequest {
  commandId: string
}

export interface ApprovalResponse {
  commandId: string
  decision: 'approved' | 'rejected' | 'expired' | 'not_found' | 'already_resolved' | 'reclassified_red'
  reason: string
  allowed: boolean
}

export interface PendingCommandNotification {
  id: string
  terminalId: string
  command: string
  zone: CommandZone
  reason: string
  expiresAt: number
}

export interface PendingResolvedNotification {
  id: string
  decision: 'approved' | 'rejected' | 'expired'
  reason: string
}

export interface BrokerModeResponse {
  mode: BrokerMode
}

export interface CommandLogEntry {
  id: string
  terminalId: string
  command: string
  zone: CommandZone
  action: CommandAction
  reason: string
  timestamp: number
  mode: BrokerMode
  actor: ApprovalActor
}

// ─── IPC Envelope ────────────────────────────────────────────

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}
