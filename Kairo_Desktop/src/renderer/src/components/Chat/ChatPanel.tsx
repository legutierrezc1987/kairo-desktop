import { useRef, useEffect } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useChat } from '@renderer/hooks/useChat'
import MessageBubble from './MessageBubble'
import InputBar from './InputBar'
import ModelSelector from './ModelSelector'
import ContextMeter from './ContextMeter'

export default function ChatPanel(): React.JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const error = useChatStore((s) => s.error)
  const { sendMessage } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#171717' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #404040' }}>
        <ContextMeter />
        <ModelSelector />
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
        {isLoading && (
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

      {/* Input */}
      <InputBar onSend={sendMessage} disabled={isLoading} />
    </div>
  )
}
