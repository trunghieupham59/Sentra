/**
 * ImageAttachmentPreview — displays an attached image in a Gemini-style
 * compact thumbnail with a hover-to-show remove button.
 * Used in the TranslatePage source panel.
 */
import type { ImageAttachment } from '../ImageTranslator'
import { XIcon } from '../ui/icons'

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
    <div className="flex-shrink-0 px-4 pt-4 pb-1 flex items-start">
      <div className="relative group">
        <img
          src={imageAttachment.previewDataUrl}
          alt={imageAttachment.fileName}
          className="w-32 h-32 object-cover rounded-3xl shadow-sm
                     border border-gray-200 dark:border-gray-700"
        />

        {/* × remove button — visible on hover */}
        <button
          type="button"
          onClick={onRemove}
          title="Remove image"
          className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center
                     rounded-full bg-gray-700/90 hover:bg-gray-900 text-white cursor-pointer shadow-md
                     opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
