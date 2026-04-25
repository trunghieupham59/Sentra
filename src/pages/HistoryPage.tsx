import { useState } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { ChatHistoryTab } from './history/ChatHistoryTab'
import { LiveHistoryTab } from './history/LiveHistoryTab'
import { TranslationHistoryTab } from './history/TranslationHistoryTab'

// ─── Main HistoryPage ──────────────────────────────────────────────────────────
export function HistoryPage() {
  const { history, chatSessions, liveSessions } = useAppStore()
  const t = useT()
  const [activeTab, setActiveTab] = useState<'translate' | 'chat' | 'live'>('chat')

  const tabs = ([
    ['chat',      t.history_tab_chat,      chatSessions.length],
    ['translate', t.history_tab_translate, history.length],
    ['live',      t.history_tab_live,      liveSessions.length],
  ] as ['translate' | 'chat' | 'live', string, number][])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      <div className="px-6 pt-6 pb-4 flex flex-col gap-4 flex-1 min-h-0">

        {/* ── Title + segmented tab bar ── */}
        <div className="flex items-center justify-between flex-shrink-0">
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t.history_title}
          </h1>

          {/* Segmented control — matches the pill / card language from other screens */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-0.5">
            {tabs.map(([tab, label, count]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer
                            ${activeTab === tab
                              ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm'
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                    ${activeTab === tab
                                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content card — mirrors the card style used in TranslatePage / ChatPage ── */}
        <div className="flex-1 min-h-0 rounded-2xl border border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900 shadow-sm overflow-hidden flex flex-col">
          {activeTab === 'translate' && <TranslationHistoryTab />}
          {activeTab === 'chat'      && <ChatHistoryTab />}
          {activeTab === 'live'      && <LiveHistoryTab />}
        </div>

      </div>
    </div>
  )
}
