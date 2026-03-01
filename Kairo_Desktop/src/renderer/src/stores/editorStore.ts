import { create } from 'zustand'
import type { UndoEntry } from '@shared/types'

interface EditorState {
  activeFilePath: string | null
  content: string
  languageId: string
  isDirty: boolean
  isSaving: boolean
  isLoading: boolean
  error: string | null

  // Undo state (Phase 6 Sprint D)
  undoAvailable: boolean
  undoEntry: UndoEntry | null
  undoCurrentContent: string | null
  showDiff: boolean
  isUndoing: boolean

  setFile: (filePath: string, content: string, languageId: string) => void
  setContent: (content: string) => void
  markDirty: () => void
  markClean: () => void
  setSaving: (saving: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearFile: () => void

  // Undo actions
  setUndoPreview: (entry: UndoEntry, currentContent: string) => void
  clearUndoPreview: () => void
  setShowDiff: (show: boolean) => void
  setUndoAvailable: (available: boolean) => void
  setIsUndoing: (undoing: boolean) => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  activeFilePath: null,
  content: '',
  languageId: 'plaintext',
  isDirty: false,
  isSaving: false,
  isLoading: false,
  error: null,

  // Undo initial state
  undoAvailable: false,
  undoEntry: null,
  undoCurrentContent: null,
  showDiff: false,
  isUndoing: false,

  setFile: (activeFilePath, content, languageId) =>
    set({ activeFilePath, content, languageId, isDirty: false, error: null, showDiff: false }),
  setContent: (content) => set({ content, isDirty: true }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  setSaving: (isSaving) => set({ isSaving }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearFile: () =>
    set({
      activeFilePath: null,
      content: '',
      languageId: 'plaintext',
      isDirty: false,
      isSaving: false,
      isLoading: false,
      error: null,
      undoAvailable: false,
      undoEntry: null,
      undoCurrentContent: null,
      showDiff: false,
      isUndoing: false,
    }),

  // Undo actions
  setUndoPreview: (undoEntry, undoCurrentContent) =>
    set({ undoEntry, undoCurrentContent, showDiff: true }),
  clearUndoPreview: () =>
    set({ undoEntry: null, undoCurrentContent: null, showDiff: false }),
  setShowDiff: (showDiff) => set({ showDiff }),
  setUndoAvailable: (undoAvailable) => set({ undoAvailable }),
  setIsUndoing: (isUndoing) => set({ isUndoing }),
}))
