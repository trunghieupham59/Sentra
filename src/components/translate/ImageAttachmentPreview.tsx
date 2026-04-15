/**
 * ImageAttachmentPreview — displays an attached image with its file name and
 * a remove button. Used in the TranslatePage source panel.
 *
 * Extracted from TranslatePage.tsx to keep that component focused on layout
 * and translation logic.
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
    <div className="flex-shrink-0 mx-4 mt-3 relative rounded-xl overflow-hidden
                    bg-gray-100 dark:bg-gray-800
                    border border-gray-200 dark:border-gray-700
                    max-h-48 flex items-center justify-center">
      <img
        src={imageAttachment.previewDataUrl}
        alt={imageAttachment.fileName}
        className="max-w-full max-h-48 object-contain"
      />

      {/* × remove button */}
      <button
        type="button"
        onClick={onRemove}
        title="Remove image"
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center
                   rounded-full bg-black/50 hover:bg-black/70 text-white cursor-pointer z-10"
      >
        <XIcon className="w-3.5 h-3.5" />
      </button>

      {/* File name badge */}
      <div className="absolute bottom-0 inset-x-0 px-2 py-1
                      bg-black/40 text-white text-[10px] truncate">
        {imageAttachment.fileName}
      </div>
    </div>
  )
}
