import { DownloadIcon } from './icons'

interface DownloadImageButtonProps {
  onClick: () => void
  title: string
}

export function DownloadImageButton({ onClick, title }: DownloadImageButtonProps) {
  return (
    <button type="button" onClick={onClick} title={title} className="btn-icon">
      <DownloadIcon />
    </button>
  )
}
