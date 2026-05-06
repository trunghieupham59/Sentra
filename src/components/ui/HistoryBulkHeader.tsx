import { CheckIcon, TrashIcon } from './icons'

interface HistoryBulkHeaderProps {
  countLabel: string
  totalCount: number
  selectedCount: number
  labelSelectAll: string
  labelSelected: string
  labelDeleteSelected: string
  onSelectAll: () => void
  onDeleteSelected: () => void
}

export function HistoryBulkHeader({
  countLabel,
  totalCount,
  selectedCount,
  labelSelectAll,
  labelSelected,
  labelDeleteSelected,
  onSelectAll,
  onDeleteSelected,
}: HistoryBulkHeaderProps) {
  const isAllSelected = totalCount > 0 && selectedCount === totalCount
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount

  return (
    <div className="flex-shrink-0 flex items-center justify-between gap-3 h-[49px] px-4
                    border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900">
      <div className="min-w-0 flex items-center gap-3">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={totalCount === 0}
          className="btn-ghost btn-xs"
        >
          <span className={[
            'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
            isAllSelected || isIndeterminate
              ? 'bg-gray-500 border-gray-500'
              : 'border-gray-300 dark:border-gray-600',
          ].join(' ')}>
            {isAllSelected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
            {isIndeterminate && !isAllSelected && <span className="w-2 h-0.5 bg-white rounded-full block" />}
          </span>
          {selectedCount > 0 ? labelSelected : labelSelectAll}
        </button>

        <span className="h-4 w-px bg-gray-200 dark:bg-gray-800" />

        <span className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">
          {countLabel}
        </span>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          className="btn-danger btn-xs disabled:invisible"
        >
          <TrashIcon className="w-3.5 h-3.5" />
          {labelDeleteSelected}
        </button>
      </div>
    </div>
  )
}
