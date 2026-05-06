/**
 * ImageTranslateButton — circular ghost button that opens the image
 * translation modal. Styled with a neutral hover state.
 */
import { ImageIcon } from './icons'

interface ImageTranslateButtonProps {
  onClick: () => void
  /** Tooltip text, e.g. t.image_translate_title */
  title: string
  className?: string
}

export function ImageTranslateButton({ onClick, title, className = 'btn-icon' }: ImageTranslateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={className}
    >
      <ImageIcon />
    </button>
  )
}
