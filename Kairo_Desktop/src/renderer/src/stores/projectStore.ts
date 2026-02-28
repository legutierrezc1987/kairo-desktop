import { create } from 'zustand'
import type { Project } from '@shared/types'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null
  isLoading: boolean
  error: string | null

  setProjects: (projects: Project[]) => void
  setActiveProject: (project: Project | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  addProject: (project: Project) => void
}

export const useProjectStore = create<ProjectState>()((set) => ({
  projects: [],
  activeProject: null,
  isLoading: false,
  error: null,

  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => set({ activeProject }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
}))
