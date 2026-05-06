import { SwapIcon } from '../ui/icons'
import { SourceLanguageSelector } from './SourceLanguageSelector'
import { TargetLanguageSelector } from './TargetLanguageSelector'

// ── Component ──────────────────────────────────────────────────────────────────

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
  /** When true, only render the target side (hides source pills + swap button) */
  targetOnly?: boolean
}

export function TranslateLanguageBar({
  sourceLang, onSourceLangChange,
  targetLang, onTargetLangChange,
  detectedSourceLang, canSwap, isDetectingLang, onSwap,
  langNames, swapTitle,
  targetOnly = false,
}: TranslateLanguageBarProps) {
  return (
    <div className="flex items-center">

      {/* ── Source side + Swap — hidden when targetOnly ── */}
      {!targetOnly && (
        <>
          <SourceLanguageSelector
            sourceLang={sourceLang}
            onSourceLangChange={onSourceLangChange}
            detectedSourceLang={detectedSourceLang}
            isDetectingLang={isDetectingLang}
            langNames={langNames}
          />

          {/* ── Swap button ── */}
          <button
            type="button"
            onClick={onSwap}
            disabled={!canSwap}
            title={swapTitle}
            className={`btn-icon ml-2 mr-1 flex-shrink-0 border-transparent bg-transparent shadow-none
                        ${!canSwap
                          ? 'text-gray-200 dark:text-gray-700'
                          : 'text-gray-400 dark:bg-transparent'}`}
          >
            <SwapIcon className="w-5 h-5" />
          </button>
        </>
      )}

      {/* ── Target side ── */}
      <TargetLanguageSelector
        targetLang={targetLang}
        onTargetLangChange={onTargetLangChange}
        langNames={langNames}
      />

    </div>
  )
}
