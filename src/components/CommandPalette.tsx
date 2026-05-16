import { useEffect, useRef, useState } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import type { AppPage } from '../types'
import { BookIcon, ChatBubbleIcon, ClockIcon, GearIcon, MicrophoneIcon, TranslateIcon } from './ui/icons'

interface PaletteItem {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { setActivePage, clearTranslation, openSettings } = useAppStore()
  const t = useT()
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const navigate = (page: AppPage, extra?: () => void) => {
    extra?.()
    setActivePage(page)
    onClose()
  }

  const items: PaletteItem[] = [
    {
      id: 'chat',
      label: t.nav_chat,
      description: 'AI chat with Claude, GPT, Gemini',
      icon: <ChatBubbleIcon className="w-4 h-4" />,
      action: () => navigate('chat'),
      keywords: ['chat', 'ai', 'message', 'conversation'],
    },
    {
      id: 'translate',
      label: t.nav_translate,
      description: 'Translate text, images, and voice',
      icon: <TranslateIcon className="w-4 h-4" />,
      action: () => navigate('translate', clearTranslation),
      keywords: ['translate', 'translation', 'language'],
    },
    {
      id: 'live',
      label: t.nav_live_translate,
      description: 'Real-time speech translation',
      icon: <MicrophoneIcon className="w-4 h-4" />,
      action: () => navigate('live'),
      keywords: ['live', 'speech', 'microphone', 'real-time', 'subtitle'],
    },
    {
      id: 'dictionary',
      label: t.nav_dictionary,
      description: 'Look up words and definitions',
      icon: <BookIcon className="w-4 h-4" />,
      action: () => navigate('dictionary'),
      keywords: ['dictionary', 'lookup', 'word', 'definition', 'meaning'],
    },
    {
      id: 'history',
      label: t.nav_history,
      description: 'Browse past translations and chats',
      icon: <ClockIcon className="w-4 h-4" />,
      action: () => navigate('history'),
      keywords: ['history', 'past', 'log', 'previous'],
    },
    {
      id: 'settings',
      label: t.nav_settings,
      description: 'API keys, preferences, hotkeys',
      icon: <GearIcon className="w-4 h-4" />,
      action: () => { openSettings(); onClose() },
      keywords: ['settings', 'preferences', 'api', 'key', 'config', 'hotkey'],
    },
  ]

  const filtered = query.trim()
    ? items.filter(item => {
        const q = query.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.keywords.some(k => k.includes(q))
        )
      })
    : items

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlighted(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Keep highlighted in bounds
  useEffect(() => {
    setHighlighted(h => Math.min(h, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted(h => Math.min(h + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted(h => Math.max(h - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        filtered[highlighted]?.action()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, highlighted, filtered, onClose])

  if (!open) return null

  const isMac = window.api?.platform === 'darwin'

  return (
    <div
      className="cmd-palette-backdrop"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="cmd-palette-panel">
        {/* Search input */}
        <div className="cmd-palette-input-row">
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--vzn-text-soft)' }} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-palette-input"
            type="text"
            placeholder="Navigate to..."
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlighted(0) }}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="cmd-palette-item-hint">
            <span className="keyboard-key">esc</span>
          </span>
        </div>

        {/* Items list */}
        <div ref={listRef} className="cmd-palette-list">
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--vzn-text-soft)', fontSize: '13px' }}>
              No results for "{query}"
            </div>
          ) : (
            <>
              <div className="cmd-palette-section-label">Navigation</div>
              {filtered.map((item, i) => (
                <div
                  key={item.id}
                  className={`cmd-palette-item${i === highlighted ? ' highlighted' : ''}`}
                  onMouseEnter={() => setHighlighted(i)}
                  onClick={item.action}
                >
                  <div className="cmd-palette-item-icon">
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cmd-palette-item-name">{item.label}</div>
                    <div className="cmd-palette-item-hint" style={{ marginTop: '1px' }}>{item.description}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="cmd-palette-footer">
          <span className="cmd-palette-hint">
            <span className="keyboard-key">↑↓</span>
            navigate
          </span>
          <span className="cmd-palette-hint">
            <span className="keyboard-key">↵</span>
            open
          </span>
          <span className="cmd-palette-hint">
            <span className="keyboard-key">{isMac ? '⌘K' : 'Ctrl K'}</span>
            toggle
          </span>
        </div>
      </div>
    </div>
  )
}
