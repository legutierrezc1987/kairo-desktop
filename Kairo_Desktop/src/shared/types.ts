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

// ─── Kill Switch Domain ─────────────────────────────────────

export interface KillSwitchNotification {
  timestamp: number
  killedCount: number
}

// ─── IPC Envelope ────────────────────────────────────────────

export interface IpcResult<T> {
  success: boolean
  data?: T
  error?: string
}

// ─── Project Domain ─────────────────────────────────────────

export type AgentMode = 'supervised' | 'auto'

export interface Project {
  id: string
  name: string
  folderPath: string
  notebookId: string | null
  notebookUrl: string | null
  model: string
  tokenThresholdSoft: number
  tokenThresholdHard: number
  turnLimit: number
  agentMode: AgentMode
  createdAt: string
  updatedAt: string
}

export interface CreateProjectRequest {
  name: string
  folderPath: string
}

export interface CreateProjectResponse {
  project: Project
}

export interface LoadProjectRequest {
  projectId: string
}

export interface LoadProjectResponse {
  project: Project
}

export interface ListProjectsResponse {
  projects: Project[]
}

// ─── Account Domain ────────────────────────────────────────

export type AccountTier = 'free' | 'tier1' | 'tier2'

export interface Account {
  id: string
  label: string
  isActive: boolean
  tier: AccountTier
  createdAt: string
}

export interface CreateAccountRequest {
  label: string
  apiKey: string
  tier?: AccountTier
}

export interface CreateAccountResponse { account: Account }
export interface ListAccountsResponse { accounts: Account[] }
export interface SetActiveAccountRequest { accountId: string }
export interface SetActiveAccountResponse { account: Account }
export interface DeleteAccountRequest { accountId: string }

// ─── Session Persistence Domain ────────────────────────────

export type SessionStatus = 'active' | 'archived' | 'failed'
export type CutReason = 'tokens' | 'turns' | 'manual' | 'emergency'

export interface SessionRecord {
  id: string
  projectId: string
  sessionNumber: number
  totalTokens: number
  interactionCount: number
  cutReason: CutReason | null
  status: SessionStatus
  startedAt: string
  endedAt: string | null
}

export interface CreateSessionRequest { projectId: string }
export interface CreateSessionResponse { session: SessionRecord }
export interface GetActiveSessionRequest { projectId: string }
export interface GetActiveSessionResponse { session: SessionRecord | null }
export interface UpdateSessionTokensRequest {
  sessionId: string
  tokensToAdd: number
}

// ─── Settings Persistence Domain ───────────────────────────

export interface SettingEntry {
  key: string
  value: string
  description: string | null
}

export interface SetSettingRequest {
  key: string
  value: string
  description?: string
}

export interface GetSettingRequest { key: string }
export interface GetSettingResponse { value: string | null }
export interface GetAllSettingsResponse { settings: SettingEntry[] }
