/**
 * MiniToggleTrack — reusable inline mini-toggle pill (track + thumb).
 *
 * Used inside pill-style buttons like AutoTranslateToggle and PhoneticToggle
 * to show a small visual on/off indicator embedded in the button label.
 *
 * NOT a standalone interactive control — the parent button handles click events.
 *
 * @example
 * <MiniToggleTrack checked={autoTranslate} color="green" />
 */

export type MiniToggleColor = 'green' | 'purple' | 'blue'

interface MiniToggleTrackProps {
  checked: boolean
  /** Active track colour. Default: 'green' */
  color?: MiniToggleColor
}

const TRACK_COLOR: Record<MiniToggleColor, string> = {
  green:  'bg-green-500',
  purple: 'bg-purple-500',
  blue:   'bg-blue-500',
}

export function MiniToggleTrack({ checked, color = 'green' }: MiniToggleTrackProps) {
  return (
    <span
      className={[
        'relative inline-flex shrink-0 items-center w-7 h-4 rounded-full transition-colors duration-200',
        checked ? TRACK_COLOR[color] : 'bg-gray-300 dark:bg-gray-600',
      ].join(' ')}
    >
      <span
        className={[
          'absolute w-3 h-3 bg-white rounded-full shadow transition-transform duration-200',
          checked ? 'translate-x-3.5' : 'translate-x-0.5',
        ].join(' ')}
      />
    </span>
  )
}
