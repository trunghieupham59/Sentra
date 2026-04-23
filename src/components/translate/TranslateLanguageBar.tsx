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
    /**
     * Use the same grid-cols-2 + gap-8 as the panels row below,
     * so the left/right edges of the language selectors align
     * pixel-perfectly with the left/right edges of the panels.
     * The swap button is absolutely centred in the 32 px gap.
     */
    <div className="relative grid grid-cols-2 gap-16 items-center">

      {/* ── Col 1: source auto-detect display ── */}
      <div className="flex items-center gap-2 px-4 py-2.5
                      rounded-xl border border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-800 select-none overflow-hidden">
        <AutoDetectIcon className="w-4 h-4 flex-shrink-0 text-blue-400" />
        <span className="flex-1 truncate text-sm text-gray-600 dark:text-gray-300">
          {langAutoLabel}
        </span>
        {detectedSourceLang && (
          <span className="text-xs font-medium text-blue-500 dark:text-blue-400 shrink-0 truncate">
            {langNames[detectedSourceLang] ?? detectedSourceLang}
          </span>
        )}
      </div>

      {/* ── Swap button — absolutely centred in the gap ── */}
      <button
        type="button"
        onClick={onSwap}
        disabled={!canSwap}
        title={swapTitle}
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10
                    flex items-center justify-center w-8 h-8
                    transition-all duration-200
                    ${!canSwap
                      ? 'text-gray-200 dark:text-gray-700 cursor-not-allowed'
                      : 'cursor-pointer text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'}`}
      >
        {isDetectingLang
          ? <SpinnerIcon className="w-5 h-5 animate-spin" />
          : <SwapIcon className="w-5 h-5" />}
      </button>

      {/* ── Col 2: target language selector ── */}
      <div className="relative">
        <LanguageSelector
          value={targetLang}
          onChange={onTargetLangChange}
          includeAuto={false}
          selectClassName="block w-full px-4 py-2.5 pr-9
                           bg-white dark:bg-gray-800
                           border border-gray-200 dark:border-gray-700
                           rounded-xl text-sm text-gray-700 dark:text-gray-200
                           appearance-none cursor-pointer
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                           transition-colors duration-100"
        />
      </div>
    </div>
  )
}
