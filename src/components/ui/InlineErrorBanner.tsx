import { AlertTriangleIcon, XIcon } from './icons'

export interface InlineErrorBannerProps {
  message: string
  onDismiss?: () => void
  retryLabel?: string
  onRetry?: () => void
}

/**
 * Inline error banner — displays an error message with optional dismiss (X)
 * and retry actions. Reusable across settings sections.
 */
export function InlineErrorBanner({
  message,
  onDismiss,
  retryLabel,
  onRetry,
}: InlineErrorBannerProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400
                    bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2
                    border border-red-100 dark:border-red-900">
      <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-0.5 hover:text-red-700 cursor-pointer"
        >
          <XIcon className="w-3 h-3" />
        </button>
      )}
      {onRetry && retryLabel && (
        <button
          type="button"
          onClick={onRetry}
          className="underline font-medium cursor-pointer"
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
