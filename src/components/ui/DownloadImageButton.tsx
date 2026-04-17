import { DownloadIcon } from './icons'

interface DownloadImageButtonProps {
  onClick: () => void
  title: string
}

export function DownloadImageButton({ onClick, title }: DownloadImageButtonProps) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="relative flex items-center justify-center w-8 h-8 rounded-full
                 transition-all duration-200 cursor-pointer
                 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                 dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
    >
      <DownloadIcon />
    </button>
  )
}
