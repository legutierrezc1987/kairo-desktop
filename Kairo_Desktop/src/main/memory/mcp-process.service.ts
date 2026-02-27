import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { McpProcessState } from '../../shared/types'
import {
  MCP_SPAWN_TIMEOUT_MS,
  MCP_MAX_RESTART_ATTEMPTS,
  MCP_RESTART_BACKOFF_BASE_MS,
  MCP_HEALTH_CHECK_TIMEOUT_MS,
  MCP_JSONRPC_VERSION,
  MCP_STDOUT_BUFFER_MAX_BYTES,
} from '../../shared/constants'

// ─── JSON-RPC Types (internal) ──────────────────────────────

interface JsonRpcRequest {
  jsonrpc: typeof MCP_JSONRPC_VERSION
  id: string
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: string
  id: string
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/**
 * McpProcessService — MCP server child process lifecycle manager.
 *
 * SECURITY:
 * - shell:false — prevents command injection
 * - No concatenated command strings
 * - API keys/tokens NEVER appear in logs
 */
export class McpProcessService {
  private process: ChildProcess | null = null
  private _state: McpProcessState = 'stopped'
  private serverPath: string
  private serverArgs: string[]
  private restartAttempts = 0
  private pendingRequests: Map<string, {
    resolve: (value: JsonRpcResponse) => void
    reject: (reason: Error) => void
    timer: ReturnType<typeof setTimeout>
  }> = new Map()
  private inputBuffer = ''
  private stopping = false

  private onStateChanged: ((state: McpProcessState) => void) | null = null
  private onCrash: (() => void) | null = null

  constructor(serverPath: string, serverArgs: string[] = []) {
    this.serverPath = serverPath
    this.serverArgs = serverArgs
  }

  // ── Public Accessors ──────────────────────────────────────

  getState(): McpProcessState { return this._state }
  getServerPath(): string { return this.serverPath }
  getInputBufferLength(): number { return this.inputBuffer.length }

  setOnStateChanged(cb: (state: McpProcessState) => void): void {
    this.onStateChanged = cb
  }

  setOnCrash(cb: () => void): void {
    this.onCrash = cb
  }

  // ── Lifecycle ─────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._state === 'running' || this._state === 'starting') return

    this.stopping = false
    this.setState('starting')
    this.restartAttempts = 0

    await this.spawnProcess()
  }

  async stop(): Promise<void> {
    this.stopping = true

    if (!this.process || this._state === 'stopped') {
      this.setState('stopped')
      return
    }

    // Cancel all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error('MCP process stopping'))
      this.pendingRequests.delete(id)
    }

    // Graceful shutdown: try JSON-RPC shutdown, then kill
    try {
      await this.sendRequest('shutdown', {}, 3000)
    } catch {
      // Ignore — we're shutting down anyway
    }

    this.killProcess()
    this.setState('stopped')
  }

  async restart(): Promise<void> {
    await this.stop()
    this.stopping = false
    await this.start()
  }

  // ── Health check ──────────────────────────────────────────

  async healthCheck(): Promise<boolean> {
    if (this._state !== 'running') return false

    try {
      const response = await this.sendRequest('ping', {}, MCP_HEALTH_CHECK_TIMEOUT_MS)
      return response.result !== undefined && !response.error
    } catch {
      return false
    }
  }

  // ── JSON-RPC Communication ────────────────────────────────

  async sendRequest(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number = MCP_HEALTH_CHECK_TIMEOUT_MS,
  ): Promise<JsonRpcResponse> {
    if (this._state !== 'running' || !this.process?.stdin) {
      throw new Error('[MCP] Process not running')
    }

    const id = randomUUID()
    const request: JsonRpcRequest = {
      jsonrpc: MCP_JSONRPC_VERSION,
      id,
      method,
      params: Object.keys(params).length > 0 ? params : undefined,
    }

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`[MCP] Request timeout: ${method} (${timeoutMs}ms)`))
      }, timeoutMs)

      this.pendingRequests.set(id, { resolve, reject, timer })

      const serialized = JSON.stringify(request) + '\n'
      this.process!.stdin!.write(serialized, (err) => {
        if (err) {
          clearTimeout(timer)
          this.pendingRequests.delete(id)
          reject(new Error(`[MCP] Write error: ${err.message}`))
        }
      })
    })
  }

  // ── Private ───────────────────────────────────────────────

  private async spawnProcess(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const spawnTimer = setTimeout(() => {
        this.killProcess()
        this.setState('failed')
        reject(new Error(`[MCP] Spawn timeout: ${MCP_SPAWN_TIMEOUT_MS}ms`))
      }, MCP_SPAWN_TIMEOUT_MS)

      try {
        this.process = spawn(this.serverPath, this.serverArgs, {
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        })

        this.process.stdout!.on('data', (chunk: Buffer) => {
          this.handleStdout(chunk.toString('utf-8'))
        })

        this.process.stderr!.on('data', (chunk: Buffer) => {
          const msg = chunk.toString('utf-8').trim()
          if (msg.length > 0) {
            console.warn(`[MCP_STDERR] ${this.sanitizeLogMessage(msg)}`)
          }
        })

        this.process.on('error', (err: Error) => {
          clearTimeout(spawnTimer)
          console.error(`[MCP] Spawn error: ${err.message}`)
          this.setState('failed')
          reject(err)
        })

        this.process.on('exit', (code: number | null, signal: string | null) => {
          console.log(`[MCP] Process exited (code=${code}, signal=${signal})`)

          if (!this.stopping) {
            this.setState('crashed')
            this.onCrash?.()
            this.attemptRestart()
          }
        })

        // Process considered running on first stdout
        const startupListener = (): void => {
          clearTimeout(spawnTimer)
          this.process?.stdout?.removeListener('data', startupListener)
          this.setState('running')
          resolve()
        }
        this.process.stdout!.once('data', startupListener)

        // Fallback: if no stdout in 2s but process alive, consider running
        setTimeout(() => {
          if (this._state === 'starting' && this.process && !this.process.killed) {
            clearTimeout(spawnTimer)
            this.process.stdout?.removeListener('data', startupListener)
            this.setState('running')
            resolve()
          }
        }, 2000)

      } catch (err) {
        clearTimeout(spawnTimer)
        this.setState('failed')
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  private handleStdout(data: string): void {
    this.inputBuffer += data

    // SECURITY: Buffer cap — prevent unbounded memory growth from hostile/broken MCP servers.
    if (this.inputBuffer.length > MCP_STDOUT_BUFFER_MAX_BYTES) {
      console.error(`[MCP] stdout buffer exceeded ${MCP_STDOUT_BUFFER_MAX_BYTES} bytes — killing process (hostile/broken server)`)
      this.inputBuffer = ''

      // Reject all pending requests with a deterministic error
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timer)
        pending.reject(new Error('[MCP] Buffer overflow — process killed'))
        this.pendingRequests.delete(id)
      }

      // Kill and transition to failed state (triggers onCrash → fallback)
      this.killProcess()
      this.setState('crashed')
      this.onCrash?.()
      this.attemptRestart()
      return
    }

    const lines = this.inputBuffer.split('\n')
    this.inputBuffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue

      try {
        const response = JSON.parse(trimmed) as JsonRpcResponse
        if (response.id && this.pendingRequests.has(response.id)) {
          const pending = this.pendingRequests.get(response.id)!
          clearTimeout(pending.timer)
          this.pendingRequests.delete(response.id)
          pending.resolve(response)
        }
      } catch {
        console.log(`[MCP_STDOUT] ${this.sanitizeLogMessage(trimmed)}`)
      }
    }
  }

  private attemptRestart(): void {
    if (this.stopping) return

    if (this.restartAttempts >= MCP_MAX_RESTART_ATTEMPTS) {
      console.error(`[MCP] Max restart attempts (${MCP_MAX_RESTART_ATTEMPTS}) exceeded. Marking as failed.`)
      this.setState('failed')
      return
    }

    this.restartAttempts++
    const delay = MCP_RESTART_BACKOFF_BASE_MS * Math.pow(2, this.restartAttempts - 1)
    console.log(`[MCP] Restart attempt ${this.restartAttempts}/${MCP_MAX_RESTART_ATTEMPTS} in ${delay}ms`)

    setTimeout(() => {
      if (this.stopping || this._state === 'stopped') return

      this.spawnProcess().catch((err) => {
        console.error(`[MCP] Restart failed: ${err instanceof Error ? err.message : String(err)}`)
        this.attemptRestart()
      })
    }, delay)
  }

  private killProcess(): void {
    if (!this.process) return
    try {
      this.process.kill('SIGTERM')
      const proc = this.process
      setTimeout(() => {
        try { proc.kill('SIGKILL') } catch { /* already dead */ }
      }, 3000)
    } catch {
      // Process already dead
    }
    this.process = null
    this.inputBuffer = ''
  }

  private setState(state: McpProcessState): void {
    if (this._state === state) return
    const previous = this._state
    this._state = state
    console.log(`[MCP] State: ${previous} → ${state}`)
    this.onStateChanged?.(state)
  }

  private sanitizeLogMessage(msg: string): string {
    return msg.replace(/\b(sk-|AIza|key-|token-)[A-Za-z0-9_-]{10,}\b/g, '[REDACTED]')
  }
}
