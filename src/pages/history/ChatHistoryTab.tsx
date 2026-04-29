import { useState } from 'react'
import { HistoryDeleteButton } from '../../components/ui/HistoryDeleteButton'
import { HistoryEmptyState } from '../../components/ui/HistoryEmptyState'
import { ChatBubbleIcon, CheckIcon, ChevronDownIcon, TrashIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'
import type { ChatSession } from '../../types'
import { formatTime, ProviderBadge } from './historyUtils'

export function ChatHistoryTab() {
  const { chatSessions, deleteChatSession, setActiveChatSession, setActivePage } = useAppStore()
  const t = useT()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const sortedSessions = [...chatSessions].sort((a, b) => b.updatedAt - a.updatedAt)
  const totalCount = sortedSessions.length
  const selectedCount = selectedIds.size
  const isAllSelected = totalCount > 0 && selectedCount === totalCount
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedSessions.map((s) => s.id)))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return
    for (const id of selectedIds) {
      deleteChatSession(id)
    }
    setSelectedIds(new Set())
  }

  const handleOpen = (session: ChatSession) => {
    setActiveChatSession(session.id)
    setActivePage('chat')
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {sortedSessions.length === 0 ? (
        <HistoryEmptyState
          icon={<ChatBubbleIcon className="w-7 h-7 text-gray-300 dark:text-gray-600" />}
          title={t.history_chat_empty}
          desc={t.history_chat_empty_desc}
        />
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex-shrink-0">
            {/* Select all checkbox */}
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <span className={[
                'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                isAllSelected || isIndeterminate
                  ? 'bg-blue-500 border-blue-500'
                  : 'border-gray-300 dark:border-gray-600',
              ].join(' ')}>
                {isAllSelected && (
                  <CheckIcon className="w-2.5 h-2.5 text-white" />
                )}
                {isIndeterminate && !isAllSelected && (
                  <span className="w-2 h-0.5 bg-white rounded-full block" />
                )}
              </span>
              {selectedCount > 0
                ? `${selectedCount} đã chọn`
                : 'Chọn tất cả'
              }
            </button>

            {/* Delete selected button */}
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg
                           bg-red-50 text-red-600 hover:bg-red-100
                           dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40
                           font-medium transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Xóa đã chọn
              </button>
            )}
          </div>

          <ul className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {sortedSessions.map((session) => {
              const isExpanded = expandedId === session.id
              const isSelected = selectedIds.has(session.id)
              const msgCount = session.messages.filter((m) => !m.isLoading && !m.error).length
              const lastMsg = [...session.messages].reverse().find((m) => !m.isLoading && !m.error)
              const preview = lastMsg?.content.find((c) => c.type === 'text')?.text ?? ''

              return (
                <li
                  key={session.id}
                  className={[
                    'transition-colors duration-150',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                  ].join(' ')}
                >
                  <div className="flex items-start px-4 pt-3 pb-2 gap-3">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(session.id) }}
                      className="mt-0.5 flex-shrink-0"
                    >
                      <span className={[
                        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400',
                      ].join(' ')}>
                        {isSelected && (
                          <CheckIcon className="w-2.5 h-2.5 text-white" />
                        )}
                      </span>
                    </button>

                    {/* Content button */}
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
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
                          {formatTime(session.updatedAt, t)}
                        </span>
                      </div>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 pl-11 fade-in">
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
                                  {msg.role === 'user' ? t.history_chat_role_user : t.history_chat_role_ai}
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
        </>
      )}
    </div>
  )
}
