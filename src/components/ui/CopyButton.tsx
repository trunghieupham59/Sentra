/**
 * CopyButton — ghost button that copies text to clipboard.
 * Switches to a neutral checkmark state for 1.5 s after a successful copy.
 * The text label is hidden on narrow viewports (< 1100 px).
 */
import { CheckIcon, CopyIcon } from './icons'

interface CopyButtonProps {
  copied: boolean
  onClick: () => void
  /** Label shown in idle state, e.g. t.translate_copy */
  labelCopy: string
  /** Label shown after copying, e.g. t.translate_copied */
  labelCopied: string
}

export function CopyButton({ copied, onClick, labelCopy, labelCopied }: CopyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={copied ? labelCopied : labelCopy}
      className={`btn-ghost btn-xs ${copied ? 'text-gray-700 dark:text-gray-200' : ''}`}
    >
      {copied ? (
        <CheckIcon />
      ) : (
        <CopyIcon />
      )}
    </button>
  )
}
