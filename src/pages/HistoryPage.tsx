import { useState } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { HistoryItem, ChatSession, LiveSession } from '../types'
import { PROVIDERS } from '../constants/providers'
import { MarkdownText } from '../components/MarkdownText'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return d.toLocaleDateString()
}

function langLabel(code: string): string {
  if (code === 'auto') return 'Auto'
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

function ProviderBadge({ provider }: { provider: string }) {
  const p = PROVIDERS.find((x) => x.id === provider)
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded
                     bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {p?.emoji ?? '🤖'} {p?.name ?? provider}
    </span>
  )
}

// ─── Translation history tab ───────────────────────────────────────────────────
function TranslationHistoryTab() {
  const { history, deleteHistoryItem, clearHistory, setActivePage, setSourceText, setTranslatedText, setSourceLang, setTargetLang } = useAppStore()
  const t = useT()
  const [confirmClear, setConfirmClear] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const handleReuse = (item: HistoryItem) => {
    setSourceText(item.sourceText)
    setTranslatedText(item.translatedText)
    setSourceLang(item.sourceLang)
    setTargetLang(item.targetLang)
    setActivePage('translate')
  }

  const handleClearAll = () => {
    if (confirmClear) {
      clearHistory()
      setConfirmClear(false)
    } else {
      setConfirmClear(true)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      {history.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
                        bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-400">
            {history.length} {history.length === 1 ? 'entry' : 'entries'}
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
            {confirmClear ? t.history_clear_confirm : t.history_clear_all}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t.history_empty}</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{t.history_empty_desc}</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {history.map((item) => {
              const isExpanded = expandedId === item.id
              return (
                <li key={item.id} className="group bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <button
                    type="button"
                    className="w-full text-left px-4 pt-3 pb-2"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug line-clamp-2 font-medium">
                          {item.sourceText}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-1 line-clamp-1">
                          {item.translatedText}
                        </p>
                      </div>
                      <svg
                        className={`flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <ProviderBadge provider={item.provider} />
                      <span className="text-[10px] text-gray-400 dark:text-gray-600">
                        {langLabel(item.sourceLang)} → {langLabel(item.targetLang)}
                      </span>
                      <span className="text-[10px] text-gray-300 dark:text-gray-700 ml-auto">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-3 fade-in">
                      <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden text-xs">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {langLabel(item.sourceLang)} · {item.sourceText.length.toLocaleString()} {t.history_chars_source}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {item.sourceText}
                          </p>
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {langLabel(item.targetLang)} · {item.translatedText.length.toLocaleString()} {t.history_chars_result}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {item.translatedText}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleReuse(item)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                     bg-blue-50 text-blue-600 hover:bg-blue-100
                                     dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900
                                     font-medium transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          {t.history_reuse}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteHistoryItem(item.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                     bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500
                                     dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400
                                     font-medium transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {t.history_delete}
                        </button>
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

// ─── Chat sessions tab ─────────────────────────────────────────────────────────
function ChatHistoryTab() {
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
            <svg className="w-7 h-7 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
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
                    <svg
                      className={`flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
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
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                        {t.history_chat_open}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChatSession(session.id)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                   bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500
                                   dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400
                                   font-medium transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {t.history_chat_delete}
                      </button>
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

// ─── Live session history tab ──────────────────────────────────────────────────
function LiveHistoryTab() {
  const { liveSessions, deleteLiveSession, clearLiveSessions, setActivePage } = useAppStore()
  const t = useT()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const handleOpenLive = (_session: LiveSession) => {
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
              <svg className="w-7 h-7 text-purple-300 dark:text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeWidth={1.5} />
                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" strokeWidth={1.5} />
              </svg>
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
                      <svg
                        className={`flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
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
                          onClick={() => handleOpenLive(session)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                     bg-purple-50 text-purple-600 hover:bg-purple-100
                                     dark:bg-purple-950 dark:text-purple-400 dark:hover:bg-purple-900
                                     font-medium transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          </svg>
                          {t.history_live_view}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLiveSession(session.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                                     bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500
                                     dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400
                                     font-medium transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          {t.history_live_delete}
                        </button>
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

// ─── Main HistoryPage ──────────────────────────────────────────────────────────
export function HistoryPage() {
  const { history, chatSessions, liveSessions } = useAppStore()
  const t = useT()
  const [activeTab, setActiveTab] = useState<'translate' | 'chat' | 'live'>('translate')

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
            ['translate', t.history_tab_translate, history.length],
            ['chat',      t.history_tab_chat,      chatSessions.length],
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
