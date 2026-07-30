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

import { Button } from './atoms'
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
    <Button
      size="md"
      shape="icon"
      variant="neutral"
      appearance="ghost"
      onClick={() => onRewrite(panel)}
      title={isThisPanel ? labelRewriting : labelRewrite}
      aria-label={isThisPanel ? labelRewriting : labelRewrite}
      disabled={isAnyRewriting}
    >
      {isThisPanel ? (
        <SpinnerIcon className="w-4 h-4 animate-spin" />
      ) : (
        <RewriteIcon />
      )}
    </Button>
  )
}
