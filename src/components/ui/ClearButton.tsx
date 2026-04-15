/**
 * ClearButton — ghost button with a trash icon for clearing source text.
 * The text label is hidden on narrow viewports (< 1100 px).
 */
import { TrashIcon } from './icons'

interface ClearButtonProps {
  onClick: () => void
  /** Visible label, e.g. t.translate_clear */
  label: string
}

export function ClearButton({ onClick, label }: ClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-ghost py-1 px-2 text-xs flex items-center gap-1"
    >
      <TrashIcon />
      <span className="hidden min-[1100px]:inline">{label}</span>
    </button>
  )
}
