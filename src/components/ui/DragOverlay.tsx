/**
 * DragOverlay — visual feedback shown when the user drags a file over a
 * drop zone. Used in both TranslatePage (source panel) and ChatPage.
 *
 * Accepts a `label` prop for i18n text and optional `zIndex` / `showRing`
 * for small layout differences between the two drop zones.
 */
import { UploadIcon } from './icons'

interface DragOverlayProps {
  /** i18n label displayed below the upload icon */
  label: string
  /**
   * Tailwind z-index class applied to the outer overlay div.
   * TranslatePage uses 'z-30' (inside a section);
   * ChatPage uses 'z-50' (full-page absolute overlay).
   * @default 'z-30'
   */
  zIndex?: 'z-30' | 'z-50'
  /**
   * When true, adds an emerald ring around the overlay container —
   * used by ChatPage where the entire page is the drop zone.
   * @default false
   */
  showRing?: boolean
}

export function DragOverlay({ label, zIndex = 'z-30', showRing = false }: DragOverlayProps) {
  return (
    <div
      className={`absolute inset-0 ${zIndex} flex items-center justify-center pointer-events-none
                  ${showRing ? 'ring-2 ring-inset ring-emerald-300 dark:ring-emerald-700' : ''}`}
    >
      <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-lg
                      bg-white/90 dark:bg-gray-900/90 border-2 border-dashed border-emerald-400
                      shadow-lg">
        <UploadIcon className="w-8 h-8 text-emerald-500" />
        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {label}
        </span>
      </div>
    </div>
  )
}
