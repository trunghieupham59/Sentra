import { useState } from 'react'
import type { Translations } from '../../i18n'
import { useAppStore } from '../../store/useAppStore'
import type { DictionaryEntry } from '../../types'
import { BookIcon, SearchIcon, StarIcon, TrashIcon, XIcon } from '../ui/icons'
import { UsageCostBadge } from '../ui/UsageCostBadge'

type DictionaryListTab = 'recent' | 'favorites'

interface DictionaryHistoryPanelProps {
  entries: DictionaryEntry[]
  selectedEntryId: string | null
  activeTab: DictionaryListTab
  onTabChange: (tab: DictionaryListTab) => void
  onSelect: (id: string) => void
  onToggleFavorite: (id: string) => void
  onDeleteSelected: () => void
  onClearHistory: () => void
  t: Translations
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 30) return '·'
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  const wk = Math.floor(day / 7)
  if (wk < 4) return `${wk}w`
  const mo = Math.floor(day / 30)
  return `${mo}mo`
}

export function DictionaryHistoryPanel({
  entries,
  selectedEntryId,
  activeTab,
  onTabChange,
  onSelect,
  onToggleFavorite,
  onDeleteSelected,
  onClearHistory,
  t,
}: DictionaryHistoryPanelProps) {
  const [filter, setFilter] = useState('')
  const costCurrency = useAppStore((state) => state.costCurrency)

  const recentCount = entries.length
  const favoriteCount = entries.filter((entry) => entry.favorite).length

  const baseEntries = activeTab === 'favorites'
    ? entries.filter((entry) => entry.favorite)
    : entries

  const lowerFilter = filter.trim().toLowerCase()
  const visibleEntries = lowerFilter
    ? baseEntries.filter((entry) =>
        entry.result.headword.toLowerCase().includes(lowerFilter) ||
        entry.result.meaning.toLowerCase().includes(lowerFilter) ||
        entry.term.toLowerCase().includes(lowerFilter),
      )
    : baseEntries

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null

  const tabs: Array<{ id: DictionaryListTab; label: string; count: number }> = [
    { id: 'recent', label: t.dictionary_recent, count: recentCount },
    { id: 'favorites', label: t.dictionary_favorites, count: favoriteCount },
  ]

  return (
    <div
      className="flex flex-col min-h-0 h-full rounded-xl overflow-hidden"
      style={{
        background: 'var(--apple-bg-primary)',
        border: '1px solid var(--apple-separator)',
        boxShadow: 'var(--apple-shadow-sm)',
      }}
    >
      {/* ── Tabs + filter ── */}
      <div
        className="flex-shrink-0 space-y-2 p-3"
        style={{ borderBottom: '1px solid var(--apple-separator)' }}
      >
        {/* Apple segmented control style tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg" style={{ background: 'var(--apple-fill-quaternary)' }} role="tablist">
          {tabs.map(({ id, label, count }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(id)}
                className={[
                  'flex items-center justify-center gap-1.5 h-7 px-2 rounded-md',
                  'text-[12px] font-medium transition-all duration-150 select-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]',
                  isActive
                    ? 'bg-[#007AFF] dark:bg-[#0A84FF] text-white shadow-sm'
                    : 'text-[var(--apple-label-secondary)] hover:text-[var(--apple-label-primary)]',
                ].join(' ')}
              >
                <span className="truncate">{label}</span>
                <span
                  className={[
                    'inline-flex items-center justify-center rounded-full min-w-[16px] h-4 px-1',
                    'text-[10px] tabular-nums',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--apple-fill-secondary)] text-[var(--apple-label-secondary)]',
                  ].join(' ')}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Filter input */}
        {recentCount > 4 && (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--apple-label-tertiary)]" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t.history_search_placeholder}
              className={[
                'h-7 w-full rounded-lg pl-7 pr-7 text-[12px]',
                'bg-[var(--apple-fill-quaternary)] text-[var(--apple-label-primary)]',
                'placeholder:text-[var(--apple-label-tertiary)] outline-none',
                'focus:bg-[var(--apple-fill-tertiary)]',
                'transition-colors duration-150',
              ].join(' ')}
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                title={t.history_search_clear}
                aria-label={t.history_search_clear}
                className={[
                  'absolute right-1.5 top-1/2 -translate-y-1/2',
                  'flex items-center justify-center w-4 h-4 rounded-full',
                  'bg-[var(--apple-fill-secondary)] text-[var(--apple-label-secondary)]',
                  'hover:bg-[var(--apple-fill-primary)] transition-colors duration-150',
                ].join(' ')}
              >
                <XIcon className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-auto">
        {visibleEntries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'var(--apple-fill-tertiary)', color: 'var(--apple-label-tertiary)' }}
            >
              <BookIcon className="h-4 w-4" />
            </div>
            <span className="text-[12px]" style={{ color: 'var(--apple-label-tertiary)' }}>
              {filter
                ? t.dictionary_no_matches
                : activeTab === 'favorites'
                  ? t.dictionary_no_favorites
                  : t.dictionary_no_recent}
            </span>
          </div>
        ) : (
          <ul className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {visibleEntries.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id
              return (
                <li
                  key={entry.id}
                  style={{ borderColor: 'var(--apple-separator)' }}
                >
                  <div
                    className={[
                      'group relative flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors duration-150',
                      isSelected
                        ? 'bg-[var(--apple-fill-quaternary)]'
                        : 'hover:bg-[var(--apple-fill-quaternary)]',
                    ].join(' ')}
                  >
                    {/* Active indicator — Apple accent color */}
                    <span
                      aria-hidden
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r transition-colors"
                      style={{ background: isSelected ? 'var(--apple-accent)' : 'transparent' }}
                    />

                    <button
                      type="button"
                      onClick={() => onSelect(entry.id)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none"
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className="truncate text-[13px] font-semibold"
                          style={{ color: 'var(--apple-label-primary)' }}
                        >
                          {entry.result.headword}
                        </span>
                        {entry.result.pronunciation && (
                          <span
                            className="truncate text-[11px] font-mono"
                            style={{ color: 'var(--apple-label-secondary)' }}
                          >
                            /{entry.result.pronunciation.replace(/^\/|\/$/g, '')}/
                          </span>
                        )}
                        <span
                          className="text-[10px] ml-auto flex-shrink-0 tabular-nums"
                          style={{ color: 'var(--apple-label-tertiary)' }}
                        >
                          {formatRelativeTime(entry.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1">
                        <UsageCostBadge cost={entry.cost} currency={costCurrency} />
                      </div>
                      <p
                        className="mt-0.5 line-clamp-2 text-[12px] leading-5"
                        style={{ color: 'var(--apple-label-secondary)' }}
                      >
                        {entry.result.meaning}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleFavorite(entry.id)
                      }}
                      aria-label={entry.favorite ? t.dictionary_unfavorite : t.dictionary_favorite}
                      className={[
                        'flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md',
                        'transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]',
                        entry.favorite
                          ? 'text-[#FF9500] dark:text-[#FF9F0A] opacity-100'
                          : 'text-[var(--apple-label-quaternary)] opacity-0 group-hover:opacity-100',
                      ].join(' ')}
                    >
                      <StarIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Footer ── */}
      {entries.length > 0 && (
        <div
          className="flex-shrink-0 flex items-center justify-between px-3 h-11"
          style={{ borderTop: '1px solid var(--apple-separator)' }}
        >
          <button
            type="button"
            onClick={onClearHistory}
            disabled={!entries.some((entry) => !entry.favorite)}
            className={[
              'flex items-center gap-1.5 h-7 px-2 rounded-lg text-[12px]',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]',
              'text-[var(--apple-label-secondary)] hover:bg-[var(--apple-fill-tertiary)]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            ].join(' ')}
            title={t.dictionary_clear_history}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            <span>{t.dictionary_clear_history}</span>
          </button>
          {selectedEntry && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className={[
                'flex items-center gap-1.5 h-7 px-2 rounded-lg text-[12px]',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B30]',
                'text-[#FF3B30] dark:text-[#FF453A]',
                'hover:bg-[#FF3B30]/10 dark:hover:bg-[#FF453A]/15',
              ].join(' ')}
              title={t.dictionary_delete}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span>{t.dictionary_delete}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export type { DictionaryListTab }
