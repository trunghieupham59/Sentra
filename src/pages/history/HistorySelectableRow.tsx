import type { ReactNode } from 'react'
import { CheckIcon, ChevronDownIcon } from '../../components/ui/icons'

type HistoryRowTone = 'blue' | 'purple'

const ROW_TONE_CLASSES: Record<HistoryRowTone, {
  selected: string
  idle: string
  checked: string
  unchecked: string
}> = {
  blue: {
    selected: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20',
    idle: 'border-gray-100 bg-white hover:border-blue-100 hover:bg-blue-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-950 dark:hover:bg-gray-800/50',
    checked: 'bg-blue-500 border-blue-500',
    unchecked: 'border-gray-300 dark:border-gray-600 hover:border-blue-400',
  },
  purple: {
    selected: 'border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/20',
    idle: 'border-gray-100 bg-white hover:border-purple-100 hover:bg-purple-50/30 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-purple-950 dark:hover:bg-gray-800/50',
    checked: 'bg-purple-500 border-purple-500',
    unchecked: 'border-gray-300 dark:border-gray-600 hover:border-purple-400',
  },
}

interface HistorySelectableRowProps {
  id: string
  isSelected: boolean
  isExpanded: boolean
  tone?: HistoryRowTone
  preview: ReactNode
  meta: ReactNode
  expandedContent: ReactNode
  onToggleSelect: (id: string) => void
  onToggleExpand: (id: string) => void
}

export function HistorySelectableRow({
  id,
  isSelected,
  isExpanded,
  tone = 'blue',
  preview,
  meta,
  expandedContent,
  onToggleSelect,
  onToggleExpand,
}: HistorySelectableRowProps) {
  const classes = ROW_TONE_CLASSES[tone]

  return (
    <li
      className={[
        'group rounded-lg border transition-colors duration-150',
        isSelected ? classes.selected : classes.idle,
      ].join(' ')}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleSelect(id)
          }}
          className="mt-0.5 flex-shrink-0"
        >
          <span className={[
            'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
            isSelected ? classes.checked : classes.unchecked,
          ].join(' ')}>
            {isSelected && <CheckIcon className="w-2.5 h-2.5 text-white" />}
          </span>
        </button>

        <button
          type="button"
          className="flex-1 min-w-0 text-left"
          onClick={() => onToggleExpand(id)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {preview}
            </div>
            <ChevronDownIcon
              className={`flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-transform duration-200 mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {meta}
          </div>
        </button>
      </div>

      {isExpanded && expandedContent}
    </li>
  )
}
