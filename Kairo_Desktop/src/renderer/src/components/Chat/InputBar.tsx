import { useState, useCallback, useRef } from 'react'

interface InputBarProps {
  onSend: (content: string) => void
  disabled: boolean
}

export default function InputBar({ onSend, disabled }: InputBarProps): React.JSX.Element {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
    textareaRef.current?.focus()
  }, [input, disabled, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '12px', borderTop: '1px solid #404040' }}>
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write your message..."
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          backgroundColor: '#262626',
          color: '#f5f5f5',
          fontSize: '13px',
          borderRadius: '8px',
          padding: '8px 12px',
          border: '1px solid #404040',
          outline: 'none',
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'inherit',
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        style={{
          padding: '8px 16px',
          backgroundColor: disabled || !input.trim() ? '#1e40af' : '#2563eb',
          color: '#ffffff',
          fontSize: '13px',
          borderRadius: '8px',
          border: 'none',
          cursor: disabled || !input.trim() ? 'not-allowed' : 'pointer',
          opacity: disabled || !input.trim() ? 0.5 : 1,
        }}
      >
        Send
      </button>
    </div>
  )
}
