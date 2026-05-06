/**
 * AutoTranslateToggle — compact toggle button for switching between
 * automatic and manual translation modes.
 *
 * Fixed width (112 px) prevents layout shift when the label text changes.
 * Width accommodates the longest Vietnamese labels ("Tự động" / "Thủ công").
 */
import { MiniToggleTrack } from './MiniToggleTrack'

interface AutoTranslateToggleProps {
  autoTranslate: boolean
  onChange: (value: boolean) => void
  /** Tooltip when auto mode is currently active */
  titleAuto: string
  /** Tooltip when manual mode is currently active */
  titleManual: string
  /** Button label when in auto mode */
  labelAuto: string
  /** Button label when in manual mode */
  labelManual: string
}

export function AutoTranslateToggle({
  autoTranslate,
  onChange,
  titleAuto,
  titleManual,
  labelAuto,
  labelManual,
}: AutoTranslateToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!autoTranslate)}
      title={autoTranslate ? titleAuto : titleManual}
      className={[
        'btn-secondary btn-sm font-medium',
        'w-[112px] justify-start',
        autoTranslate
          ? 'btn-active'
          : 'bg-gray-50 text-gray-500 dark:bg-neutral-800 dark:text-gray-400',
      ].join(' ')}
    >
      <MiniToggleTrack checked={autoTranslate} />
      <span className="whitespace-nowrap">{autoTranslate ? labelAuto : labelManual}</span>
    </button>
  )
}
