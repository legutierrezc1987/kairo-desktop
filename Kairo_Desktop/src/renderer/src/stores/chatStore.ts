import { create } from 'zustand'
import type { ChatMessage, CutPipelinePhase } from '@shared/types'

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingMessageId: string | null
  error: string | null

  // Cut pipeline state (Phase 4 Sprint D)
  cutPhase: CutPipelinePhase | null

  addMessage: (message: ChatMessage) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearMessages: () => void

  // Streaming actions (Phase 4 Sprint C)
  startStreaming: (messageId: string) => void
  appendDelta: (messageId: string, delta: string) => void
  finishStreaming: (messageId: string, tokenCount?: number) => void
  failStreaming: (messageId: string, error: string) => void

  // Cut pipeline actions (Phase 4 Sprint D)
  setCutPhase: (phase: CutPipelinePhase | null) => void
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingMessageId: null,
  error: null,
  cutPhase: null,

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  clearMessages: () => set({ messages: [], error: null, isStreaming: false, streamingMessageId: null }),

  startStreaming: (messageId) =>
    set((state) => ({
      isStreaming: true,
      isLoading: true,
      streamingMessageId: messageId,
      error: null,
      messages: [
        ...state.messages,
        {
          id: messageId,
          role: 'model',
          content: '',
          timestamp: Date.now(),
        },
      ],
    })),

  appendDelta: (messageId, delta) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + delta } : m
      ),
    })),

  finishStreaming: (messageId, tokenCount) =>
    set((state) => ({
      isStreaming: false,
      isLoading: false,
      streamingMessageId: null,
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, tokenCount } : m
      ),
    })),

  failStreaming: (messageId, error) =>
    set((state) => ({
      isStreaming: false,
      isLoading: false,
      streamingMessageId: null,
      error,
      // Remove the empty streaming placeholder if no content was received
      messages: state.messages.filter(
        (m) => !(m.id === messageId && m.content === '')
      ),
    })),

  setCutPhase: (cutPhase) => set({ cutPhase }),
}))
