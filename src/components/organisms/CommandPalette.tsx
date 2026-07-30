import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAppStore, useT } from '../../store/useAppStore'
import type { AppPage } from '../../types'
import { Button, Input } from '../ui/atoms'
import {
  BookIcon,
  ChatBubbleIcon,
  ClockIcon,
  GearIcon,
  MicrophoneIcon,
  SearchIcon,
  TranslateIcon,
  XIcon,
} from '../ui/icons'

interface PaletteItem {
  id: string
  label: string
  description: string
  icon: ReactNode
  action: () => void
  keywords: string[]
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase()
    .trim()
}

/** App-level command search with keyboard-first navigation. */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { setActivePage, clearTranslation, openSettings } = useAppStore()
  const t = useT()
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const listboxId = useId()

  const navigate = useCallback((page: AppPage, extra?: () => void) => {
    extra?.()
    setActivePage(page)
    onClose()
  }, [onClose, setActivePage])

  const items = useMemo<PaletteItem[]>(() => [
    {
      id: 'chat',
      label: t.nav_chat,
      description: t.command_palette_chat_description,
      icon: <ChatBubbleIcon className="h-4 w-4" />,
      action: () => navigate('chat'),
      keywords: ['chat', 'ai', 'message', 'conversation'],
    },
    {
      id: 'translate',
      label: t.nav_translate,
      description: t.command_palette_translate_description,
      icon: <TranslateIcon className="h-4 w-4" />,
      action: () => navigate('translate', clearTranslation),
      keywords: ['translate', 'translation', 'language', 'text', 'image', 'voice'],
    },
    {
      id: 'live',
      label: t.nav_live_translate,
      description: t.command_palette_live_description,
      icon: <MicrophoneIcon className="h-4 w-4" />,
      action: () => navigate('live'),
      keywords: ['live', 'speech', 'microphone', 'real-time', 'subtitle'],
    },
    {
      id: 'dictionary',
      label: t.nav_dictionary,
      description: t.command_palette_dictionary_description,
      icon: <BookIcon className="h-4 w-4" />,
      action: () => navigate('dictionary'),
      keywords: ['dictionary', 'lookup', 'word', 'definition', 'meaning'],
    },
    {
      id: 'history',
      label: t.nav_history,
      description: t.command_palette_history_description,
      icon: <ClockIcon className="h-4 w-4" />,
      action: () => navigate('history'),
      keywords: ['history', 'past', 'log', 'previous'],
    },
    {
      id: 'settings',
      label: t.nav_settings,
      description: t.command_palette_settings_description,
      icon: <GearIcon className="h-4 w-4" />,
      action: () => {
        onClose()
        openSettings()
      },
      keywords: ['settings', 'preferences', 'api', 'key', 'config', 'hotkey', 'shortcut'],
    },
  ], [clearTranslation, navigate, onClose, openSettings, t])

  const normalizedQuery = normalizeSearchValue(query)
  const filtered = useMemo(() => (
    normalizedQuery
      ? items.filter((item) => [item.label, item.description, ...item.keywords]
        .some(value => normalizeSearchValue(value).includes(normalizedQuery)))
      : items
  ), [items, normalizedQuery])

  const activeItem = filtered[highlighted]
  const activeOptionId = activeItem ? `${listboxId}-${activeItem.id}` : undefined

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setQuery('')
    setHighlighted(0)
    const frame = requestAnimationFrame(() => inputRef.current?.focus())

    return () => {
      cancelAnimationFrame(frame)
      const previousFocus = previousFocusRef.current
      previousFocusRef.current = null
      previousFocus?.focus()
    }
  }, [open])

  useEffect(() => {
    setHighlighted(current => Math.min(current, Math.max(0, filtered.length - 1)))
  }, [filtered.length])

  useEffect(() => {
    if (!open || filtered.length === 0) return
    itemRefs.current[highlighted]?.scrollIntoView({ block: 'nearest' })
  }, [filtered.length, highlighted, open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        const input = inputRef.current
        const closeButton = closeButtonRef.current
        if (!input || !closeButton) return

        if (event.shiftKey) {
          (document.activeElement === input ? closeButton : input).focus()
        } else {
          (document.activeElement === closeButton ? input : closeButton).focus()
        }
        return
      }

      if (filtered.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlighted(current => (current + 1) % filtered.length)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlighted(current => (current - 1 + filtered.length) % filtered.length)
      } else if (event.key === 'Home') {
        event.preventDefault()
        setHighlighted(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        setHighlighted(filtered.length - 1)
      } else if (event.key === 'Enter') {
        event.preventDefault()
        filtered[highlighted]?.action()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, highlighted, onClose, open])

  if (!open) return null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop is pointer-only; the dialog owns Escape handling.
    <div
      className="modal-backdrop cmd-palette-backdrop titlebar-no-drag"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal-surface cmd-palette-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t.nav_command_palette}
      >
        <div className="cmd-palette-input-row">
          <SearchIcon className="cmd-palette-search-icon" />
          <Input
            ref={inputRef}
            size="lg"
            className="cmd-palette-input"
            type="search"
            role="combobox"
            aria-label={t.command_palette_search_placeholder}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded="true"
            aria-activedescendant={activeOptionId}
            placeholder={t.command_palette_search_placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlighted(0)
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            ref={closeButtonRef}
            size="lg"
            shape="icon"
            variant="neutral"
            appearance="ghost"
            className="cmd-palette-close"
            aria-label={t.command_palette_hint_close}
            onClick={onClose}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        <div
          id={listboxId}
          className="cmd-palette-list"
          role="listbox"
          aria-label={t.nav_command_palette}
        >
          {filtered.map((item, index) => {
            const isHighlighted = index === highlighted
            return (
              <Button
                ref={(node) => { itemRefs.current[index] = node }}
                key={item.id}
                id={`${listboxId}-${item.id}`}
                size="lg"
                shape="rect"
                variant={isHighlighted ? 'primary' : 'neutral'}
                appearance={isHighlighted ? 'soft' : 'ghost'}
                className={`cmd-palette-item${isHighlighted ? ' highlighted' : ''}`}
                role="option"
                aria-label={`${item.label}. ${item.description}`}
                aria-selected={isHighlighted}
                tabIndex={-1}
                data-command-id={item.id}
                onMouseEnter={() => setHighlighted(index)}
                onFocus={() => setHighlighted(index)}
                onClick={item.action}
              >
                <span className="cmd-palette-item-icon">{item.icon}</span>
                <span className="cmd-palette-item-copy">
                  <span className="cmd-palette-item-name">{item.label}</span>
                  <span className="cmd-palette-item-description">{item.description}</span>
                </span>
                <kbd className="keyboard-key cmd-palette-enter-hint">↵</kbd>
              </Button>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="cmd-palette-empty" role="status" aria-live="polite">
            <SearchIcon className="cmd-palette-empty-icon" />
            <span>{t.command_palette_no_results}</span>
            <span className="cmd-palette-empty-query">{query.trim()}</span>
          </div>
        )}

        <div className="cmd-palette-footer" aria-hidden="true">
          <span className="cmd-palette-hint">
            <kbd className="keyboard-key">↑↓</kbd>
            {t.command_palette_hint_navigate}
          </span>
          <span className="cmd-palette-hint">
            <kbd className="keyboard-key">↵</kbd>
            {t.command_palette_hint_open}
          </span>
          <span className="cmd-palette-hint">
            <kbd className="keyboard-key">esc</kbd>
            {t.command_palette_hint_close}
          </span>
        </div>
      </div>
    </div>
  )
}
