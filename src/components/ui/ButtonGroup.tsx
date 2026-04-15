/**
 * ButtonGroup — generic "pick one from a set" button row.
 *
 * Renders a row of bordered buttons where the selected value is highlighted
 * in blue. Used by FontSizePicker and TokenTtlPicker (and any future
 * single-selection option group).
 *
 * @example
 * <ButtonGroup
 *   value={fontSize}
 *   onChange={setFontSize}
 *   options={[
 *     { value: 'small',  label: 'S' },
 *     { value: 'medium', label: 'M' },
 *     { value: 'large',  label: 'L' },
 *   ]}
 * />
 */

export interface ButtonGroupOption<T extends string | number> {
  value: T
  label: string
}

interface ButtonGroupProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  options: ButtonGroupOption<T>[]
  /** Extra Tailwind classes for the container `<div>`. */
  containerClassName?: string
}

export function ButtonGroup<T extends string | number>({
  value,
  onChange,
  options,
  containerClassName = '',
}: ButtonGroupProps<T>) {
  return (
    <div className={`flex items-center gap-1 ${containerClassName}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer',
            value === opt.value
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
