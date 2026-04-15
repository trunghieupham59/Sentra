/**
 * CopyButton — ghost button that copies text to clipboard.
 * Switches to a green checkmark state for 1.5 s after a successful copy.
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
      className={`btn-ghost py-1 px-2 text-xs transition-all ${copied ? 'text-green-600' : ''}`}
    >
      {copied ? (
        <>
          <CheckIcon />
          <span className="hidden min-[1100px]:inline">{labelCopied}</span>
        </>
      ) : (
        <>
          <CopyIcon />
          <span className="hidden min-[1100px]:inline">{labelCopy}</span>
        </>
      )}
    </button>
  )
}
