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
    <div className="app-page">
      <div className="app-workspace">
        <section className="glass-panel flex-1 min-h-0 flex flex-col">

          {/* Header row */}
          <div className="page-section-header flex-wrap gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold" style={{ color: 'var(--vzn-text-strong)' }}>{t.history_title}</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--vzn-text-soft)' }}>{tpl(t.history_total_count, { n: totalCount })}</p>
            </div>
            <div className="relative flex-shrink-0 w-full sm:w-60">
              <SearchIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.history_search_placeholder} className="search-field" />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="btn-icon btn-icon-xs absolute right-2 top-1/2 -translate-y-1/2" style={{ border: 'none', background: 'transparent' }}>
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex-shrink-0 flex gap-1.5 px-3 py-2.5" style={{ borderBottom: '1px solid var(--vzn-border)' }}>
            {tabs.map(({ id, label, count, icon: Icon }) => {
              const isActive = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(id)}
                  className={`btn-segment flex-1 gap-2 rounded-lg ${isActive ? 'btn-segment-active' : ''}`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate text-sm">{label}</span>
                  <span className="ui-badge-xs" style={isActive ? { background: 'var(--vzn-accent)', color: '#fff', borderColor: 'transparent' } : {}}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="flex flex-1 min-h-0 flex-col">
            {activeTab === 'translate' && <TranslationHistoryTab query={query} />}
            {activeTab === 'chat' && <ChatHistoryTab query={query} />}
            {activeTab === 'live' && <LiveHistoryTab query={query} />}
          </div>

        </section>
      </div>
    </div>
  )
}
