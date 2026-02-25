import { randomUUID } from 'node:crypto'
import { PENDING_COMMAND_TTL_MS } from '../../shared/constants'
import type {
  PendingCommand,
  ClassificationResult,
  ApprovalActor,
} from '../../shared/types'

/**
 * In-memory pending command queue — DEC-024.
 * Manages YELLOW commands awaiting user approval in supervised mode.
 *
 * SECURITY:
 * - Double-submit prevention: resolve() checks status !== 'pending'
 * - TTL expiration: commands auto-expire after PENDING_COMMAND_TTL_MS
 * - Sweep timer cleans expired commands every 30s
 */
export class PendingQueue {
  private commands: Map<string, PendingCommand> = new Map()
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.cleanupTimer = setInterval(() => this.sweepAndGetExpired(), 30_000)
  }

  add(
    terminalId: string,
    command: string,
    classification: ClassificationResult
  ): PendingCommand {
    const now = Date.now()
    const entry: PendingCommand = {
      id: randomUUID(),
      terminalId,
      command,
      classification,
      createdAt: now,
      expiresAt: now + PENDING_COMMAND_TTL_MS,
      status: 'pending',
    }
    this.commands.set(entry.id, entry)
    return entry
  }

  get(commandId: string): PendingCommand | undefined {
    return this.commands.get(commandId)
  }

  /**
   * Resolve a pending command.
   * SECURITY: Returns null if command not found, already resolved, or expired.
   * This prevents double-submit attacks.
   */
  resolve(
    commandId: string,
    decision: 'approved' | 'rejected',
    actor: ApprovalActor
  ): PendingCommand | null {
    const cmd = this.commands.get(commandId)
    if (!cmd) return null

    // Double-submit prevention
    if (cmd.status !== 'pending') return null

    // TTL check at resolution time
    if (Date.now() > cmd.expiresAt) {
      cmd.status = 'expired'
      cmd.resolvedAt = Date.now()
      cmd.resolvedBy = 'system'
      return null
    }

    cmd.status = decision
    cmd.resolvedAt = Date.now()
    cmd.resolvedBy = actor
    return cmd
  }

  /**
   * Get all pending commands, lazily expiring stale ones.
   */
  getPending(): PendingCommand[] {
    const now = Date.now()
    const result: PendingCommand[] = []
    for (const cmd of this.commands.values()) {
      if (cmd.status === 'pending') {
        if (now > cmd.expiresAt) {
          cmd.status = 'expired'
          cmd.resolvedAt = now
          cmd.resolvedBy = 'system'
        } else {
          result.push(cmd)
        }
      }
    }
    return result
  }

  /**
   * Sweep expired commands and return them for push notifications.
   */
  sweepAndGetExpired(): PendingCommand[] {
    const now = Date.now()
    const expired: PendingCommand[] = []
    for (const cmd of this.commands.values()) {
      if (cmd.status === 'pending' && now > cmd.expiresAt) {
        cmd.status = 'expired'
        cmd.resolvedAt = now
        cmd.resolvedBy = 'system'
        expired.push(cmd)
      }
    }
    return expired
  }

  /**
   * Soft reset — clears all pending commands but keeps the sweep timer alive.
   * Used by kill switch: broker remains operational after emergency stop.
   */
  reset(): void {
    this.commands.clear()
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.commands.clear()
  }
}
