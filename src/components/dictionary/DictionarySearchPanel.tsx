import { useEffect, useRef, useState } from 'react'
import { LANGUAGES, TARGET_LANGUAGES } from '../../constants/providers'
import type { Translations } from '../../i18n'
import {
  AlertTriangleIcon,
  BookIcon,
  ChevronDownIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  XIcon,
} from '../ui/icons'

interface DictionarySearchPanelProps {
  term: string
  onTermChange: (value: string) => void
  context: string
  onContextChange: (value: string) => void
  sourceLang: string
  onSourceLangChange: (lang: string) => void
  targetLang: string
  onTargetLangChange: (lang: string) => void
  isLoading: boolean
  canSubmit: boolean
  error: string | null
  maxTermChars: number
  maxContextChars: number
  onSubmit: () => void
  t: Translations
}

export function DictionarySearchPanel({
  term,
  onTermChange,
  context,
  onContextChange,
  sourceLang,
  onSourceLangChange,
  targetLang,
  onTargetLangChange,
  isLoading,
  canSubmit,
  error,
  maxTermChars,
  maxContextChars,
  onSubmit,
  t,
}: DictionarySearchPanelProps) {
  const [contextOpen, setContextOpen] = useState(Boolean(context))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  const charLength = term.length
  const isCharOver = charLength > maxTermChars

  const sourceOptions = LANGUAGES
  const targetOptions = TARGET_LANGUAGES

  return (
    <form onSubmit={handleSubmit} className="flex-shrink-0 space-y-2">
      {/* ── Hero command bar — Apple card style ── */}
      <div
        className="flex items-center gap-1.5 p-1.5 rounded-xl"
        style={{
          background: 'var(--apple-bg-primary)',
          border: '1px solid var(--apple-separator)',
          boxShadow: 'var(--apple-shadow-sm)',
        }}
      >
        {/* Source language */}
        <div className="relative flex-shrink-0">
          <select
            value={sourceLang}
            onChange={(e) => onSourceLangChange(e.target.value)}
            className={[
              'h-9 cursor-pointer appearance-none rounded-lg pl-3 pr-7',
              'text-[13px] font-medium outline-none transition-colors',
              'bg-[var(--apple-fill-quaternary)] hover:bg-[var(--apple-fill-tertiary)]',
              'text-[var(--apple-label-primary)]',
              'focus:outline-none focus:bg-[var(--apple-fill-tertiary)]',
            ].join(' ')}
            aria-label={t.dictionary_source_lang}
          >
            {sourceOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {t.lang_names[lang.code] ?? lang.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--apple-label-tertiary)]" />
        </div>

        {/* Separator */}
        <span aria-hidden className="h-5 w-px flex-shrink-0 bg-[var(--apple-separator)]" />

        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--apple-label-tertiary)]" />
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => onTermChange(e.target.value)}
            placeholder={t.dictionary_term_placeholder}
            className={[
              'h-9 w-full rounded-lg border-0 bg-transparent pl-8 pr-16',
              'text-[15px] text-[var(--apple-label-primary)] outline-none select-text',
              'placeholder:text-[var(--apple-label-tertiary)]',
            ].join(' ')}
            maxLength={maxTermChars + 1}
          />
          {charLength > 0 && (
            <span
              className={[
                'pointer-events-none absolute top-1/2 -translate-y-1/2 text-[11px] tabular-nums',
                isCharOver
                  ? 'text-[var(--apple-red)]'
                  : 'text-[var(--apple-label-quaternary)]',
              ].join(' ')}
              style={{ right: '2rem' }}
            >
              {charLength}/{maxTermChars}
            </span>
          )}
          {term && (
            <button
              type="button"
              onClick={() => onTermChange('')}
              title={t.history_search_clear}
              aria-label={t.history_search_clear}
              className={[
                'absolute right-1.5 top-1/2 -translate-y-1/2',
                'flex items-center justify-center w-5 h-5 rounded-full',
                'bg-[var(--apple-fill-secondary)] text-[var(--apple-label-secondary)]',
                'hover:bg-[var(--apple-fill-primary)] transition-colors duration-150',
              ].join(' ')}
            >
              <XIcon className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* Separator */}
        <span aria-hidden className="h-5 w-px flex-shrink-0 bg-[var(--apple-separator)]" />

        {/* Target language */}
        <div className="relative flex-shrink-0">
          <select
            value={targetLang}
            onChange={(e) => onTargetLangChange(e.target.value)}
            className={[
              'h-9 cursor-pointer appearance-none rounded-lg pl-3 pr-7',
              'text-[13px] font-medium outline-none transition-colors',
              'bg-[var(--apple-fill-quaternary)] hover:bg-[var(--apple-fill-tertiary)]',
              'text-[var(--apple-label-primary)]',
              'focus:outline-none focus:bg-[var(--apple-fill-tertiary)]',
            ].join(' ')}
            aria-label={t.dictionary_target_lang}
          >
            {targetOptions.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {t.lang_names[lang.code] ?? lang.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--apple-label-tertiary)]" />
        </div>

        {/* Submit button — Apple primary */}
        <button
          type="submit"
          disabled={isLoading || !canSubmit}
          className={[
            'flex-shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg',
            'text-[13px] font-medium text-white select-none',
            'transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-1',
            isLoading || !canSubmit
              ? 'opacity-40 cursor-not-allowed bg-[#007AFF] dark:bg-[#0A84FF]'
              : 'bg-[#007AFF] dark:bg-[#0A84FF] hover:brightness-90 active:scale-[0.97]',
          ].join(' ')}
        >
          {isLoading ? (
            <RefreshIcon className="h-3.5 w-3.5 spinner" />
          ) : (
            <BookIcon className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isLoading ? t.dictionary_lookup_loading : t.dictionary_lookup}
          </span>
        </button>
      </div>

      {/* ── Context disclosure ── */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setContextOpen((v) => !v)}
          className={[
            'flex items-center gap-1.5 h-6 px-2 rounded-lg text-[12px]',
            'transition-colors duration-150',
            'text-[var(--apple-label-secondary)] hover:bg-[var(--apple-fill-tertiary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]',
          ].join(' ')}
        >
          {contextOpen ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <PlusIcon className="h-3 w-3" />
          )}
          <span>{t.dictionary_context_label}</span>
          {context.trim() && (
            <span
              className={[
                'inline-flex items-center rounded-full px-1.5 py-0.5',
                'text-[10px] font-medium',
                'bg-[#007AFF]/10 dark:bg-[#0A84FF]/15 text-[#007AFF] dark:text-[#0A84FF]',
              ].join(' ')}
            >
              {context.trim().length}
            </span>
          )}
        </button>
      </div>

      {contextOpen && (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--apple-bg-primary)',
            border: '1px solid var(--apple-separator)',
          }}
        >
          <textarea
            value={context}
            onChange={(e) => onContextChange(e.target.value)}
            placeholder={t.dictionary_context_placeholder}
            className={[
              'h-16 w-full resize-none bg-transparent px-3 py-2',
              'text-[15px] text-[var(--apple-label-primary)] outline-none select-text',
              'placeholder:text-[var(--apple-label-tertiary)]',
            ].join(' ')}
            maxLength={maxContextChars + 1}
          />
        </div>
      )}

      {/* ── Inline error ── */}
      {error && (
        <div
          className="flex items-start gap-2 rounded-xl px-3 py-2"
          style={{
            background: 'rgba(255, 59, 48, 0.08)',
            border: '1px solid rgba(255, 59, 48, 0.25)',
          }}
        >
          <AlertTriangleIcon
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color: 'var(--apple-red)' }}
          />
          <span className="text-[13px]" style={{ color: 'var(--apple-red)' }}>{error}</span>
        </div>
      )}
    </form>
  )
}
