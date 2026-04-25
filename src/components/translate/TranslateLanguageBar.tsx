import { LanguageSelector } from '../LanguageSelector'
import { AutoDetectIcon, SpinnerIcon, SwapIcon } from '../ui/icons'

interface TranslateLanguageBarProps {
  sourceLang: string
  onSourceLangChange: (lang: string) => void
  targetLang: string
  onTargetLangChange: (lang: string) => void
  detectedSourceLang: string | null
  /** Whether the swap button is enabled */
  canSwap: boolean
  isDetectingLang: boolean
  onSwap: () => void
  langNames: Record<string, string>
  swapTitle: string
}

const PILL_SELECT_CLS = `block w-full px-3 py-1.5 pr-9
                         bg-white dark:bg-gray-800
                         border border-gray-200 dark:border-gray-700
                         rounded-xl text-[13px] font-medium text-gray-700 dark:text-gray-200
                         appearance-none cursor-pointer
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         transition-colors duration-100`

export function TranslateLanguageBar({
  sourceLang, onSourceLangChange,
  targetLang, onTargetLangChange,
  detectedSourceLang, canSwap, isDetectingLang, onSwap,
  langNames, swapTitle,
}: TranslateLanguageBarProps) {
  return (
    <div className="relative grid grid-cols-2 gap-16 items-center">

      {/* ── Col 1: source language selector (includes Auto option) ── */}
      <div className="relative">
        <LanguageSelector
          value={sourceLang}
          onChange={onSourceLangChange}
          includeAuto={true}
          selectClassName={sourceLang === 'auto'
            ? `${PILL_SELECT_CLS} pl-7`
            : PILL_SELECT_CLS}
        />
        {/* Auto-detect icon shown on the left when auto is selected */}
        {sourceLang === 'auto' && (
          <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center">
            <AutoDetectIcon className="w-3.5 h-3.5 text-blue-400" />
          </span>
        )}
        {/* Detected language badge shown when auto is selected */}
        {sourceLang === 'auto' && detectedSourceLang && (
          <span className="absolute right-9 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-500 dark:text-blue-400 pointer-events-none pr-1">
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
          selectClassName={PILL_SELECT_CLS}
        />
      </div>
    </div>
  )
}
