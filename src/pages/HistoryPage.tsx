import { useState } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { HistoryItem } from '../types'
import { PROVIDERS } from '../constants/providers'

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

export function HistoryPage() {
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t.history_title}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {history.length} {history.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>

        {history.length > 0 && (
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
        )}
      </div>

      {/* Content */}
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
                  {/* Card header */}
                  <button
                    type="button"
                    className="w-full text-left px-4 pt-3 pb-2"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Source text preview */}
                        <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug line-clamp-2 font-medium">
                          {item.sourceText}
                        </p>
                        {/* Translation preview */}
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mt-1 line-clamp-1">
                          {item.translatedText}
                        </p>
                      </div>
                      {/* Chevron */}
                      <svg
                        className={`flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Meta row */}
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

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-3 fade-in">
                      <div className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden text-xs">
                        {/* Source */}
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {langLabel(item.sourceLang)} · {item.sourceText.length.toLocaleString()} {t.history_chars_source}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {item.sourceText}
                          </p>
                        </div>
                        {/* Translation */}
                        <div className="px-3 py-2">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {langLabel(item.targetLang)} · {item.translatedText.length.toLocaleString()} {t.history_chars_result}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {item.translatedText}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
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
