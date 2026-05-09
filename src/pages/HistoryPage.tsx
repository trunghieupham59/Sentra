import { useState } from 'react'
import { ChatBubbleIcon, type ClockIcon, MicrophoneIcon, SearchIcon, TranslateIcon, XIcon } from '../components/ui/icons'
import { useAppStore, useT } from '../store/useAppStore'
import { tpl } from '../utils/tpl'
import { ChatHistoryTab } from './history/ChatHistoryTab'
import { LiveHistoryTab } from './history/LiveHistoryTab'
import { TranslationHistoryTab } from './history/TranslationHistoryTab'

type HistoryTabId = 'translate' | 'chat' | 'live'

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
        <section className="surface-panel flex-1 min-h-0">

          {/* Header */}
          <div
            className="flex-shrink-0 border-b"
            style={{ borderColor: 'var(--vzn-divider)', background: 'var(--vzn-surface-muted)' }}
          >
            <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-base font-semibold" style={{ color: 'var(--vzn-text-strong)' }}>
                  {t.history_title}
                </h1>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--vzn-text-soft)' }}>
                  {tpl(t.history_total_count, { n: totalCount })}
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <SearchIcon
                  className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                  style={{ color: 'var(--vzn-text-soft)' }}
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.history_search_placeholder}
                  className="search-field"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    title={t.history_search_clear}
                    className="btn-icon btn-icon-xs absolute right-2 top-1/2 -translate-y-1/2 border-transparent bg-transparent shadow-none"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="px-3 pb-3">
              <div className="grid grid-cols-3 gap-2" role="tablist">
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
                        'btn-segment btn-segment-lg min-h-10 rounded-xl border px-2 sm:px-3',
                        isActive ? 'btn-segment-active' : '',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{label}</span>
                      <span
                        className="ui-badge-xs min-w-5 justify-center whitespace-nowrap"
                        style={
                          isActive
                            ? { background: 'var(--vzn-accent)', color: 'var(--vzn-text-inverse)' }
                            : { background: 'var(--vzn-surface-subtle)', color: 'var(--vzn-text-soft)' }
                        }
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

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
