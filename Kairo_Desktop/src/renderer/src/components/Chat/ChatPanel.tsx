import { useRef, useEffect } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useChat } from '@renderer/hooks/useChat'
import MessageBubble from './MessageBubble'
import InputBar from './InputBar'
import ModelSelector from './ModelSelector'
import ContextMeter from './ContextMeter'
import ConsolidateButton from './ConsolidateButton'
import RecallButton from './RecallButton'

export default function ChatPanel(): React.JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)
  const { sendMessage, abortGeneration } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#171717', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #404040' }}>
        <ContextMeter />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ConsolidateButton />
          <ModelSelector />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {messages.length === 0 && (
          <p style={{ color: '#737373', fontSize: '13px', textAlign: 'center', marginTop: '32px' }}>
            Start a conversation with Kairo
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && !isStreaming && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
            <div style={{ backgroundColor: '#262626', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', color: '#a3a3a3' }}>
              Thinking...
            </div>
          </div>
        )}
        {error && (
          <div style={{ marginBottom: '12px', padding: '8px 16px', backgroundColor: 'rgba(127,29,29,0.3)', border: '1px solid #991b1b', borderRadius: '8px', fontSize: '13px', color: '#fca5a5' }}>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Recall popover (positioned relative to this container) */}
      <RecallButton />

      {/* Stop button (visible during streaming) */}
      {isStreaming && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <button
            onClick={abortGeneration}
            style={{
              background: 'none',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              color: '#fca5a5',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 12px',
            }}
          >
            Stop generating
          </button>
        </div>
      )}

      {/* Input */}
      <InputBar onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
