/**
 * SettingsCopyButton — bordered copy button used in Settings panels.
 * Toggles between a "copy" state and a neutral "copied" confirmation state.
 * Extracted from SettingsPage (bookmarklet copy + port URL copy buttons).
 *
 * NOTE: Different from CopyButton (which is the ghost-style toolbar button
 * used in the Translate page). This one is a small bordered inline button.
 */
import { CheckIcon, CopyIcon } from './icons'

interface SettingsCopyButtonProps {
  copied: boolean
  onClick: () => void
  /** Label shown in idle state, e.g. t.settings_bookmarklet_copy */
  labelCopy: string
  /** Label shown after copying, e.g. t.settings_bookmarklet_copied */
  labelCopied: string
  title?: string
}

export function SettingsCopyButton({
  copied,
  onClick,
  labelCopy,
  labelCopied,
  title,
}: SettingsCopyButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`btn-secondary btn-xs ${copied ? 'btn-active' : ''}`}
    >
      {copied ? (
        <><CheckIcon className="w-3 h-3" />{labelCopied}</>
      ) : (
        <><CopyIcon className="w-3 h-3" />{labelCopy}</>
      )}
    </button>
  )
}
