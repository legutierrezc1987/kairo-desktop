import { useRef, useEffect } from 'react'
import { useChatStore } from '@renderer/stores/chatStore'
import { useProjectStore } from '@renderer/stores/projectStore'
import { useChat } from '@renderer/hooks/useChat'
import MessageBubble from './MessageBubble'
import InputBar from './InputBar'
import ModelSelector from './ModelSelector'
import ContextMeter from './ContextMeter'
import ConsolidateButton from './ConsolidateButton'
import RecallButton from './RecallButton'

const CUT_PHASE_LABELS: Record<string, string> = {
  blocking: 'Preparing session cut...',
  counting: 'Counting tokens...',
  generating: 'Generating summary...',
  saving: 'Saving files...',
  uploading: 'Queueing upload...',
  recalling: 'Recalling context...',
}

const CONSOLIDATION_PHASE_LABELS: Record<string, string> = {
  claiming: 'Claiming sources...',
  merging: 'Merging sources...',
  uploading: 'Uploading master summary...',
  deleting: 'Deleting old sources...',
}

const RATE_LIMIT_PHASE_LABELS: Record<string, string> = {
  retrying: 'Rate limited — retrying...',
  fallback: 'Switching to fallback model...',
}

export default function ChatPanel(): React.JSX.Element {
  const messages = useChatStore((s) => s.messages)
  const isLoading = useChatStore((s) => s.isLoading)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const cutPhase = useChatStore((s) => s.cutPhase)
  const recallPhase = useChatStore((s) => s.recallPhase)
  const consolidationPhase = useChatStore((s) => s.consolidationPhase)
  const rateLimitPhase = useChatStore((s) => s.rateLimitPhase)
  const error = useChatStore((s) => s.error)
  const activeProject = useProjectStore((s) => s.activeProject)
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

      {/* Cut pipeline overlay (Sprint D) */}
      {cutPhase && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: '#262626',
            border: '1px solid #404040',
            borderRadius: '12px',
            padding: '24px 32px',
            textAlign: 'center',
            maxWidth: '320px',
          }}>
            <div style={{ fontSize: '14px', color: '#e5e5e5', fontWeight: 600, marginBottom: '8px' }}>
              Session Cut in Progress
            </div>
            <div style={{ fontSize: '12px', color: '#a3a3a3' }}>
              {CUT_PHASE_LABELS[cutPhase] ?? cutPhase}
            </div>
          </div>
        </div>
      )}

      {/* Non-blocking recall status indicator (Phase 5 Sprint A) */}
      {recallPhase && (
        <div style={{
          position: 'absolute',
          top: '48px',
          right: '12px',
          backgroundColor: '#1e3a5f',
          border: '1px solid #2563eb',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '11px',
          color: '#93c5fd',
          zIndex: 40,
        }}>
          {recallPhase === 'querying' ? 'Recalling memory...' : 'Injecting context...'}
        </div>
      )}

      {/* Non-blocking rate-limit status indicator (Phase 5 Sprint C) */}
      {rateLimitPhase && (
        <div style={{
          position: 'absolute',
          top: recallPhase ? '80px' : '48px',
          right: '12px',
          backgroundColor: '#3a2e1e',
          border: '1px solid #d97706',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '11px',
          color: '#fbbf24',
          zIndex: 40,
        }}>
          {RATE_LIMIT_PHASE_LABELS[rateLimitPhase] ?? 'Handling rate limit...'}
        </div>
      )}

      {/* Non-blocking consolidation status indicator (Phase 5 Sprint B) */}
      {consolidationPhase && (
        <div style={{
          position: 'absolute',
          top: recallPhase || rateLimitPhase ? '80px' : '48px',
          right: '12px',
          backgroundColor: '#1e3a2f',
          border: '1px solid #16a34a',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '11px',
          color: '#86efac',
          zIndex: 40,
        }}>
          {CONSOLIDATION_PHASE_LABELS[consolidationPhase] ?? 'Consolidating memory...'}
        </div>
      )}

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

      {/* No-project hint (Phase 7 Hotfix J) */}
      {!activeProject && (
        <div style={{ padding: '4px 12px', fontSize: '11px', color: '#f59e0b', textAlign: 'center' }}>
          Abre o crea un proyecto para empezar a chatear.
        </div>
      )}

      {/* Input — disabled during loading, cut pipeline, recall, or no active project */}
      <InputBar onSend={sendMessage} disabled={isLoading || !!cutPhase || !!recallPhase || !activeProject} />
    </div>
  )
}
