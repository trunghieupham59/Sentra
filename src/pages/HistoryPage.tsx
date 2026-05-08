import { useState } from 'react'
import { ChatBubbleIcon, type ClockIcon, MicrophoneIcon, SearchIcon, TranslateIcon, XIcon } from '../components/ui/icons'
import { useAppStore, useT } from '../store/useAppStore'
import { tpl } from '../utils/tpl'
import { ChatHistoryTab } from './history/ChatHistoryTab'
import { LiveHistoryTab } from './history/LiveHistoryTab'
import { TranslationHistoryTab } from './history/TranslationHistoryTab'

type HistoryTabId = 'translate' | 'chat' | 'live'

// ─── Main HistoryPage ──────────────────────────────────────────────────────────
export function HistoryPage() {
  const { history, chatSessions, liveSessions } = useAppStore()
  const t = useT()
  const [activeTab, setActiveTab] = useState<HistoryTabId>('chat')
  const [query, setQuery] = useState('')
  const totalCount = history.length + chatSessions.length + liveSessions.length

  const tabs = ([
    { id: 'chat', label: t.history_tab_chat, count: chatSessions.length, icon: ChatBubbleIcon },
    { id: 'translate', label: t.history_tab_translate, count: history.length, icon: TranslateIcon },
    { id: 'live', label: t.history_tab_live, count: liveSessions.length, icon: MicrophoneIcon },
  ] satisfies Array<{ id: HistoryTabId; label: string; count: number; icon: typeof ClockIcon }>)

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--apple-bg-primary)' }}
    >
      {/* ── Apple-style translucent toolbar ── */}
      <div
        className="apple-toolbar flex-shrink-0 flex items-center justify-between px-4 gap-4"
        style={{ height: '52px', zIndex: 20 }}
      >
        {/* Title + count */}
        <div className="flex-shrink-0">
          <h1
            className="text-[15px] font-semibold leading-[20px]"
            style={{ color: 'var(--apple-label-primary)' }}
          >
            {t.history_title}
          </h1>
          <p
            className="text-[12px] leading-[16px] mt-0.5"
            style={{ color: 'var(--apple-label-secondary)' }}
          >
            {tpl(t.history_total_count, { n: totalCount })}
          </p>
        </div>

        {/* Search input — Apple style */}
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--apple-label-tertiary)] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.history_search_placeholder}
            className={[
              'w-full h-8 rounded-lg pl-8 pr-8 text-[13px]',
              'bg-[var(--apple-fill-tertiary)] text-[var(--apple-label-primary)]',
              'placeholder:text-[var(--apple-label-tertiary)] outline-none select-text',
              'focus:bg-[var(--apple-fill-secondary)] transition-colors duration-150',
            ].join(' ')}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              title={t.history_search_clear}
              aria-label={t.history_search_clear}
              className={[
                'absolute right-2 top-1/2 -translate-y-1/2',
                'flex items-center justify-center w-4 h-4 rounded-full',
                'bg-[var(--apple-fill-secondary)] text-[var(--apple-label-secondary)]',
                'hover:bg-[var(--apple-fill-primary)] transition-colors duration-150',
              ].join(' ')}
            >
              <XIcon className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar — Apple segmented control ── */}
      <div
        className="flex-shrink-0 px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--apple-separator)' }}
      >
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-xl"
          style={{ background: 'var(--apple-fill-quaternary)' }}
          role="tablist"
        >
          {tabs.map(({ id, label, count, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(id)}
                className={[
                  'flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg',
                  'text-[13px] font-medium transition-all duration-150 select-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]',
                  isActive
                    ? 'bg-[#007AFF] dark:bg-[#0A84FF] text-white shadow-sm'
                    : 'text-[var(--apple-label-secondary)] hover:text-[var(--apple-label-primary)]',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{label}</span>
                <span
                  className={[
                    'inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] px-1',
                    'text-[10px] font-medium tabular-nums whitespace-nowrap',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--apple-fill-secondary)] text-[var(--apple-label-secondary)]',
                  ].join(' ')}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex flex-1 min-h-0 flex-col">
        {activeTab === 'translate' && <TranslationHistoryTab query={query} />}
        {activeTab === 'chat' && <ChatHistoryTab query={query} />}
        {activeTab === 'live' && <LiveHistoryTab query={query} />}
      </div>
    </div>
  )
}
