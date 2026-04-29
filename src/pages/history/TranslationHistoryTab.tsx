import { useState } from 'react'
import { HistoryBulkHeader } from '../../components/ui/HistoryBulkHeader'
import { HistoryDeleteButton } from '../../components/ui/HistoryDeleteButton'
import { HistoryEmptyState } from '../../components/ui/HistoryEmptyState'
import { CheckIcon, ChevronDownIcon, ClockIcon, ReuseIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'
import type { HistoryItem } from '../../types'
import { tpl } from '../../utils/tpl'
import { formatTime, historyMatches, langLabel, normalizeHistoryQuery, ProviderBadge } from './historyUtils'

interface TranslationHistoryTabProps {
  query: string
}

export function TranslationHistoryTab({ query }: TranslationHistoryTabProps) {
  const { history, deleteHistoryItem, setActivePage, setSourceText, setTranslatedText, setSourceLang, setTargetLang } = useAppStore()
  const t = useT()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const normalizedQuery = normalizeHistoryQuery(query)
  const filteredHistory = history.filter((item) => historyMatches(normalizedQuery, [
    item.sourceText,
    item.translatedText,
    item.sourceLang,
    item.targetLang,
    langLabel(item.sourceLang),
    langLabel(item.targetLang),
    item.provider,
    item.model,
  ]))
  const filteredIds = filteredHistory.map((item) => item.id)
  const selectedVisibleIds = filteredIds.filter((id) => selectedIds.has(id))
  const selectedCount = selectedVisibleIds.length

  const handleReuse = (item: HistoryItem) => {
    setSourceText(item.sourceText)
    setTranslatedText(item.translatedText)
    setSourceLang(item.sourceLang)
    setTargetLang(item.targetLang)
    setActivePage('translate')
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
      deleteHistoryItem(id)
    }
    setSelectedIds(new Set())
  }

  return (
    <div className="flex flex-col h-full">
      {history.length > 0 && (
        <HistoryBulkHeader
          countLabel={tpl(t.history_translate_count, { n: filteredHistory.length })}
          totalCount={filteredHistory.length}
          selectedCount={selectedCount}
          labelSelectAll={t.history_select_all}
          labelSelected={tpl(t.history_selected_count, { n: selectedCount })}
          labelDeleteSelected={t.history_delete_selected}
          onSelectAll={handleSelectAll}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <HistoryEmptyState
            icon={<ClockIcon className="w-7 h-7 text-gray-300 dark:text-gray-600" />}
            title={t.history_empty}
            desc={t.history_empty_desc}
            tone="neutral"
          />
        ) : filteredHistory.length === 0 ? (
          <HistoryEmptyState
            icon={<ClockIcon className="w-7 h-7" />}
            title={t.history_no_results}
            desc={t.history_no_results_desc}
            tone="blue"
          />
        ) : (
          <ul className="p-3 space-y-2">
            {filteredHistory.map((item) => {
              const isExpanded = expandedId === item.id
              const isSelected = selectedIds.has(item.id)
              return (
                <li
                  key={item.id}
                  className={[
                    'group rounded-lg border transition-colors duration-150',
                    isSelected
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20'
                      : 'border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-950 dark:hover:bg-gray-800/50',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
                      className="mt-0.5 flex-shrink-0"
                    >
                      <span className={[
                        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400',
                      ].join(' ')}>
                        {isSelected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
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
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 pl-11 fade-in">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-lg">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                            {langLabel(item.sourceLang)} · {item.sourceText.length.toLocaleString()} {t.history_chars_source}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {item.sourceText}
                          </p>
                        </div>
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-lg">
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
