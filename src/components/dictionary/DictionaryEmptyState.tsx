import type { Translations } from '../../i18n'
import { BookIcon, LightbulbIcon, SparklesIcon, TranslateIcon } from '../ui/icons'

interface DictionaryEmptyStateProps {
  t: Translations
}

const HINT_ICONS = [BookIcon, TranslateIcon, LightbulbIcon] as const

/**
 * Empty state shown in the result panel before any lookup has been
 * performed.  Mirrors the visual rhythm of other "no data" surfaces in
 * the app (HistoryPage / LiveTranslatePage) — a soft icon disc, a short
 * heading, a muted body copy.  Hint chips help orient new users.
 */
export function DictionaryEmptyState({ t }: DictionaryEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-500 shadow-sm shadow-blue-900/5 dark:from-blue-950/60 dark:to-indigo-950/60 dark:text-blue-300">
          <BookIcon className="h-7 w-7" />
        </div>
        <div className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm shadow-blue-900/10 dark:bg-neutral-900">
          <SparklesIcon className="h-3.5 w-3.5 text-amber-500 dark:text-amber-300" />
        </div>
      </div>

      <div className="max-w-sm space-y-1.5">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {t.dictionary_empty_title}
        </h2>
        <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
          {t.dictionary_empty_desc}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {t.dictionary_empty_hints.map((hint, idx) => {
          const HintIcon = HINT_ICONS[idx % HINT_ICONS.length]
          return (
            <span
              key={hint}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-500 shadow-sm shadow-gray-900/5 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-400"
            >
              <HintIcon className="h-3 w-3" />
              <span className="font-mono">{hint}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
