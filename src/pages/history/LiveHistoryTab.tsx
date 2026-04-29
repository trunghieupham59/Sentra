import { useState } from 'react'
import { MarkdownText } from '../../components/MarkdownText'
import { HistoryBulkHeader } from '../../components/ui/HistoryBulkHeader'
import { HistoryDeleteButton } from '../../components/ui/HistoryDeleteButton'
import { HistoryEmptyState } from '../../components/ui/HistoryEmptyState'
import { CheckIcon, ChevronDownIcon, MicrophoneIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'
import { tpl } from '../../utils/tpl'
import { formatTime, historyMatches, langLabel, normalizeHistoryQuery, ProviderBadge } from './historyUtils'

/** Số ký tự preview hiển thị trong danh sách live session history */
const LIVE_HISTORY_PREVIEW_CHARS = 120

interface LiveHistoryTabProps {
  query: string
}

export function LiveHistoryTab({ query }: LiveHistoryTabProps) {
  const { liveSessions, deleteLiveSession, setActivePage, setViewingLiveSession } = useAppStore()
  const t = useT()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const normalizedQuery = normalizeHistoryQuery(query)
  const filteredSessions = liveSessions.filter((session) => historyMatches(normalizedQuery, [
    session.rawTranscript,
    session.translation,
    session.summary,
    session.actionItems,
    session.decisions,
    session.speakerAnalysis,
    session.sourceLang,
    session.targetLang,
    langLabel(session.sourceLang),
    langLabel(session.targetLang),
    session.provider,
    session.model,
  ]))
  const filteredIds = filteredSessions.map((session) => session.id)
  const selectedVisibleIds = filteredIds.filter((id) => selectedIds.has(id))
  const selectedCount = selectedVisibleIds.length

  // Open the live page and restore the selected session's content for viewing.
  const handleOpenLive = (sessionId: string) => {
    setViewingLiveSession(sessionId)
    setActivePage('live')
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredIds))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedCount === 0) return
    for (const id of selectedVisibleIds) {
      deleteLiveSession(id)
    }
    setSelectedIds(new Set())
  }

  return (
    <div className="flex flex-col h-full">
      {liveSessions.length > 0 && (
        <HistoryBulkHeader
          countLabel={tpl(t.history_live_count, { n: filteredSessions.length })}
          totalCount={filteredSessions.length}
          selectedCount={selectedCount}
          labelSelectAll={t.history_select_all}
          labelSelected={tpl(t.history_selected_count, { n: selectedCount })}
          labelDeleteSelected={t.history_delete_selected}
          onSelectAll={handleSelectAll}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {liveSessions.length === 0 ? (
          <HistoryEmptyState
            icon={<MicrophoneIcon className="w-7 h-7 text-purple-300 dark:text-purple-700" />}
            title={t.history_live_empty}
            desc={t.history_live_empty_desc}
            tone="purple"
          />
        ) : filteredSessions.length === 0 ? (
          <HistoryEmptyState
            icon={<MicrophoneIcon className="w-7 h-7" />}
            title={t.history_no_results}
            desc={t.history_no_results_desc}
            tone="purple"
          />
        ) : (
          <ul className="p-3 space-y-2">
            {filteredSessions.map((session) => {
              const isExpanded = expandedId === session.id
              const isSelected = selectedIds.has(session.id)
              const previewRaw = session.rawTranscript.slice(0, LIVE_HISTORY_PREVIEW_CHARS)
              const previewTx  = session.translation.slice(0, LIVE_HISTORY_PREVIEW_CHARS)

              return (
                <li
                  key={session.id}
                  className={[
                    'group rounded-lg border transition-colors duration-150',
                    isSelected
                      ? 'border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/20'
                      : 'border-gray-100 bg-white hover:border-purple-100 hover:bg-purple-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-950 dark:hover:bg-gray-800/50',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(session.id) }}
                      className="mt-0.5 flex-shrink-0"
                    >
                      <span className={[
                        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-purple-500 border-purple-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-purple-400',
                      ].join(' ')}>
                        {isSelected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug line-clamp-2 font-medium">
                            {previewRaw}{session.rawTranscript.length > LIVE_HISTORY_PREVIEW_CHARS ? '…' : ''}
                          </p>
                          {previewTx && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-1 line-clamp-1">
                              {previewTx}{session.translation.length > LIVE_HISTORY_PREVIEW_CHARS ? '…' : ''}
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
                          {langLabel(session.sourceLang)} → {langLabel(session.targetLang)}
                        </span>
                        <span className="text-[10px] text-purple-400 dark:text-purple-600">
                          {session.wordCount.toLocaleString()} {t.history_live_words}
                        </span>
                        <span className="text-[10px] text-gray-300 dark:text-gray-700 ml-auto">
                          {formatTime(session.createdAt, t)}
                        </span>
                      </div>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 pl-11 fade-in space-y-2">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-lg">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {langLabel(session.sourceLang)} · {t.live_panel_original}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {session.rawTranscript}
                          </p>
                        </div>
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-lg">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {langLabel(session.targetLang)} · {t.live_panel_translation}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {session.translation}
                          </p>
                        </div>
                      </div>

                      {/* Summary (if any) */}
                      {session.summary && (
                        <div className="rounded-lg border border-purple-100 dark:border-purple-900/40
                                        bg-purple-50/50 dark:bg-purple-950/10 px-3 py-2 text-xs">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-500 dark:text-purple-400 mb-1.5">
                            {t.live_summary_title}
                          </p>
                          <MarkdownText
                            text={session.summary}
                            className="text-purple-800 dark:text-purple-200"
                          />
                        </div>
                      )}

                      {/* Action Items (if any) */}
                      {session.actionItems && (
                        <div className="rounded-lg border border-amber-100 dark:border-amber-900/40
                                        bg-amber-50/50 dark:bg-amber-950/10 px-3 py-2 text-xs">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1.5">
                            {t.live_action_items}
                          </p>
                          <MarkdownText
                            text={session.actionItems}
                            className="text-amber-800 dark:text-amber-200"
                          />
                        </div>
                      )}

                      {/* Decisions (if any) */}
                      {session.decisions && (
                        <div className="rounded-lg border border-green-100 dark:border-green-900/40
                                        bg-green-50/50 dark:bg-green-950/10 px-3 py-2 text-xs">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600 dark:text-green-400 mb-1.5">
                            {t.live_decisions}
                          </p>
                          <MarkdownText
                            text={session.decisions}
                            className="text-green-800 dark:text-green-200"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenLive(session.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                     bg-purple-50 text-purple-600 hover:bg-purple-100
                                     dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900
                                     font-medium transition-colors"
                        >
                          <MicrophoneIcon className="w-3.5 h-3.5" />
                          {t.history_live_view}
                        </button>
                        <HistoryDeleteButton onClick={() => deleteLiveSession(session.id)} label={t.history_live_delete} />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
