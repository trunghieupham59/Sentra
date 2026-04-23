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
  labelRewriting,
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
        'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
        'transition-all duration-200 cursor-pointer',
        isThisPanel
          ? 'bg-violet-500 text-white shadow-sm'
          : 'text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950 dark:hover:text-violet-400',
        isAnyRewriting && !isThisPanel ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {isThisPanel ? (
        <>
          <SpinnerIcon className="w-4 h-4 animate-spin" />
        </>
      ) : (
        <>
          <RewriteIcon />
        </>
      )}
    </button>
  )
}
