import { Button } from './atoms'
import { TrashIcon } from './icons'

interface HistoryDeleteButtonProps {
  onClick: () => void
  label: string
}

export function HistoryDeleteButton({ onClick, label }: HistoryDeleteButtonProps) {
  return (
    <Button size="sm" shape="pill" variant="danger" appearance="soft" onClick={onClick}>
      <TrashIcon className="w-3.5 h-3.5" />
      {label}
    </Button>
  )
}
