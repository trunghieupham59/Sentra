/**
 * Reusable toggle switch (pill-style) used throughout Settings.
 * Replaces 6+ copies of the same inline button pattern.
 *
 * Usage:
 *   <ToggleSwitch checked={autoTranslate} onChange={setAutoTranslate} />
 */
interface ToggleSwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  /** Aria label for accessibility */
  'aria-label'?: string
  disabled?: boolean
  className?: string
}

export function ToggleSwitch({
  checked,
  onChange,
  'aria-label': ariaLabel,
  disabled = false,
  className = '',
}: ToggleSwitchProps) {
  const trackColor = checked
    ? 'bg-gray-950 dark:bg-gray-100'
    : 'bg-gray-300 dark:bg-gray-600'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex flex-shrink-0 items-center w-9 h-5 rounded-full',
        'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        trackColor,
        className,
      ].join(' ')}
    >
      <span
        className={[
          'absolute w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 dark:bg-neutral-950',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  )
}
