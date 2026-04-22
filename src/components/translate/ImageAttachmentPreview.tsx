/**
 * ImageAttachmentPreview — displays an attached image in a Gemini-style
 * compact thumbnail with a hover-to-show remove button.
 * Used in the TranslatePage source panel.
 *
 * SPLIT-DUP-01: Now delegates to the shared ImagePreviewThumbnail component
 * instead of duplicating the JSX inline.
 */
import type { ImageAttachment } from './ImageTranslator'
import { ImagePreviewThumbnail } from '../ui/ImagePreviewThumbnail'

interface ImageAttachmentPreviewProps {
  /** The currently attached image */
  imageAttachment: ImageAttachment
  /** Called when the user clicks the × button to remove the image */
  onRemove: () => void
}

export function ImageAttachmentPreview({
  imageAttachment,
  onRemove,
}: ImageAttachmentPreviewProps) {
  return (
    <ImagePreviewThumbnail
      src={imageAttachment.previewDataUrl}
      alt={imageAttachment.fileName}
      removeTitle="Remove image"
      onRemove={onRemove}
    />
  )
}
