/**
 * ImageTranslateButton — circular ghost button that opens the image
 * translation modal. Styled with an emerald hover state.
 */
import { ImageIcon } from './icons'

interface ImageTranslateButtonProps {
  onClick: () => void
  /** Tooltip text, e.g. t.image_translate_title */
  title: string
}

export function ImageTranslateButton({ onClick, title }: ImageTranslateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="relative flex items-center justify-center w-8 h-8 rounded-full
                 transition-all duration-200 cursor-pointer
                 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50
                 dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
    >
      <ImageIcon />
    </button>
  )
}
