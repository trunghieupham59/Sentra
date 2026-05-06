import { TrashIcon } from './icons'

interface HistoryDeleteButtonProps {
  onClick: () => void
  label: string
}

export function HistoryDeleteButton({ onClick, label }: HistoryDeleteButtonProps) {
  return (
    <button type="button" onClick={onClick}
      className="btn-danger btn-sm"
    >
      <TrashIcon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}
