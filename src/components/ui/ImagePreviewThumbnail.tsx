/**
 * ImagePreviewThumbnail — reusable 32×32 image preview with hover-to-reveal remove button.
 *
 * SPLIT-DUP-01: Extracted from ChatPage.tsx inline JSX and ImageAttachmentPreview.tsx
 * to eliminate near-duplicate UI pattern. Both now delegate to this component.
 *
 * Visual: 128×128 px thumbnail with rounded-3xl, shadow, and an absolutely-positioned
 * × button that appears on hover.
 */
import { XIcon } from './icons'

interface ImagePreviewThumbnailProps {
  /** Image src URL (data URL, object URL, etc.) */
  src: string
  /** Alt text for the image */
  alt: string
  /** Tooltip / aria-label for the remove button */
  removeTitle: string
  /** Called when user clicks the remove button */
  onRemove: () => void
}

export function ImagePreviewThumbnail({ src, alt, removeTitle, onRemove }: ImagePreviewThumbnailProps) {
  return (
    <div className="flex-shrink-0 px-4 pt-4 pb-1 flex items-start">
      <div className="relative group">
        <img
          src={src}
          alt={alt}
          className="w-32 h-32 object-cover rounded-3xl shadow-sm
                     border border-gray-200 dark:border-gray-700"
        />
        {/* × remove button — visible on hover */}
        <button
          type="button"
          onClick={onRemove}
          title={removeTitle}
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
