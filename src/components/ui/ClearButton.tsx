/**
 * ClearButton — destructive icon action for clearing source text.
 * The text label is hidden on narrow viewports (< 1100 px).
 */
import { Button } from './atoms'
import { TrashIcon } from './icons'

interface ClearButtonProps {
  onClick: () => void
  /** Visible label, e.g. t.translate_clear */
  label: string
}

export function ClearButton({ onClick, label }: ClearButtonProps) {
  return (
    <Button
      size="md"
      shape="icon"
      variant="danger"
      appearance="ghost"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <TrashIcon />
    </Button>
  )
}
