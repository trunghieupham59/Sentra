/**
 * HistoryClearHeader — header row showing item count and a clear-all button
 * with a two-step confirm pattern.
 *
 * Extracted from src/pages/history/historyUtils.tsx.
 * Reusable: props-only, no business logic, domain-agnostic pattern.
 */

interface HistoryClearHeaderProps {
  countLabel: string       // e.g. "5 mục" or "3 phiên"
  confirmClear: boolean
  labelClear: string       // e.g. t.history_clear_all
  labelConfirm: string     // e.g. t.history_clear_confirm
  onClear: () => void
  onBlur: () => void
}

export function HistoryClearHeader({
  countLabel, confirmClear, labelClear, labelConfirm, onClear, onBlur,
}: HistoryClearHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
                    bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      <span className="text-xs text-gray-400">{countLabel}</span>
      <button
        type="button"
        onClick={onClear}
        onBlur={onBlur}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 ${
          confirmClear
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
      >
        {confirmClear ? labelConfirm : labelClear}
      </button>
    </div>
  )
}
