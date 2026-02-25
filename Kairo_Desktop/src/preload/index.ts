import { contextBridge, ipcRenderer } from 'electron'
import { isAllowedChannel } from '../shared/ipc-channels'

/**
 * Hardened IPC API.
 * SECURITY: Every channel is validated against the frozen allowlist
 * before being forwarded to ipcRenderer. Unlisted channels throw.
 */
function validateChannel(channel: string): void {
  if (!isAllowedChannel(channel)) {
    throw new Error(
      `[KAIRO_SECURITY] IPC channel "${channel}" is NOT in the allowlist. Rejected.`
    )
  }
}

const kairoApi = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    validateChannel(channel)
    return ipcRenderer.invoke(channel, ...args)
  },
  send: (channel: string, ...args: unknown[]): void => {
    validateChannel(channel)
    ipcRenderer.send(channel, ...args)
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    validateChannel(channel)
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
      callback(...args)
    }
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  },
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('kairoApi', kairoApi)
  } catch (error) {
    console.error('[KAIRO] Failed to expose API:', error)
  }
} else {
  throw new Error(
    '[KAIRO_SECURITY] Context isolation is DISABLED. This is a security violation.'
  )
}
