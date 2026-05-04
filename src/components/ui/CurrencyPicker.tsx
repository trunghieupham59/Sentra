/**
 * CurrencyPicker — compact, styled select used by the cost dashboard.
 * Replaces the bare native <select> previously rendered next to the
 * "Total cost" label so the control feels integrated with the surrounding card.
 */
import type { UsageCurrency } from '../../types'
import { USAGE_CURRENCY_OPTIONS } from '../../utils/usageCost'

interface CurrencyPickerProps {
  value: UsageCurrency
  onChange: (next: UsageCurrency) => void
  ariaLabel: string
  className?: string
}

export function CurrencyPicker({ value, onChange, ariaLabel, className }: CurrencyPickerProps) {
  return (
    <div className={['relative inline-flex items-center', className ?? ''].join(' ')}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as UsageCurrency)}
        aria-label={ariaLabel}
        className={[
          'h-7 appearance-none rounded-lg border border-gray-200 bg-white pl-2.5 pr-7',
          'text-xs font-semibold text-gray-700 outline-none transition-colors',
          'hover:border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100',
          'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200',
          'dark:hover:border-gray-600 dark:focus:border-blue-500 dark:focus:ring-blue-900/40',
        ].join(' ')}
      >
        {USAGE_CURRENCY_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-1.5 h-3 w-3 text-gray-400 dark:text-gray-500"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path d="M3 5l3 3 3-3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
