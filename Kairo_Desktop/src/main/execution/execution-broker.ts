import { classifyCommand } from './command-classifier'
import { CommandLog } from './command-log'
import { PendingQueue } from './pending-queue'
import { validateCommandPaths } from './workspace-sandbox'
import { DEFAULT_BROKER_MODE } from '../../shared/constants'
import type {
  ClassificationResult,
  CommandAction,
  BrokerMode,
  PendingCommand,
} from '../../shared/types'

export interface BrokerDecision {
  allowed: boolean
  classification: ClassificationResult
  action: CommandAction
  reason: string
  commandId?: string
}

export interface ApprovalResult {
  allowed: boolean
  commandId: string
  decision: 'approved' | 'rejected' | 'expired' | 'not_found' | 'already_resolved' | 'reclassified_red'
  reason: string
  terminalId?: string
  command?: string
}

/**
 * Execution Broker — DEC-024.
 * Orchestrates classification, mode-aware execution, approval flow, and audit logging.
 *
 * Sprint B behavior:
 * - GREEN: always execute (both modes)
 * - YELLOW auto: execute (re-classify implicit — just classified)
 * - YELLOW supervised: queue pending_approval with UI Approve/Reject
 * - RED: ALWAYS blocked (both modes, even on manual approve) — INNEGOCIABLE
 */
export class ExecutionBroker {
  private commandLog: CommandLog
  private pendingQueue: PendingQueue
  private mode: BrokerMode

  private onApprovedExecution: ((terminalId: string, command: string) => void) | null = null
  private onPendingAdded: ((pending: PendingCommand) => void) | null = null
  private onPendingResolved: ((id: string, decision: string, reason: string) => void) | null = null

  constructor() {
    this.commandLog = new CommandLog()
    this.pendingQueue = new PendingQueue()
    this.mode = DEFAULT_BROKER_MODE
  }

  // ── Callback setters (injected by TerminalService / IPC handlers) ──

  setOnApprovedExecution(cb: (terminalId: string, command: string) => void): void {
    this.onApprovedExecution = cb
  }

  setOnPendingAdded(cb: (pending: PendingCommand) => void): void {
    this.onPendingAdded = cb
  }

  setOnPendingResolved(cb: (id: string, decision: string, reason: string) => void): void {
    this.onPendingResolved = cb
  }

  // ── Mode management ──

  getMode(): BrokerMode {
    return this.mode
  }

  setMode(mode: BrokerMode): void {
    this.mode = mode
    console.log(`[KAIRO_BROKER] Mode changed to: ${mode}`)
  }

  // ── Core evaluation (called by TerminalService on Enter) ──

  evaluate(command: string, terminalId: string, workspacePath?: string): BrokerDecision {
    const classification = classifyCommand(command)

    let allowed: boolean
    let action: CommandAction
    let reason: string
    let commandId: string | undefined

    switch (classification.zone) {
      case 'green':
        allowed = true
        action = 'executed'
        reason = 'GREEN zone — allowed'
        break

      case 'yellow': {
        // SECURITY: Validate command paths against workspace boundary (DEC-025)
        if (workspacePath) {
          const pathCheck = validateCommandPaths(command, workspacePath)
          if (!pathCheck.valid) {
            allowed = false
            action = 'blocked'
            reason = `DEC-025 sandbox: ${pathCheck.reason}`
            break
          }
        }

        if (this.mode === 'auto') {
          allowed = true
          action = 'executed'
          reason = `YELLOW zone — auto-executed (auto mode). ${classification.reason}`
        } else {
          // Supervised mode: queue for approval
          allowed = false
          action = 'pending_approval'
          const pending = this.pendingQueue.add(terminalId, command, classification)
          commandId = pending.id
          reason = `YELLOW zone — pending approval (supervised mode). ${classification.reason}`
          this.onPendingAdded?.(pending)
        }
        break
      }

      case 'red':
        // RED: ALWAYS blocked, in BOTH modes, no exceptions — DEC-024
        allowed = false
        action = 'blocked'
        reason = classification.reason
        break
    }

    this.commandLog.log(terminalId, command, classification.zone, action, reason, this.mode, 'system')

    return { allowed, classification, action, reason, commandId }
  }

  // ── Approval flow ──

  /**
   * Approve a pending command.
   * SECURITY: Re-classifies at approval time. If reclassified as RED, blocks unconditionally.
   * SECURITY: Double-submit prevention via PendingQueue.resolve() status check.
   */
  approve(commandId: string): ApprovalResult {
    const pending = this.pendingQueue.get(commandId)
    if (!pending) {
      return { allowed: false, commandId, decision: 'not_found', reason: 'Command ID not found in pending queue' }
    }
    if (pending.status !== 'pending') {
      return { allowed: false, commandId, decision: 'already_resolved', reason: `Command already ${pending.status}` }
    }

    // SECURITY: Re-classify at approval time (prevent stale approval attack)
    const freshClassification = classifyCommand(pending.command)

    if (freshClassification.zone === 'red') {
      // Reclassified as RED — reject even if user approved (hard block)
      this.pendingQueue.resolve(commandId, 'rejected', 'system')
      this.commandLog.log(
        pending.terminalId, pending.command, 'red', 'blocked',
        `Reclassified as RED at approval time — blocked. Original zone: ${pending.classification.zone}`,
        this.mode, 'system'
      )
      this.onPendingResolved?.(commandId, 'rejected', 'Reclassified as RED — blocked')
      return {
        allowed: false, commandId, decision: 'reclassified_red',
        reason: 'Command reclassified as RED at approval time — blocked regardless of approval',
        terminalId: pending.terminalId, command: pending.command,
      }
    }

    // Resolve in queue
    const resolved = this.pendingQueue.resolve(commandId, 'approved', 'user')
    if (!resolved) {
      // Expired between get() and resolve()
      return { allowed: false, commandId, decision: 'expired', reason: 'Command expired during approval' }
    }

    // Log and execute
    this.commandLog.log(
      pending.terminalId, pending.command, freshClassification.zone, 'approved',
      `Approved by user. Current zone: ${freshClassification.zone}`,
      this.mode, 'user'
    )

    // Execute via callback (writes command to PTY)
    this.onApprovedExecution?.(pending.terminalId, pending.command)
    this.onPendingResolved?.(commandId, 'approved', 'User approved')

    return {
      allowed: true, commandId, decision: 'approved',
      reason: 'User approved, re-classification confirmed safe',
      terminalId: pending.terminalId, command: pending.command,
    }
  }

  /**
   * Reject a pending command.
   * SECURITY: Double-submit prevention via PendingQueue.resolve() status check.
   */
  reject(commandId: string): ApprovalResult {
    const pending = this.pendingQueue.get(commandId)
    if (!pending) {
      return { allowed: false, commandId, decision: 'not_found', reason: 'Command ID not found' }
    }
    if (pending.status !== 'pending') {
      return { allowed: false, commandId, decision: 'already_resolved', reason: `Command already ${pending.status}` }
    }

    const resolved = this.pendingQueue.resolve(commandId, 'rejected', 'user')
    if (!resolved) {
      return { allowed: false, commandId, decision: 'expired', reason: 'Command expired' }
    }

    this.commandLog.log(
      pending.terminalId, pending.command, pending.classification.zone, 'rejected',
      'Rejected by user',
      this.mode, 'user'
    )

    this.onPendingResolved?.(commandId, 'rejected', 'User rejected')

    return {
      allowed: false, commandId, decision: 'rejected',
      reason: 'User rejected command',
      terminalId: pending.terminalId, command: pending.command,
    }
  }

  getPendingCommands(): PendingCommand[] {
    return this.pendingQueue.getPending()
  }

  getLog(): CommandLog {
    return this.commandLog
  }

  /**
   * Emergency reset — kill switch handler.
   * Clears pending queue but keeps broker operational (sweep timer alive).
   */
  emergencyReset(): void {
    this.pendingQueue.reset()
    this.commandLog.log(
      'SYSTEM', 'KILL_SWITCH', 'red', 'blocked',
      'Emergency kill switch activated — all pending commands cleared',
      this.mode, 'system'
    )
  }

  destroy(): void {
    this.pendingQueue.destroy()
  }
}
