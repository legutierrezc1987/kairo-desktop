import { useEffect } from 'react'
import MainLayout from '@renderer/components/Layout/MainLayout'
import { useProjectStore } from '@renderer/stores/projectStore'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { IpcResult, GetSettingResponse, LoadProjectResponse } from '@shared/types'

function App(): React.JSX.Element {
  const setActiveProject = useProjectStore((s) => s.setActiveProject)

  // Restore last active project on startup (optional, best-effort)
  useEffect(() => {
    if (!hasKairoApi()) return

    const restore = async (): Promise<void> => {
      try {
        const api = getKairoApiOrThrow()
        const settingResult = (await api.invoke(
          IPC_CHANNELS.SETTINGS_GET,
          { key: 'last_project_id' }
        )) as IpcResult<GetSettingResponse>

        if (!settingResult.success || !settingResult.data?.value) return

        const loadResult = (await api.invoke(
          IPC_CHANNELS.PROJECT_LOAD,
          { projectId: settingResult.data.value }
        )) as IpcResult<LoadProjectResponse>

        if (loadResult.success && loadResult.data) {
          // Race guard: only set if nothing was loaded in the meantime
          if (useProjectStore.getState().activeProject === null) {
            setActiveProject(loadResult.data.project)
          }
        }
      } catch {
        // Best-effort: silently ignore restore failures
      }
    }
    restore()
  }, [setActiveProject])

  // Fallback when IPC bridge is unavailable (main process crash / ABI mismatch)
  if (!hasKairoApi()) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', backgroundColor: '#171717', color: '#fca5a5', fontFamily: 'monospace',
        padding: '24px', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px', color: '#ef4444' }}>
          Kairo IPC Bridge Unavailable
        </h2>
        <p style={{ fontSize: '13px', color: '#a3a3a3', maxWidth: '480px', lineHeight: '1.6' }}>
          The main process failed to start. Common causes:
        </p>
        <ul style={{ fontSize: '12px', color: '#a3a3a3', textAlign: 'left', lineHeight: '1.8', marginTop: '8px' }}>
          <li>Native module ABI mismatch — run <code style={{ color: '#fbbf24' }}>npx electron-builder install-app-deps</code></li>
          <li>ELECTRON_RUN_AS_NODE is set — unset it before launching</li>
          <li>Page opened in a regular browser instead of Electron</li>
        </ul>
        <p style={{ fontSize: '11px', color: '#525252', marginTop: '16px' }}>
          Check the terminal for the full error trace.
        </p>
      </div>
    )
  }

  return <MainLayout />
}

export default App
