/**
 * useFileExplorer — Phase 6 Sprint B (PRD §6.2)
 *
 * Local-state hook for lazy-loaded file tree.
 * Loads root on project change, expands subdirectories on demand.
 * Anti-stale guard: discards results if project changed mid-flight.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { useProjectStore } from '@renderer/stores/projectStore'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { IpcResult, FsListDirResponse, FsDirEntry } from '@shared/types'

interface FileExplorerState {
  rootEntries: FsDirEntry[]
  expandedPaths: Set<string>
  isLoading: boolean
  error: string | null
}

export function useFileExplorer() {
  const activeProject = useProjectStore((s) => s.activeProject)
  const projectIdRef = useRef<string | null>(null)

  const [state, setState] = useState<FileExplorerState>({
    rootEntries: [],
    expandedPaths: new Set(),
    isLoading: false,
    error: null,
  })

  // ── Load root directory ──────────────────────────────────
  const loadRoot = useCallback(async (folderPath: string, projectId: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    try {
      const api = getKairoApiOrThrow()
      const result = (await api.invoke(
        IPC_CHANNELS.FS_LIST_DIR,
        { dirPath: folderPath, depth: 1 },
      )) as IpcResult<FsListDirResponse>

      // Anti-stale guard
      if (projectIdRef.current !== projectId) return

      if (result.success && result.data) {
        setState({
          rootEntries: result.data.entries,
          expandedPaths: new Set(),
          isLoading: false,
          error: null,
        })
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error ?? 'Failed to list directory',
        }))
      }
    } catch (err: unknown) {
      if (projectIdRef.current !== projectId) return
      const msg = err instanceof Error ? err.message : 'Failed to list directory'
      setState((prev) => ({ ...prev, isLoading: false, error: msg }))
    }
  }, [])

  // ── React to project changes ──────────────────────────────
  useEffect(() => {
    if (activeProject) {
      projectIdRef.current = activeProject.id
      loadRoot(activeProject.folderPath, activeProject.id)
    } else {
      projectIdRef.current = null
      setState({
        rootEntries: [],
        expandedPaths: new Set(),
        isLoading: false,
        error: null,
      })
    }
  }, [activeProject?.id]) // Only react to project identity change

  // ── Toggle expand/collapse ────────────────────────────────
  const toggleExpand = useCallback(async (dirEntry: FsDirEntry) => {
    const path = dirEntry.path

    setState((prev) => {
      const next = new Set(prev.expandedPaths)
      if (next.has(path)) {
        // Collapse: remove from expanded set
        next.delete(path)
        return { ...prev, expandedPaths: next }
      }
      // Expand: add to set (children will be loaded below)
      next.add(path)
      return { ...prev, expandedPaths: next }
    })

    // If already has children loaded, just toggle visibility (handled above)
    if (dirEntry.children && dirEntry.children.length > 0) return

    // Lazy-load children
    try {
      const api = getKairoApiOrThrow()
      const result = (await api.invoke(
        IPC_CHANNELS.FS_LIST_DIR,
        { dirPath: path, depth: 1 },
      )) as IpcResult<FsListDirResponse>

      // Anti-stale guard
      if (projectIdRef.current !== activeProject?.id) return

      if (result.success && result.data) {
        setState((prev) => ({
          ...prev,
          rootEntries: injectChildren(prev.rootEntries, path, result.data!.entries),
        }))
      }
    } catch {
      // Silently fail on expand — the user can retry
    }
  }, [activeProject?.id])

  // ── Refresh the tree ──────────────────────────────────────
  const refresh = useCallback(() => {
    if (activeProject) {
      loadRoot(activeProject.folderPath, activeProject.id)
    }
  }, [activeProject?.id, loadRoot])

  return {
    entries: state.rootEntries,
    expandedPaths: state.expandedPaths,
    isLoading: state.isLoading,
    error: state.error,
    toggleExpand,
    refresh,
  }
}

/**
 * Recursively inject children into the tree at the matching directory path.
 * Returns a new array (immutable update for React).
 */
function injectChildren(
  entries: FsDirEntry[],
  targetPath: string,
  children: FsDirEntry[],
): FsDirEntry[] {
  return entries.map((entry) => {
    if (entry.path === targetPath) {
      return { ...entry, children }
    }
    if (entry.isDirectory && entry.children) {
      return { ...entry, children: injectChildren(entry.children, targetPath, children) }
    }
    return entry
  })
}
