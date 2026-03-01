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

/** Streaming chunk pushed from main→renderer via CHAT_STREAM_CHUNK (Phase 4 Sprint C) */
export interface StreamChunk {
  messageId: string
  delta: string
  done: boolean
  tokenCount?: number
  error?: string
}

/** Abort response from CHAT_ABORT handler */
export interface ChatAbortResponse {
  aborted: boolean
  reason?: string
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

export interface SessionArchiveRequest { reason: CutReason }
export interface SessionArchiveResponse { archived: boolean }

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

// ─── Memory Domain ─────────────────────────────────────────

export type MemoryProviderType = 'mcp' | 'local-markdown'
export type MemoryProviderStatus = 'ready' | 'starting' | 'degraded' | 'failed' | 'stopped'
export type McpProcessState = 'stopped' | 'starting' | 'running' | 'crashed' | 'failed'

export interface MemoryResult {
  content: string
  source: string
  relevance: number
  timestamp: number
}

export interface IndexResult {
  indexed: boolean
  filePath: string
  chunksIndexed: number
  error?: string
}

export interface ProviderHealth {
  provider: MemoryProviderType
  status: MemoryProviderStatus
  lastCheckAt: number
  error?: string
}

export interface MemoryQueryRequest {
  query: string
  maxResults?: number
}

export interface MemoryQueryResponse {
  results: MemoryResult[]
  provider: MemoryProviderType
}

export interface MemoryIndexRequest {
  filePath: string
}

export interface MemoryIndexResponse {
  result: IndexResult
  provider: MemoryProviderType
}

export interface MemoryHealthResponse {
  health: ProviderHealth
  activeProvider: MemoryProviderType
  fallbackAvailable: boolean
}

export interface MemoryProviderChangedNotification {
  previousProvider: MemoryProviderType
  currentProvider: MemoryProviderType
  reason: string
  timestamp: number
}

// ─── Cut Pipeline Domain (Phase 4 Sprint D) ──────────────

export type CutPipelinePhase =
  | 'blocking'
  | 'counting'
  | 'generating'
  | 'saving'
  | 'uploading'
  | 'recalling'
  | 'ready'
  | 'error'

export interface CutPipelineEvent {
  phase: CutPipelinePhase
  sessionNumber?: number
  error?: string
}

/** Context preserved across session cuts (PRD §5.3 Step 8) */
export interface BridgeBuffer {
  /** Last ~10K tokens of chat history (Content[] serialized) */
  messages: Array<{ role: string; text: string }>
  lastUserTurn: string
  tokenEstimate: number
  sourceSessionNumber: number
}

export type UploadQueueStatus = 'pending' | 'uploading' | 'synced' | 'failed' | 'manual' | 'consolidated'
export type UploadFileType = 'transcript' | 'summary' | 'master_summary'

// ─── Recall Strategy Domain (Phase 5 Sprint A, DEC-026) ────

export type RecallTrigger =
  | 'session_start'
  | 'task_change'
  | 'critical_action'
  | 'periodic'
  | 'contradiction'
  | 'manual'

export type RecallStatusPhase = 'querying' | 'injecting' | 'done' | 'skipped' | 'error'

export interface RecallStatusEvent {
  phase: RecallStatusPhase
  trigger: RecallTrigger
  error?: string
}

// ─── Consolidation Engine Domain (Phase 5 Sprint B, DEC-022) ──

export type ConsolidationPhase =
  | 'claiming'
  | 'merging'
  | 'uploading'
  | 'deleting'
  | 'done'
  | 'skipped'
  | 'error'

export interface ConsolidationStatusEvent {
  phase: ConsolidationPhase
  mergedCount?: number
  error?: string
}

export interface DeleteSourceResult {
  deleted: boolean
  sourceId: string
  error?: string
}

// ─── Rate-Limit Handler Domain (Phase 5 Sprint C, PRD §14) ──

export type RateLimitPhase = 'retrying' | 'fallback' | 'resolved' | 'exhausted'

export interface RateLimitStatus {
  phase: RateLimitPhase
  attempt: number
  maxAttempts: number
  model: string
  delayMs?: number
  error?: string
}

// ─── File Operations Domain (Phase 6 Sprint A, PRD §6.1) ──

export interface FsReadFileRequest {
  filePath: string
}

export interface FsReadFileResponse {
  content: string
  filePath: string
  sizeBytes: number
  languageId: string
}

export interface FsWriteFileRequest {
  filePath: string
  content: string
}

export interface FsWriteFileResponse {
  filePath: string
  bytesWritten: number
}

// ─── App Domain ────────────────────────────────────────────

export interface SelectFolderResponse {
  folderPath: string | null
}
