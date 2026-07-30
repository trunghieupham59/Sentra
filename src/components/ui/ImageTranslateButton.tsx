/**
 * ImageTranslateButton — circular ghost button that opens the image
 * translation modal. Styled with a neutral hover state.
 */

import { Button } from './atoms'
import { ImageIcon } from './icons'

interface ImageTranslateButtonProps {
  onClick: () => void
  /** Tooltip text, e.g. t.image_translate_title */
  title: string
  showLabel?: boolean
}

export function ImageTranslateButton({ onClick, title, showLabel = false }: ImageTranslateButtonProps) {
  return (
    <Button
      size="md"
      shape={showLabel ? 'rect' : 'icon'}
      variant="neutral"
      appearance="ghost"
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <ImageIcon />
      {showLabel && <span>{title}</span>}
    </Button>
  )
}
