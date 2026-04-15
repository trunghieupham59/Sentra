/**
 * SettingsCopyButton — bordered copy button used in Settings panels.
 * Toggles between a "copy" state and a green "copied ✓" confirmation state.
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-colors cursor-pointer font-medium ${
        copied
          ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600'
      }`}
    >
      {copied ? (
        <><CheckIcon className="w-3 h-3" />{labelCopied}</>
      ) : (
        <><CopyIcon className="w-3 h-3" />{labelCopy}</>
      )}
    </button>
  )
}
