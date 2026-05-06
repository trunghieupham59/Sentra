/**
 * TranslateButton — primary action button that triggers manual translation.
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
      className="btn-primary"
    >
      {isTranslating ? (
        <>
          <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
          <span>{labelLoading}</span>
        </>
      ) : (
        <>
          <ArrowRightIcon className="w-3.5 h-3.5" />
          <span>{labelTranslate}</span>
        </>
      )}
    </button>
  )
}
