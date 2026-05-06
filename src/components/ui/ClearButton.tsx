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
      title={label}
      className="btn-ghost btn-xs"
    >
      <TrashIcon />
    </button>
  )
}
