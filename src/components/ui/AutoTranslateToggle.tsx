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
  /** Tooltip when automatic translation is enabled. */
  titleOn: string
  /** Tooltip when automatic translation is disabled. */
  titleOff: string
  /** Stable control name; state is communicated by the toggle and aria-pressed. */
  label: string
  disabled?: boolean
}

export function AutoTranslateToggle({
  autoTranslate,
  onChange,
  titleOn,
  titleOff,
  label,
  disabled = false,
}: AutoTranslateToggleProps) {
  return (
    <Button
      size="md"
      shape="rect"
      variant={autoTranslate ? 'primary' : 'neutral'}
      appearance={autoTranslate ? 'soft' : 'outline'}
      disabled={disabled}
      onClick={() => onChange(!autoTranslate)}
      title={autoTranslate ? titleOn : titleOff}
      aria-pressed={autoTranslate}
      className="translate-mode-toggle"
    >
      <MiniToggleTrack checked={autoTranslate} />
      <span className="whitespace-nowrap">{label}</span>
    </Button>
  )
}
