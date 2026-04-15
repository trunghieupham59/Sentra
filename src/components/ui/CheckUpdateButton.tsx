/**
 * CheckUpdateButton — "Check for updates" button that adapts its appearance
 * to the current updater state (idle → checking → downloaded).
 * Extracted from SettingsPage (Updates section).
 */
import { SpinnerIcon } from './icons'

export type UpdaterButtonStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error-codesign'
  | 'error'

interface CheckUpdateButtonProps {
  status: UpdaterButtonStatus
  checkLabel: string
  checkingLabel: string
  onClick: () => void
}

export function CheckUpdateButton({
  status,
  checkLabel,
  checkingLabel,
  onClick,
}: CheckUpdateButtonProps) {
  const isDisabled = status === 'checking' || status === 'downloading'
  const isDownloaded = status === 'downloaded'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={[
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        isDownloaded
          ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600',
      ].join(' ')}
    >
      {status === 'checking' && <SpinnerIcon className="w-3 h-3 animate-spin" />}
      {status === 'checking' ? checkingLabel : checkLabel}
    </button>
  )
}
