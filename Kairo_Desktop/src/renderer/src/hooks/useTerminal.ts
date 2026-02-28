import { useRef, useEffect, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { TerminalSpawnResponse, IpcResult } from '@shared/types'

interface UseTerminalOptions {
  cwd: string
}

interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement | null>
  isReady: boolean
  error: string | null
}

export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const terminalRef = useRef<HTMLDivElement | null>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const cleanupFnsRef = useRef<(() => void)[]>([])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!terminalRef.current || !options.cwd || !hasKairoApi()) return

    const api = getKairoApiOrThrow()
    const xterm = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
      },
    })
    const fitAddon = new FitAddon()
    xterm.loadAddon(fitAddon)
    xterm.open(terminalRef.current)
    fitAddon.fit()

    xtermRef.current = xterm

    // Spawn pty in main process
    api
      .invoke(IPC_CHANNELS.TERMINAL_SPAWN, {
        cwd: options.cwd,
        cols: xterm.cols,
        rows: xterm.rows,
      })
      .then((result) => {
        const res = result as IpcResult<TerminalSpawnResponse>
        if (res.success && res.data) {
          terminalIdRef.current = res.data.terminalId
          setIsReady(true)
        } else {
          setError(res.error ?? 'Failed to spawn terminal')
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Terminal spawn failed'
        setError(msg)
      })

    // Listen for pty output (main → renderer push)
    const removeDataListener = api.on(
      IPC_CHANNELS.TERMINAL_DATA,
      (...args: unknown[]) => {
        const payload = args[0] as { terminalId: string; data: string }
        if (payload.terminalId === terminalIdRef.current) {
          xterm.write(payload.data)
        }
      }
    )
    cleanupFnsRef.current.push(removeDataListener)

    // Listen for pty exit
    const removeExitListener = api.on(
      IPC_CHANNELS.TERMINAL_EXIT,
      (...args: unknown[]) => {
        const payload = args[0] as { terminalId: string; exitCode: number }
        if (payload.terminalId === terminalIdRef.current) {
          xterm.write(`\r\n[Process exited with code ${payload.exitCode}]\r\n`)
          setIsReady(false)
        }
      }
    )
    cleanupFnsRef.current.push(removeExitListener)

    // Forward user keystrokes to pty
    const onDataDisposable = xterm.onData((data: string) => {
      if (terminalIdRef.current) {
        api.invoke(IPC_CHANNELS.TERMINAL_INPUT, {
          terminalId: terminalIdRef.current,
          data,
        })
      }
    })

    // Handle resize via ResizeObserver
    const container = terminalRef.current
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (terminalIdRef.current) {
        api.invoke(IPC_CHANNELS.TERMINAL_RESIZE, {
          terminalId: terminalIdRef.current,
          cols: xterm.cols,
          rows: xterm.rows,
        })
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      onDataDisposable.dispose()
      cleanupFnsRef.current.forEach((fn) => fn())
      cleanupFnsRef.current = []

      if (terminalIdRef.current) {
        api.invoke(IPC_CHANNELS.TERMINAL_KILL, {
          terminalId: terminalIdRef.current,
        })
      }

      xterm.dispose()
      xtermRef.current = null
      terminalIdRef.current = null
      setIsReady(false)
    }
  }, [options.cwd])

  return { terminalRef, isReady, error }
}
