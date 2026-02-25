import { create } from 'zustand'
import type { BrokerMode, PendingCommandNotification } from '@shared/types'

interface BrokerState {
  mode: BrokerMode
  pendingCommands: PendingCommandNotification[]

  setMode: (mode: BrokerMode) => void
  addPending: (cmd: PendingCommandNotification) => void
  removePending: (commandId: string) => void
  setPendingCommands: (cmds: PendingCommandNotification[]) => void
}

export const useBrokerStore = create<BrokerState>()((set) => ({
  mode: 'supervised',
  pendingCommands: [],

  setMode: (mode) => set({ mode }),
  addPending: (cmd) => set((s) => ({ pendingCommands: [...s.pendingCommands, cmd] })),
  removePending: (commandId) =>
    set((s) => ({
      pendingCommands: s.pendingCommands.filter((c) => c.id !== commandId),
    })),
  setPendingCommands: (cmds) => set({ pendingCommands: cmds }),
}))
