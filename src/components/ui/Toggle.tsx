import { forwardRef } from 'react'

type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  size?: 'sm' | 'md'
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'children'>

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ checked, onChange, disabled = false, label, size = 'md', className = '', ...props }, ref) => {
    const trackSizeClass = size === 'sm' ? 'w-8 h-5' : 'w-[51px] h-[31px]'
    const thumbSizeClass = size === 'sm' ? 'w-4 h-4' : 'w-[27px] h-[27px]'
    const thumbTranslate = size === 'sm' ? (checked ? 'translate-x-3' : 'translate-x-0.5') : (checked ? 'translate-x-[22px]' : 'translate-x-[2px]')

    return (
      <div className="flex items-center gap-2">
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={[
            'relative inline-flex flex-shrink-0 rounded-full transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            trackSizeClass,
            checked
              ? 'bg-[#34C759] dark:bg-[#30D158]'
              : 'bg-[var(--apple-fill-primary)]',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          <span
            className={[
              'absolute top-[2px] inline-block rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.25)]',
              'transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
              thumbSizeClass,
              thumbTranslate,
            ]
              .filter(Boolean)
              .join(' ')}
          />
        </button>
        {label && (
          <span className="text-[15px] text-[var(--apple-label-primary)] select-none">
            {label}
          </span>
        )}
      </div>
    )
  },
)

Toggle.displayName = 'Toggle'
