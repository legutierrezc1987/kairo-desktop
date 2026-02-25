import type { ChatMessage } from '@shared/types'

interface MessageBubbleProps {
  message: ChatMessage
}

export default function MessageBubble({ message }: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
      <div
        style={{
          maxWidth: '80%',
          borderRadius: '8px',
          padding: '8px 16px',
          fontSize: '13px',
          backgroundColor: isUser ? '#2563eb' : '#262626',
          color: isUser ? '#ffffff' : '#f5f5f5',
        }}
      >
        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{message.content}</p>
        {message.tokenCount !== undefined && (
          <span style={{ display: 'block', fontSize: '11px', color: '#a3a3a3', marginTop: '4px', textAlign: 'right' }}>
            {message.tokenCount} tokens
          </span>
        )}
      </div>
    </div>
  )
}
