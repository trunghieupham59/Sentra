import { Button } from './atoms'
import { DownloadIcon } from './icons'

interface DownloadImageButtonProps {
  onClick: () => void
  title: string
}

export function DownloadImageButton({ onClick, title }: DownloadImageButtonProps) {
  return (
    <Button
      size="md"
      shape="icon"
      variant="neutral"
      appearance="ghost"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <DownloadIcon />
    </Button>
  )
}
