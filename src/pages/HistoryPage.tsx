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

        <div className="app-topbar justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {t.history_title}
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {tpl(t.history_total_count, { n: totalCount })}
            </p>
          </div>

          <div className="relative w-full max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
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
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6
                           rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200
                           dark:text-gray-500 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="segmented-control flex-shrink-0">
          {tabs.map(({ id, label, count, icon: Icon }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={[
                  'flex-1 min-w-0 flex items-center justify-center gap-2 h-9 rounded-md px-3',
                  'text-xs font-medium transition-all duration-150 cursor-pointer',
                  isActive
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
                ].join(' ')}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{label}</span>
                <span className={[
                  'min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none',
                  isActive
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                ].join(' ')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="surface-panel flex-1 min-h-0">
          {activeTab === 'translate' && <TranslationHistoryTab query={query} />}
          {activeTab === 'chat'      && <ChatHistoryTab query={query} />}
          {activeTab === 'live'      && <LiveHistoryTab query={query} />}
        </div>

      </div>
    </div>
  )
}
