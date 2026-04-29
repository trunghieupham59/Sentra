import { CheckIcon, TrashIcon } from './icons'

interface HistoryBulkHeaderProps {
  countLabel: string
  totalCount: number
  selectedCount: number
  confirmClear: boolean
  labelSelectAll: string
  labelSelected: string
  labelDeleteSelected: string
  labelClear?: string
  labelConfirm?: string
  onSelectAll: () => void
  onDeleteSelected: () => void
  onClear?: () => void
  onBlur?: () => void
}

export function HistoryBulkHeader({
  countLabel,
  totalCount,
  selectedCount,
  confirmClear,
  labelSelectAll,
  labelSelected,
  labelDeleteSelected,
  labelClear,
  labelConfirm,
  onSelectAll,
  onDeleteSelected,
  onClear,
  onBlur,
}: HistoryBulkHeaderProps) {
  const isAllSelected = totalCount > 0 && selectedCount === totalCount
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount

  return (
  <div className="flex-shrink-0 grid grid-cols-[minmax(180px,1fr)_auto_minmax(180px,1fr)] items-center gap-3 h-[49px] px-4
                    border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900">
      <button
        type="button"
        onClick={onSelectAll}
        disabled={totalCount === 0}
        className="justify-self-start inline-flex items-center gap-2 text-xs font-medium text-gray-500
                   hover:text-gray-700 disabled:opacity-50 disabled:hover:text-gray-500
                   dark:text-gray-400 dark:hover:text-gray-200 dark:disabled:hover:text-gray-400 transition-colors"
      >
        <span className={[
          'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
          isAllSelected || isIndeterminate
            ? 'bg-blue-500 border-blue-500'
            : 'border-gray-300 dark:border-gray-600',
        ].join(' ')}>
          {isAllSelected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
          {isIndeterminate && !isAllSelected && <span className="w-2 h-0.5 bg-white rounded-full block" />}
        </span>
        {selectedCount > 0 ? labelSelected : labelSelectAll}
      </button>

      <span className="justify-self-center text-xs font-medium text-gray-500 dark:text-gray-400">
        {countLabel}
      </span>

      <div className="justify-self-end flex items-center gap-2">
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg
                     bg-red-50 text-red-600 hover:bg-red-100 disabled:invisible
                     dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/40
                     font-medium transition-colors"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          {labelDeleteSelected}
        </button>
        {onClear && labelClear && labelConfirm && (
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
        )}
      </div>
    </div>
  )
}
