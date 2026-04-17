import { TrashIcon } from './icons'

interface HistoryDeleteButtonProps {
  onClick: () => void
  label: string
}

export function HistoryDeleteButton({ onClick, label }: HistoryDeleteButtonProps) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                 bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500
                 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400
                 font-medium transition-colors"
    >
      <TrashIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}
