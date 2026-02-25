import * as pty from 'node-pty'
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { ExecutionBroker } from '../execution/execution-broker'
import { validateWorkspaceCwd } from '../execution/workspace-sandbox'
import { ALLOWED_SHELLS } from '../config/command-zones'
import type {
  TerminalSpawnRequest,
  TerminalSpawnResponse,
  IpcResult,
} from '../../shared/types'

interface TerminalInstance {
  id: string
  process: pty.IPty
  cwd: string
}

/**
 * Manages PTY processes in the main process.
 * SECURITY: node-pty runs ONLY in main process (sandbox:true in renderer).
 * SECURITY: spawn() validates CWD against workspace (DEC-025).
 */
export class TerminalService {
  private terminals: Map<string, TerminalInstance> = new Map()
  private lineBuffers: Map<string, string> = new Map()
  private broker: ExecutionBroker
  private workspacePath: string
  private onData: ((terminalId: string, data: string) => void) | null = null
  private onExit: ((terminalId: string, exitCode: number) => void) | null = null

  constructor(broker: ExecutionBroker, workspacePath: string) {
    this.broker = broker
    this.workspacePath = workspacePath

    // Inject callback so broker can write approved commands to PTY
    this.broker.setOnApprovedExecution((terminalId: string, command: string) => {
      this.executeApproved(terminalId, command)
    })
  }

  setOnData(callback: (terminalId: string, data: string) => void): void {
    this.onData = callback
  }

  setOnExit(callback: (terminalId: string, exitCode: number) => void): void {
    this.onExit = callback
  }

  spawn(request: TerminalSpawnRequest): IpcResult<TerminalSpawnResponse> {
    // SECURITY: Validate CWD is inside workspace (DEC-025)
    const cwdCheck = validateWorkspaceCwd(request.cwd, this.workspacePath)
    if (!cwdCheck.valid) {
      console.error(`[KAIRO_SECURITY] Terminal spawn rejected: ${cwdCheck.reason}`)
      return { success: false, error: `[KAIRO_SECURITY] ${cwdCheck.reason}` }
    }

    // SECURITY: Validate shell binary against allowlist (DEC-025)
    const shellPath = request.shell ?? this.getDefaultShell()
    const shellName = basename(shellPath).toLowerCase()
    if (!ALLOWED_SHELLS.includes(shellName)) {
      console.error(`[KAIRO_SECURITY] Shell "${shellPath}" not in allowlist.`)
      return { success: false, error: `[KAIRO_SECURITY] Shell "${shellName}" is not allowed.` }
    }

    const terminalId = randomUUID()
    const shell = shellPath
    const cols = request.cols ?? 80
    const rows = request.rows ?? 24

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: request.cwd,
        env: process.env as Record<string, string>,
      })

      const instance: TerminalInstance = {
        id: terminalId,
        process: ptyProcess,
        cwd: request.cwd,
      }

      ptyProcess.onData((data: string) => {
        this.onData?.(terminalId, data)
      })

      ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
        this.onExit?.(terminalId, exitCode)
        this.terminals.delete(terminalId)
        this.lineBuffers.delete(terminalId)
      })

      this.terminals.set(terminalId, instance)
      this.lineBuffers.set(terminalId, '')

      return { success: true, data: { terminalId } }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to spawn terminal'
      return { success: false, error: msg }
    }
  }

  /**
   * Write user input to pty with broker interception.
   * When data contains a newline (Enter), the accumulated line buffer
   * is classified. RED commands are blocked; GREEN/YELLOW pass through.
   */
  write(terminalId: string, data: string): IpcResult<void> {
    const instance = this.terminals.get(terminalId)
    if (!instance) {
      return { success: false, error: `Terminal ${terminalId} not found.` }
    }

    // Detect Enter key (CR or LF)
    if (data.includes('\r') || data.includes('\n')) {
      const currentBuffer = this.lineBuffers.get(terminalId) ?? ''
      const command = (currentBuffer + data.replace(/[\r\n]/g, '')).trim()
      this.lineBuffers.set(terminalId, '')

      if (command.length > 0) {
        const decision = this.broker.evaluate(command, terminalId, this.workspacePath)
        if (!decision.allowed) {
          if (decision.action === 'pending_approval') {
            // Supervised mode: command queued for approval
            const pendingMsg = `\r\n\x1b[33m[KAIRO] Queued for approval: ${command}\x1b[0m\r\n`
            this.onData?.(terminalId, pendingMsg)
          } else {
            // RED or deny-by-default: blocked
            const errorMsg = `\r\n\x1b[31m[KAIRO] BLOCKED: ${decision.reason}\x1b[0m\r\n`
            this.onData?.(terminalId, errorMsg)
          }
          // SECURITY: Send Ctrl+C to abort the current line in the shell.
          // NEVER send '\r' (Enter) — it would execute whatever the shell has buffered.
          instance.process.write('\x03')
          return { success: true }
        }
      }

      // Allowed or empty — pass through to pty
      instance.process.write(data)
    } else {
      // Not a newline — accumulate in buffer and pass through for echo
      const current = this.lineBuffers.get(terminalId) ?? ''
      this.lineBuffers.set(terminalId, current + data)
      instance.process.write(data)
    }

    return { success: true }
  }

  /**
   * Execute an approved command by writing it to the PTY.
   * Called by broker's onApprovedExecution callback after user approves.
   */
  executeApproved(terminalId: string, command: string): void {
    const instance = this.terminals.get(terminalId)
    if (!instance) {
      console.error(`[KAIRO_BROKER] Cannot execute approved command: terminal ${terminalId} not found`)
      return
    }

    // SECURITY: Re-validate CWD at execution time (DEC-025)
    const cwdCheck = validateWorkspaceCwd(instance.cwd, this.workspacePath)
    if (!cwdCheck.valid) {
      console.error(`[KAIRO_SECURITY] executeApproved rejected: ${cwdCheck.reason}`)
      return
    }

    // Write command + Enter to PTY
    instance.process.write(command + '\r')
  }

  resize(terminalId: string, cols: number, rows: number): IpcResult<void> {
    const instance = this.terminals.get(terminalId)
    if (!instance) {
      return { success: false, error: `Terminal ${terminalId} not found.` }
    }
    instance.process.resize(cols, rows)
    return { success: true }
  }

  kill(terminalId: string): IpcResult<void> {
    const instance = this.terminals.get(terminalId)
    if (!instance) {
      return { success: false, error: `Terminal ${terminalId} not found.` }
    }
    instance.process.kill()
    this.terminals.delete(terminalId)
    this.lineBuffers.delete(terminalId)
    return { success: true }
  }

  killAll(): number {
    const count = this.terminals.size
    for (const [, instance] of this.terminals) {
      instance.process.kill()
    }
    this.terminals.clear()
    this.lineBuffers.clear()
    return count
  }

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env['COMSPEC'] ?? 'powershell.exe'
    }
    return process.env['SHELL'] ?? '/bin/bash'
  }
}
