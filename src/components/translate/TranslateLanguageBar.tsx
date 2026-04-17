import { LanguageSelector } from '../LanguageSelector'
import { AutoDetectIcon, SpinnerIcon, SwapIcon } from '../ui/icons'

interface TranslateLanguageBarProps {
  targetLang: string
  onTargetLangChange: (lang: string) => void
  detectedSourceLang: string | null
  /** Whether the swap button is enabled */
  canSwap: boolean
  isDetectingLang: boolean
  onSwap: () => void
  langAutoLabel: string
  langNames: Record<string, string>
  swapTitle: string
}

export function TranslateLanguageBar({
  targetLang, onTargetLangChange,
  detectedSourceLang, canSwap, isDetectingLang, onSwap,
  langAutoLabel, langNames, swapTitle,
}: TranslateLanguageBarProps) {
  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2
                    bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      {/* Source: auto-detect badge */}
      <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                      bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                      text-sm text-gray-500 dark:text-gray-400 select-none overflow-hidden">
        <AutoDetectIcon className="w-3.5 h-3.5 flex-shrink-0 text-blue-400" />
        <span className="truncate">{langAutoLabel}</span>
        {detectedSourceLang && (
          <span className="ml-auto pl-1.5 text-xs font-medium text-blue-500 dark:text-blue-400 shrink-0 truncate">
            {langNames[detectedSourceLang] ?? detectedSourceLang}
          </span>
        )}
      </div>

      {/* Swap button */}
      <button
        type="button"
        onClick={onSwap}
        disabled={!canSwap}
        title={swapTitle}
        className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full
                    transition-all duration-200
                    ${!canSwap
                      ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed'
                      : 'cursor-pointer text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50 dark:hover:text-blue-400'}`}
      >
        {isDetectingLang
          ? <SpinnerIcon className="w-4 h-4 animate-spin" />
          : <SwapIcon className="w-4 h-4" />}
      </button>

      {/* Target language selector */}
      <div className="flex-1">
        <LanguageSelector value={targetLang} onChange={onTargetLangChange} includeAuto={false} />
      </div>
    </div>
  )
}
