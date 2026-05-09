import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { chatService } from '../services/chatService'
import type { ChatMessage, ChatSession, ChatMessageContent } from '../types'
import { createClientId } from '../utils/id'
import { estimateUsageCost } from '../utils/usageCost'
import ModelSelector from '../components/ModelSelector'
import {
  IconPlus, IconTrash, IconSend, IconStop, IconMic, IconCopy, IconCheck,
  IconSpinner,
} from '../components/icons/AppIcons'
import { localizeChatError, localizeChatException } from '../utils/chatErrors'
import { useT } from '../store/useAppStore'

const SESSION_IDLE_MS = 5 * 60 * 1000
const MAX_SESSIONS = 20

// ── Markdown renderer (simple inline) ────────────────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  return <div className="prose-glass" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message, onCopy }: { message: ChatMessage; onCopy: (text: string) => void }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = message.content.map((c) => c.text ?? '').join('')
    onCopy(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [message, onCopy])

  if (message.isSmartThinkingStep) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '2px 0' }}>
        <span className="thinking-pill">
          <div className="thinking-dot" />
          <div className="thinking-dot" />
          <div className="thinking-dot" />
          Thinking
        </span>
      </div>
    )
  }

  if (message.isResearchStep) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '2px 0' }}>
        <span className="research-pill">
          {message.researchStepLabel ?? message.researchStepPhase ?? 'Researching…'}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', padding: '3px 0' }}>
      <div
        className={isUser ? 'message-bubble-user' : 'message-bubble-assistant'}
        style={{ position: 'relative' }}
      >
        {/* Images */}
        {message.content.filter((c) => c.type === 'image').map((c, i) => (
          <img
            key={i}
            src={c.imagePreviewUrl ?? `data:${c.imageMimeType};base64,${c.imageBase64}`}
            alt="attachment"
            style={{ maxWidth: 220, maxHeight: 160, borderRadius: 8, marginBottom: 6, display: 'block' }}
          />
        ))}

        {/* Text */}
        {message.isLoading ? (
          <div className="thinking-pill" style={{ display: 'inline-flex' }}>
            <div className="thinking-dot" />
            <div className="thinking-dot" />
            <div className="thinking-dot" />
          </div>
        ) : message.error ? (
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>{message.error}</span>
        ) : (
          <SimpleMarkdown text={message.content.map((c) => c.text ?? '').join('')} />
        )}

        {/* Copy button (assistant only) */}
        {!isUser && !message.isLoading && !message.error && (
          <button
            className="btn-icon"
            onClick={handleCopy}
            style={{
              position: 'absolute', bottom: 4, right: 4,
              opacity: 0, transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0')}
            data-tooltip={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? <IconCheck size={12} style={{ color: 'var(--success)' }} /> : <IconCopy size={12} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Session list item ─────────────────────────────────────────────────────────
function SessionItem({
  session, isActive, onClick, onDelete,
}: {
  session: ChatSession; isActive: boolean; onClick: () => void; onDelete: () => void
}) {
  return (
    <div
      className={`card${isActive ? ' active' : ''}`}
      onClick={onClick}
      style={{
        padding: '9px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        background: isActive ? 'var(--accent-muted)' : 'transparent',
        borderColor: isActive ? 'rgba(10,132,255,0.2)' : 'transparent',
        borderRadius: 10,
      }}
    >
      <span style={{ flex: 1, fontSize: 12, color: isActive ? 'var(--accent)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {session.title || 'New Chat'}
      </span>
      <button
        className="btn-icon"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        style={{ opacity: 0, transition: 'opacity 0.15s', padding: 4, color: 'var(--text-tertiary)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0')}
        data-tooltip="Delete"
      >
        <IconTrash size={12} />
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const chatSessions        = useAppStore((s) => s.chatSessions)
  const activeChatSessionId = useAppStore((s) => s.activeChatSessionId)
  const chatSystemPrompt    = useAppStore((s) => s.chatSystemPrompt)
  const selectedProvider    = useAppStore((s) => s.selectedProvider)
  const selectedModels      = useAppStore((s) => s.selectedModels)
  const chatSendShortcut    = useAppStore((s) => s.chatSendShortcut)
  const createChatSession   = useAppStore((s) => s.createChatSession)
  const deleteChatSession   = useAppStore((s) => s.deleteChatSession)
  const setActiveChatSession = useAppStore((s) => s.setActiveChatSession)
  const addChatMessage      = useAppStore((s) => s.addChatMessage)
  const updateChatMessage   = useAppStore((s) => s.updateChatMessage)
  const addChatSessionCost  = useAppStore((s) => s.addChatSessionCost)

  const t = useT()
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId) ?? null

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages.length])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [input])

  const ensureSession = useCallback((): string => {
    if (activeChatSessionId) return activeChatSessionId
    const model = selectedModels[selectedProvider] ?? ''
    const id = createChatSession(selectedProvider, model)
    setActiveChatSession(id)
    return id
  }, [activeChatSessionId, selectedProvider, selectedModels, createChatSession, setActiveChatSession])

  const handleNewSession = useCallback(() => {
    const model = selectedModels[selectedProvider] ?? ''
    const id = createChatSession(selectedProvider, model)
    setActiveChatSession(id)
    setInput('')
  }, [selectedProvider, selectedModels, createChatSession, setActiveChatSession])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const sessionId = ensureSession()
    setInput('')
    lastActivityRef.current = Date.now()

    const userMsgId = createClientId('msg')
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
    }
    addChatMessage(sessionId, userMsg)

    const assistantMsgId = createClientId('msg')
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      timestamp: Date.now(),
      isLoading: true,
    }
    addChatMessage(sessionId, assistantMsg)

    const model = selectedModels[selectedProvider] ?? ''
    const session = useAppStore.getState().chatSessions.find((s) => s.id === sessionId)
    const history = (session?.messages ?? [])
      .filter((m) => !m.isLoading && !m.error && !m.isSmartThinkingStep && !m.isResearchStep)
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }))

    setIsStreaming(true)
    abortRef.current = new AbortController()
    let reply = ''

    try {
      await chatService.stream(
        {
          provider: selectedProvider,
          model,
          messages: [...history, { role: 'user', content: [{ type: 'text', text }] }],
          systemPrompt: chatSystemPrompt,
        },
        {
          signal: abortRef.current.signal,
          bufferIntervalMs: 60,
          onStart: () => {
            updateChatMessage(sessionId, assistantMsgId, { isLoading: false })
          },
          onToken: (token) => {
            reply += token
            updateChatMessage(sessionId, assistantMsgId, { content: [{ type: 'text', text: reply }] })
          },
          onEnd: (fullReply) => {
            reply = fullReply
            const cost = estimateUsageCost({
              feature: 'chat',
              provider: selectedProvider,
              model,
              inputText: text,
              outputText: fullReply,
            })
            updateChatMessage(sessionId, assistantMsgId, {
              content: [{ type: 'text', text: fullReply }],
              isLoading: false,
              cost,
            })
            if (cost) addChatSessionCost(sessionId, cost)
          },
          onError: (error) => {
            updateChatMessage(sessionId, assistantMsgId, {
              isLoading: false,
              error: localizeChatError(t, { error }, 'Unknown error'),
            })
          },
        },
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updateChatMessage(sessionId, assistantMsgId, {
        isLoading: false,
        error: localizeChatException(t, err, 'Unknown error'),
      })
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, ensureSession, selectedProvider, selectedModels, chatSystemPrompt, addChatMessage, updateChatMessage, addChatSessionCost])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isEnterShortcut = chatSendShortcut === 'modEnter'
      ? e.key === 'Enter' && (e.ctrlKey || e.metaKey)
      : e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey

    if (isEnterShortcut) {
      e.preventDefault()
      handleSend()
    }
  }, [chatSendShortcut, handleSend])

  const handleCopyMessage = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }, [])

  return (
    <div className="page-container" style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
      {/* ── Session sidebar ── */}
      <div style={{
        width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <button
          className="btn btn-glass"
          onClick={handleNewSession}
          style={{ width: '100%', gap: 6, justifyContent: 'center', padding: '8px 12px' }}
        >
          <IconPlus size={14} />
          New Chat
        </button>
        <div className="scroll-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {chatSessions.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 24, padding: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>No sessions yet</span>
            </div>
          ) : (
            [...chatSessions].reverse().map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeChatSessionId}
                onClick={() => setActiveChatSession(session.id)}
                onDelete={() => {
                  deleteChatSession(session.id)
                  if (session.id === activeChatSessionId) setActiveChatSession(null)
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <ModelSelector />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {chatSendShortcut === 'modEnter' ? 'Ctrl+Enter to send' : 'Enter to send'}
          </span>
        </div>

        {/* Messages */}
        <div className="panel glass scroll-area" style={{ flex: 1, borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <span style={{ fontSize: 28 }}>💬</span>
              <p style={{ fontSize: 14, fontWeight: 600 }}>Start a conversation</p>
              <p style={{ fontSize: 12, maxWidth: 260, textAlign: 'center' }}>
                Ask anything — translations, explanations, research, writing assistance
              </p>
            </div>
          ) : (
            <>
              {activeSession.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} onCopy={handleCopyMessage} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Composer */}
        <div className="chat-composer" style={{ flexShrink: 0 }}>
          <textarea
            ref={textareaRef}
            className="chat-composer-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Viezan…"
            rows={1}
          />
          {isStreaming ? (
            <button className="btn btn-danger" onClick={handleStop} style={{ padding: '7px 14px', gap: 5, fontSize: 12 }}>
              <IconStop size={13} />
              Stop
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!input.trim()}
              style={{ padding: '7px 14px' }}
              data-tooltip="Send"
            >
              <IconSend size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
