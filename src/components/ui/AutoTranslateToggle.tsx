/**
 * AutoTranslateToggle — compact toggle button for switching between
 * automatic and manual translation modes.
 *
 * A shared minimum width prevents layout shift when the localized mode label
 * changes; compact layouts intentionally collapse the control to its icon.
 */

import { Button } from './atoms'
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
    <Button
      size="md"
      shape="rect"
      variant={autoTranslate ? 'primary' : 'neutral'}
      appearance={autoTranslate ? 'soft' : 'outline'}
      onClick={() => onChange(!autoTranslate)}
      title={autoTranslate ? titleAuto : titleManual}
      aria-pressed={autoTranslate}
      className="translate-mode-toggle"
    >
      <MiniToggleTrack checked={autoTranslate} />
      <span className="whitespace-nowrap">{autoTranslate ? labelAuto : labelManual}</span>
    </Button>
  )
}
