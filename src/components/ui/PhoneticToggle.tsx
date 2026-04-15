/**
 * PhoneticToggle — pill-style toggle button for enabling / disabling
 * phonetic reading (furigana / romanisation) on the translation result.
 */

interface PhoneticToggleProps {
  showFurigana: boolean
  onChange: (value: boolean) => void
  /** Button label and tooltip text, e.g. t.translate_phonetic */
  label: string
}

export function PhoneticToggle({
  showFurigana,
  onChange,
  label,
}: PhoneticToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!showFurigana)}
      title={label}
      className={[
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium',
        'border transition-all duration-200 select-none cursor-pointer whitespace-nowrap',
        showFurigana
          ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900'
          : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700',
      ].join(' ')}
    >
      <span
        className={[
          'relative inline-flex shrink-0 items-center w-7 h-4 rounded-full transition-colors duration-200',
          showFurigana ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600',
        ].join(' ')}
      >
        <span
          className={[
            'absolute w-3 h-3 bg-white rounded-full shadow transition-transform duration-200',
            showFurigana ? 'translate-x-3.5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
      <span>{label}</span>
    </button>
  )
}
