/**
 * kairoApi.ts — Bridge availability guard.
 *
 * SECURITY: The contextBridge (window.kairoApi) is only available inside
 * Electron's BrowserWindow with a properly loaded preload script.
 * It is undefined when:
 *   - Main process crashed before createWindow() (e.g. ABI mismatch)
 *   - Page is opened in a regular browser
 *   - ELECTRON_RUN_AS_NODE is set
 *
 * All renderer code MUST use these helpers instead of accessing
 * window.kairoApi directly.
 */

import type { KairoApi } from '../../../preload/index.d'

/** Returns true if the IPC bridge is available. */
export function hasKairoApi(): boolean {
  return typeof window !== 'undefined' && window.kairoApi != null
}

/**
 * Returns the IPC bridge or throws a descriptive error.
 * Use in callbacks/handlers where a missing bridge is exceptional.
 */
export function getKairoApiOrThrow(): KairoApi {
  if (!hasKairoApi()) {
    throw new Error(
      '[KAIRO] IPC bridge unavailable — main process may have failed to start.'
    )
  }
  return window.kairoApi
}
