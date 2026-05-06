/**
 * CurrencyPicker — compact, styled select used by the cost dashboard.
 * Replaces the bare native <select> previously rendered next to the
 * "Total cost" label so the control feels integrated with the surrounding card.
 */
import type { UsageCurrency } from '../../types'
import { USAGE_CURRENCY_OPTIONS } from '../../utils/usageCost'
import { ChevronDownIcon } from './icons'

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
          'select-field w-auto min-w-[112px] pl-3 pr-8',
        ].join(' ')}
      >
        {USAGE_CURRENCY_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
    </div>
  )
}
