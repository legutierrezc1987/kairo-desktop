import { useCallback } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { ChatMessage, SendMessageRequest, SendMessageResponse, IpcResult } from '@shared/types'

function generateId(): string {
  return crypto.randomUUID()
}

export function useChat() {
  const addMessage = useChatStore((s) => s.addMessage)
  const setLoading = useChatStore((s) => s.setLoading)
  const setError = useChatStore((s) => s.setError)
  const selectedModel = useSettingsStore((s) => s.selectedModel)

  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      addMessage(userMessage)
      setError(null)
      setLoading(true)

      try {
        const api = getKairoApiOrThrow()
        const request: SendMessageRequest = { content, model: selectedModel }
        const result = (await api.invoke(
          IPC_CHANNELS.CHAT_SEND_MESSAGE,
          request
        )) as IpcResult<SendMessageResponse>

        if (result.success && result.data) {
          addMessage(result.data.message)
        } else {
          setError(result.error ?? 'Unknown error from Gemini gateway')
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to send message'
        setError(msg)
      } finally {
        setLoading(false)
      }
    },
    [addMessage, setLoading, setError, selectedModel]
  )

  return { sendMessage }
}
