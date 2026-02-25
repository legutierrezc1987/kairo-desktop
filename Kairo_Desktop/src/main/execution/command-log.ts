import { randomUUID } from 'node:crypto'
import type { CommandLogEntry, CommandZone, CommandAction, BrokerMode, ApprovalActor } from '../../shared/types'

/**
 * In-memory command audit log — DEC-024.
 * Phase 3 replaces with SQLite persistence to COMMAND_LOG table.
 */
export class CommandLog {
  private entries: CommandLogEntry[] = []

  log(
    terminalId: string,
    command: string,
    zone: CommandZone,
    action: CommandAction,
    reason: string,
    mode: BrokerMode,
    actor: ApprovalActor
  ): CommandLogEntry {
    const entry: CommandLogEntry = {
      id: randomUUID(),
      terminalId,
      command,
      zone,
      action,
      reason,
      timestamp: Date.now(),
      mode,
      actor,
    }
    this.entries.push(entry)

    // Structured console audit trail
    console.log(
      `[KAIRO_AUDIT] ${entry.zone.toUpperCase()} | ${entry.action} | ${entry.mode} | ${entry.actor} | ${entry.command} | ${entry.reason}`
    )

    return entry
  }

  getEntries(): readonly CommandLogEntry[] {
    return this.entries
  }

  getEntriesByTerminal(terminalId: string): CommandLogEntry[] {
    return this.entries.filter((e) => e.terminalId === terminalId)
  }

  clear(): void {
    this.entries = []
  }
}
