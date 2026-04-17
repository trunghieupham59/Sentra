import { useState } from 'react'
import { useAppStore, useT } from '../../store/useAppStore'
import { MarkdownText } from '../../components/MarkdownText'
import { ChevronDownIcon, MicrophoneIcon } from '../../components/ui/icons'
import { HistoryDeleteButton } from '../../components/ui/HistoryDeleteButton'
import { formatTime, langLabel, ProviderBadge } from './historyUtils'

export function LiveHistoryTab() {
  const { liveSessions, deleteLiveSession, clearLiveSessions, setActivePage } = useAppStore()
  const t = useT()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  // Note: Live page does not support "replay" mode — clicking opens a new recording session.
  // The session content is visible in the expanded card above (rawTranscript + translation).
  const handleOpenLive = () => {
    setActivePage('live')
  }

  const handleClearAll = () => {
    if (confirmClear) {
      clearLiveSessions()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {liveSessions.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
                        bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-400">
            {liveSessions.length} {liveSessions.length === 1 ? 'session' : 'sessions'}
          </span>
          <button
            type="button"
            onClick={handleClearAll}
            onBlur={() => setTimeout(() => setConfirmClear(false), 200)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 ${
              confirmClear
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            {confirmClear ? t.history_live_clear_confirm : t.history_live_clear_all}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {liveSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
              <MicrophoneIcon className="w-7 h-7 text-purple-300 dark:text-purple-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.history_live_empty}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{t.history_live_empty_desc}</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {liveSessions.map((session) => {
              const isExpanded = expandedId === session.id
              const previewRaw = session.rawTranscript.slice(0, 120)
              const previewTx  = session.translation.slice(0, 120)

              return (
                <li key={session.id} className="group bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <button
                    type="button"
                    className="w-full text-left px-4 pt-3 pb-2"
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug line-clamp-2 font-medium">
                          {previewRaw}{session.rawTranscript.length > 120 ? '…' : ''}
                        </p>
                        {previewTx && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-1 line-clamp-1">
                            {previewTx}{session.translation.length > 120 ? '…' : ''}
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
                        {formatTime(session.createdAt)}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 fade-in space-y-2">
                      {/* Original transcript */}
                      <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden text-xs">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {langLabel(session.sourceLang)} · {t.live_panel_original}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
                            {session.rawTranscript}
                          </p>
                        </div>
                        <div className="px-3 py-2">
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

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenLive()}
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
