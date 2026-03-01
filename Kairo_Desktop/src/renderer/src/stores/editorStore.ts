import { create } from 'zustand'

interface EditorState {
  activeFilePath: string | null
  content: string
  languageId: string
  isDirty: boolean
  isSaving: boolean
  isLoading: boolean
  error: string | null

  setFile: (filePath: string, content: string, languageId: string) => void
  setContent: (content: string) => void
  markDirty: () => void
  markClean: () => void
  setSaving: (saving: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearFile: () => void
}

export const useEditorStore = create<EditorState>()((set) => ({
  activeFilePath: null,
  content: '',
  languageId: 'plaintext',
  isDirty: false,
  isSaving: false,
  isLoading: false,
  error: null,

  setFile: (activeFilePath, content, languageId) =>
    set({ activeFilePath, content, languageId, isDirty: false, error: null }),
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
    }),
}))
