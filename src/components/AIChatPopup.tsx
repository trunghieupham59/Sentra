import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { chatService } from '../services/chatService'
import type { ChatMessage } from '../types'
import { createClientId } from '../utils/id'
import { localizeChatException } from '../utils/chatErrors'
import { useT } from '../store/useAppStore'
import { IconSend, IconClose, IconStop } from './icons/AppIcons'

function SimpleMarkdown({ text }: { text: string }) {
  return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</span>
}

export function AIChatPopup() {
  const selectedProvider = useAppStore((s) => s.selectedProvider)
  const selectedModels   = useAppStore((s) => s.selectedModels)
  const t = useT()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [input])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    const model = selectedModels[selectedProvider] ?? ''

    const userMsg: ChatMessage = {
      id: createClientId('msg'),
      role: 'user',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
    }
    const assistantId = createClientId('msg')
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      timestamp: Date.now(),
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)
    abortRef.current = new AbortController()
    let reply = ''

    try {
      await chatService.stream(
        {
          provider: selectedProvider,
          model,
          messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: [{ type: 'text', text }] }],
        },
        {
          signal: abortRef.current.signal,
          bufferIntervalMs: 60,
          onStart: () => {
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, isLoading: false } : m))
          },
          onToken: (token) => {
            reply += token
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: [{ type: 'text', text: reply }] } : m))
          },
          onEnd: (full) => {
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: [{ type: 'text', text: full }], isLoading: false } : m))
          },
          onError: (error) => {
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, isLoading: false, error } : m))
          },
        },
      )
    } catch (err) {
      const msg = localizeChatException(t, err, 'Error')
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, isLoading: false, error: msg } : m))
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, messages, selectedProvider, selectedModels, t])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }, [handleSend])

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'rgba(8,8,17,0.92)', backdropFilter: 'blur(40px)',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      {/* Header */}
      <div
        className="titlebar-drag"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Quick Chat</span>
        <button
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
          onClick={() => window.api?.quickChat?.hide?.()}
        >
          <IconClose size={14} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            Ask anything…
          </div>
        ) : messages.map((msg) => (
          <div key={msg.id} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            background: msg.role === 'user' ? '#0A84FF' : 'rgba(255,255,255,0.1)',
            border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.12)' : 'none',
            borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            padding: '8px 12px', maxWidth: '85%', fontSize: 13,
            color: 'rgba(255,255,255,0.92)',
          }}>
            {msg.isLoading ? <span style={{ opacity: 0.5 }}>…</span>
              : msg.error ? <span style={{ color: '#FF453A' }}>{msg.error}</span>
              : <SimpleMarkdown text={msg.content.map((c) => c.text ?? '').join('')} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: '7px 12px', color: 'rgba(255,255,255,0.9)',
            fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit',
            maxHeight: 120,
          }}
        />
        {isStreaming ? (
          <button onClick={() => abortRef.current?.abort()} style={{ background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 10, padding: '7px 14px', color: '#FF453A', cursor: 'pointer', fontSize: 12 }}>
            <IconStop size={13} /> Stop
          </button>
        ) : (
          <button onClick={handleSend} disabled={!input.trim()} style={{ background: '#0A84FF', border: 'none', borderRadius: 10, padding: '7px 12px', color: '#fff', cursor: 'pointer', opacity: !input.trim() ? 0.4 : 1 }}>
            <IconSend size={15} />
          </button>
        )}
      </div>
    </div>
  )
}
