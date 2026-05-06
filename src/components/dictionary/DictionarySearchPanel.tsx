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

/**
 * Compact "command-bar" style search for the Dictionary screen.
 *
 * Visually it reads as a single elevated input row containing every
 * primary control: source language → search field → target language →
 * submit.  An optional context box opens inline as a single-row
 * disclosure underneath, keeping the panel quiet by default.
 */
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

  // Initial focus — explicit + scoped (passes biome a11y/noAutofocus).
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
      {/* ── Hero command bar ───────────────────────────────────────────── */}
      <div className="surface-panel surface-panel-focus">
        <div className="flex items-center gap-1.5 p-1.5">
          {/* Source language — borderless inline select */}
          <div className="relative flex-shrink-0">
            <select
              value={sourceLang}
              onChange={(e) => onSourceLangChange(e.target.value)}
              className="h-9 cursor-pointer appearance-none rounded-md bg-transparent pl-3 pr-7 text-sm font-medium text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
              aria-label={t.dictionary_source_lang}
            >
              {sourceOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {t.lang_names[lang.code] ?? lang.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
          </div>

          <span aria-hidden className="h-5 w-px flex-shrink-0 bg-gray-200 dark:bg-neutral-800" />

          {/* Search input */}
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => onTermChange(e.target.value)}
              placeholder={t.dictionary_term_placeholder}
              className="h-9 w-full rounded-md border-0 bg-transparent pl-8 pr-16 text-sm text-gray-900 outline-none placeholder:text-gray-400 select-text dark:text-gray-50 dark:placeholder:text-gray-600"
              maxLength={maxTermChars + 1}
            />
            {/* Char counter inside input — only shown when typing */}
            {charLength > 0 && (
              <span
                className={`ui-micro pointer-events-none absolute top-1/2 -translate-y-1/2 font-medium tabular-nums ${
                  isCharOver ? 'ui-error-text' : 'text-gray-300 dark:text-gray-600'
                }`}
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
                className="btn-icon btn-icon-xs absolute right-1.5 top-1/2 -translate-y-1/2 border-transparent bg-transparent text-gray-400 shadow-none dark:bg-transparent"
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>

          <span aria-hidden className="h-5 w-px flex-shrink-0 bg-gray-200 dark:bg-neutral-800" />

          {/* Target language */}
          <div className="relative flex-shrink-0">
            <select
              value={targetLang}
              onChange={(e) => onTargetLangChange(e.target.value)}
              className="h-9 cursor-pointer appearance-none rounded-md bg-transparent pl-3 pr-7 text-sm font-medium text-gray-700 outline-none transition-colors hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-800 dark:focus:bg-neutral-800"
              aria-label={t.dictionary_target_lang}
            >
              {targetOptions.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {t.lang_names[lang.code] ?? lang.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || !canSubmit}
            className="btn-primary flex-shrink-0"
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
      </div>

      {/* ── Context disclosure (inline, low-key) ──────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          onClick={() => setContextOpen((v) => !v)}
          className="btn-ghost btn-xs"
        >
          {contextOpen ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <PlusIcon className="h-3 w-3" />
          )}
          <span>{t.dictionary_context_label}</span>
          {context.trim() && (
            <span className="ui-badge-xs">
              {context.trim().length}
            </span>
          )}
        </button>
      </div>

      {contextOpen && (
        <div className="surface-panel">
          <textarea
            value={context}
            onChange={(e) => onContextChange(e.target.value)}
            placeholder={t.dictionary_context_placeholder}
            className="h-16 w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm text-gray-800 outline-none placeholder:text-gray-400 select-text dark:text-gray-100 dark:placeholder:text-gray-600"
            maxLength={maxContextChars + 1}
          />
        </div>
      )}

      {/* ── Inline error ───────────────────────────────────────────────── */}
      {error && (
        <div className="ui-error-box flex items-start gap-2">
          <AlertTriangleIcon className="ui-error-icon mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </form>
  )
}
