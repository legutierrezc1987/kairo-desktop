import { create } from 'zustand'
import type { SessionRecord, SessionState, TokenBudgetState } from '@shared/types'

interface SessionStoreState {
  dbSession: SessionRecord | null
  sessionState: SessionState | null
  budgetState: TokenBudgetState | null
  isArchiving: boolean

  setDbSession: (session: SessionRecord | null) => void
  setSessionState: (state: SessionState | null) => void
  setBudgetState: (state: TokenBudgetState | null) => void
  setArchiving: (archiving: boolean) => void
}

export const useSessionStore = create<SessionStoreState>()((set) => ({
  dbSession: null,
  sessionState: null,
  budgetState: null,
  isArchiving: false,

  setDbSession: (dbSession) => set({ dbSession }),
  setSessionState: (sessionState) => set({ sessionState }),
  setBudgetState: (budgetState) => set({ budgetState }),
  setArchiving: (isArchiving) => set({ isArchiving }),
}))
