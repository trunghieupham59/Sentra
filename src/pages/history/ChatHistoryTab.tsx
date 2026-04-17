import { useState } from 'react'
import { useAppStore, useT } from '../../store/useAppStore'
import type { ChatSession } from '../../types'
import { ChatBubbleIcon, ChevronDownIcon } from '../../components/ui/icons'
import { HistoryDeleteButton } from '../../components/ui/HistoryDeleteButton'
import { formatTime, ProviderBadge } from './historyUtils'

export function ChatHistoryTab() {
  const { chatSessions, deleteChatSession, setActiveChatSession, setActivePage } = useAppStore()
  const t = useT()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleOpen = (session: ChatSession) => {
    setActiveChatSession(session.id)
    setActivePage('chat')
  }

  const sortedSessions = [...chatSessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="flex-1 overflow-y-auto">
      {sortedSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <ChatBubbleIcon className="w-7 h-7 text-gray-300 dark:text-gray-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.history_chat_empty}</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{t.history_chat_empty_desc}</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800/60">
          {sortedSessions.map((session) => {
            const isExpanded = expandedId === session.id
            const msgCount = session.messages.filter((m) => !m.isLoading && !m.error).length
            const lastMsg = [...session.messages].reverse().find((m) => !m.isLoading && !m.error)
            const preview = lastMsg?.content.find((c) => c.type === 'text')?.text ?? ''

            return (
              <li key={session.id} className="group bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <button
                  type="button"
                  className="w-full text-left px-4 pt-3 pb-2"
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug line-clamp-1 font-medium">
                        {session.title}
                      </p>
                      {preview && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-1 line-clamp-2">
                          {preview}
                        </p>
                      )}
                    </div>
                    <ChevronDownIcon
                      className={`flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <ProviderBadge provider={session.provider} />
                    <span className="text-[10px] text-gray-400 dark:text-gray-600">
                      {msgCount} {t.history_chat_messages}
                    </span>
                    <span className="text-[10px] text-gray-300 dark:text-gray-700 ml-auto">
                      {formatTime(session.updatedAt)}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 fade-in">
                    {/* Message preview */}
                    {session.messages.filter((m) => !m.isLoading && !m.error).length > 0 && (
                      <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden text-xs mb-2 max-h-40 overflow-y-auto">
                        {session.messages.filter((m) => !m.isLoading && !m.error).slice(-4).map((msg) => {
                          const text = msg.content.find((c) => c.type === 'text')?.text ?? ''
                          if (!text) return null
                          return (
                            <div
                              key={msg.id}
                              className={`px-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0
                                          ${msg.role === 'user'
                                            ? 'bg-blue-50 dark:bg-blue-950/20'
                                            : 'bg-white dark:bg-gray-900'}`}
                            >
                              <p className="text-[10px] font-semibold text-gray-400 mb-0.5">
                                {msg.role === 'user' ? 'You' : 'AI'}
                              </p>
                              <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{text}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpen(session)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                   bg-blue-50 text-blue-600 hover:bg-blue-100
                                   dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900
                                   font-medium transition-colors"
                      >
                        <ChatBubbleIcon className="w-3.5 h-3.5" />
                        {t.history_chat_open}
                      </button>
                      <HistoryDeleteButton onClick={() => deleteChatSession(session.id)} label={t.history_chat_delete} />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
