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
    <div className="ui-error-banner flex items-center gap-2">
      <AlertTriangleIcon className="ui-error-icon w-3.5 h-3.5" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="btn-icon btn-icon-sm btn-icon-danger"
        >
          <XIcon className="w-3 h-3" />
        </button>
      )}
      {onRetry && retryLabel && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-link ui-error-text text-xs"
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
