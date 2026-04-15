/**
 * TranslateButton — blue pill button that triggers manual translation.
 * Shows a spinner with a loading label while translation is in progress.
 */
import { ArrowRightIcon, SpinnerIcon } from './icons'

interface TranslateButtonProps {
  isTranslating: boolean
  disabled?: boolean
  onClick: () => void
  /** Label shown in idle state, e.g. t.translate_btn */
  labelTranslate: string
  /** Label shown while translating, e.g. t.translate_btn_loading */
  labelLoading: string
}

export function TranslateButton({
  isTranslating,
  disabled = false,
  onClick,
  labelTranslate,
  labelLoading,
}: TranslateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isTranslating || disabled}
      className={[
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
        'bg-blue-600 text-white shadow-sm transition-all duration-200 cursor-pointer select-none',
        'hover:bg-blue-700 active:scale-95',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
      ].join(' ')}
    >
      {isTranslating ? (
        <>
          <SpinnerIcon />
          <span>{labelLoading}</span>
        </>
      ) : (
        <>
          <ArrowRightIcon />
          <span>{labelTranslate}</span>
        </>
      )}
    </button>
  )
}
