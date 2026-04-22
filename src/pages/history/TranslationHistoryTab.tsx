import { useState } from 'react'
import { HistoryClearHeader } from '../../components/ui/HistoryClearHeader'
import { HistoryDeleteButton } from '../../components/ui/HistoryDeleteButton'
import { HistoryEmptyState } from '../../components/ui/HistoryEmptyState'
import { ChevronDownIcon, ClockIcon, ReuseIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'
import type { HistoryItem } from '../../types'
import { tpl } from '../../utils/tpl'
import { formatTime, langLabel, ProviderBadge } from './historyUtils'

export function TranslationHistoryTab() {
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
        <HistoryClearHeader
          countLabel={tpl(t.history_translate_count, { n: history.length })}
          confirmClear={confirmClear}
          labelClear={t.history_clear_all}
          labelConfirm={t.history_clear_confirm}
          onClear={handleClearAll}
          onBlur={() => setTimeout(() => setConfirmClear(false), 200)}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <HistoryEmptyState
            icon={<ClockIcon className="w-7 h-7 text-gray-300 dark:text-gray-600" />}
            title={t.history_empty}
            desc={t.history_empty_desc}
          />
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
                      <ChevronDownIcon
                        className={`flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <ProviderBadge provider={item.provider} />
                      <span className="text-[10px] text-gray-400 dark:text-gray-600">
                        {langLabel(item.sourceLang)} → {langLabel(item.targetLang)}
                      </span>
                      <span className="text-[10px] text-gray-300 dark:text-gray-700 ml-auto">
                        {formatTime(item.timestamp, t)}
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
                          <ReuseIcon className="w-3.5 h-3.5" />
                          {t.history_reuse}
                        </button>
                        <HistoryDeleteButton onClick={() => deleteHistoryItem(item.id)} label={t.history_delete} />
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
