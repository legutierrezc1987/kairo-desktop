import { type IpcMainInvokeEvent, BrowserWindow } from 'electron'

/**
 * Validates that an IPC event originates from a trusted frame.
 * SECURITY: Rejects requests from devtools, external URLs, or non-main frames.
 */
export function validateSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame
  if (!frame) {
    throw new Error('[KAIRO_SECURITY] IPC rejected: no sender frame.')
  }

  const url = frame.url
  const isDevServer = url.startsWith('http://localhost')
  const isFileProtocol = url.startsWith('file://')
  const isAppProtocol = url.startsWith('app://')

  if (!isDevServer && !isFileProtocol && !isAppProtocol) {
    throw new Error(
      `[KAIRO_SECURITY] IPC rejected: untrusted origin "${url}".`
    )
  }

  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  if (!senderWindow) {
    throw new Error(
      '[KAIRO_SECURITY] IPC rejected: sender is not a known BrowserWindow.'
    )
  }
}
