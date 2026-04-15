/**
 * AutoTranslateToggle — pill-style toggle button for switching between
 * automatic and manual translation modes.
 *
 * Fixed width (88 px) prevents layout shift when the label text changes.
 */
import { MiniToggleTrack } from './MiniToggleTrack'

interface AutoTranslateToggleProps {
  autoTranslate: boolean
  onChange: (value: boolean) => void
  /** Tooltip when auto mode is currently active */
  titleAuto: string
  /** Tooltip when manual mode is currently active */
  titleManual: string
}

export function AutoTranslateToggle({
  autoTranslate,
  onChange,
  titleAuto,
  titleManual,
}: AutoTranslateToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!autoTranslate)}
      title={autoTranslate ? titleAuto : titleManual}
      className={[
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium',
        'border transition-all duration-200 select-none cursor-pointer',
        'w-[88px] justify-start',
        autoTranslate
          ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900'
          : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700',
      ].join(' ')}
    >
      <MiniToggleTrack checked={autoTranslate} color="green" />
      <span>{autoTranslate ? 'Auto' : 'Manual'}</span>
    </button>
  )
}
