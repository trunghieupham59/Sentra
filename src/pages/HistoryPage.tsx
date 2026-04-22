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

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 pt-3 pb-0">
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.history_title}</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-4 mt-2">
          {([
            ['chat',      t.history_tab_chat,      chatSessions.length],
            ['translate', t.history_tab_translate, history.length],
            ['live',      t.history_tab_live,       liveSessions.length],
          ] as ['translate' | 'chat' | 'live', string, number][]).map(([tab, label, count]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all duration-150 cursor-pointer
                          ${activeTab === tab
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                  ${activeTab === tab
                                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'translate' && <TranslationHistoryTab />}
        {activeTab === 'chat'      && <ChatHistoryTab />}
        {activeTab === 'live'      && <LiveHistoryTab />}
      </div>
    </div>
  )
}
