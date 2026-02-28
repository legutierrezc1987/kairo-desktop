import { useCallback, useEffect } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { hasKairoApi, getKairoApiOrThrow } from '@renderer/lib/kairoApi'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type {
  ChatMessage,
  SendMessageRequest,
  StreamChunk,
  ChatAbortResponse,
  IpcResult,
} from '@shared/types'

function generateId(): string {
  return crypto.randomUUID()
}

export function useChat() {
  const addMessage = useChatStore((s) => s.addMessage)
  const startStreaming = useChatStore((s) => s.startStreaming)
  const appendDelta = useChatStore((s) => s.appendDelta)
  const finishStreaming = useChatStore((s) => s.finishStreaming)
  const failStreaming = useChatStore((s) => s.failStreaming)
  const setError = useChatStore((s) => s.setError)
  const selectedModel = useSettingsStore((s) => s.selectedModel)

  // ── Register streaming listener (mount-once) ──────────────
  useEffect(() => {
    if (!hasKairoApi()) return

    const api = getKairoApiOrThrow()
    const unsubscribe = api.on(
      IPC_CHANNELS.CHAT_STREAM_CHUNK,
      (chunk: unknown) => {
        const c = chunk as StreamChunk
        if (!c || typeof c.messageId !== 'string') return

        if (c.done) {
          if (c.error) {
            failStreaming(c.messageId, c.error)
          } else {
            finishStreaming(c.messageId, c.tokenCount)
          }
        } else if (c.delta) {
          appendDelta(c.messageId, c.delta)
        }
      },
    )

    return unsubscribe
  }, [appendDelta, finishStreaming, failStreaming])

  // ── Send message (initiates streaming) ─────────────────────
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

      try {
        const api = getKairoApiOrThrow()
        const request: SendMessageRequest = { content, model: selectedModel }
        const result = (await api.invoke(
          IPC_CHANNELS.CHAT_SEND_MESSAGE,
          request,
        )) as IpcResult<{ messageId: string }>

        if (result.success && result.data) {
          // Start streaming — creates empty model bubble that accumulates deltas
          startStreaming(result.data.messageId)
        } else {
          setError(result.error ?? 'Unknown error from Gemini gateway')
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to send message'
        setError(msg)
      }
    },
    [addMessage, setError, startStreaming, selectedModel],
  )

  // ── Abort active generation ────────────────────────────────
  const abortGeneration = useCallback(async (): Promise<void> => {
    try {
      const api = getKairoApiOrThrow()
      await api.invoke(IPC_CHANNELS.CHAT_ABORT) as IpcResult<ChatAbortResponse>
    } catch {
      // Best-effort abort
    }
  }, [])

  return { sendMessage, abortGeneration }
}
