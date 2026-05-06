/**
 * RewriteButton — reusable AI-rewrite button for TranslatePage panels.
 *
 * Encapsulates the two-state icon logic (spinning → idle) that was previously
 * duplicated for the source and translated text panels.
 *
 * @example
 * <RewriteButton
 *   panel="source"
 *   isRewriting={isRewriting}
 *   onRewrite={handleRewrite}
 *   labelRewrite={t.translate_rewrite}
 *   labelRewriting={t.translate_rewriting}
 * />
 */
import { RewriteIcon, SpinnerIcon } from './icons'

export type RewritePanel = 'source' | 'translated'

interface RewriteButtonProps {
  /** Which panel this button controls */
  panel: RewritePanel
  /** Currently rewriting panel (null if idle) */
  isRewriting: RewritePanel | null
  onRewrite: (panel: RewritePanel) => void
  labelRewrite: string
  labelRewriting: string
}

export function RewriteButton({
  panel,
  isRewriting,
  onRewrite,
  labelRewrite,
  labelRewriting: _labelRewriting,
}: RewriteButtonProps) {
  const isThisPanel = isRewriting === panel
  const isAnyRewriting = isRewriting !== null

  return (
    <button
      type="button"
      onClick={() => onRewrite(panel)}
      title={labelRewrite}
      disabled={isAnyRewriting}
      className={[
        'btn-ghost btn-xs',
        isThisPanel
          ? 'btn-icon-active'
          : 'text-gray-400',
        isAnyRewriting && !isThisPanel ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {isThisPanel ? (
        <SpinnerIcon className="w-4 h-4 animate-spin" />
      ) : (
        <RewriteIcon />
      )}
    </button>
  )
}
