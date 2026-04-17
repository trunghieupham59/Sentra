import { AlertTriangleIcon, XIcon } from '../ui/icons'

interface TranslateErrorProps {
  error: string
  /** True when error is due to missing/invalid API key — shows "Open Settings" button */
  isApiKeyError: boolean
  /** True when there is source text or image to retry */
  canRetry: boolean
  onRetry: () => void
  onDismiss: () => void
  onOpenSettings: () => void
  labelRetry: string
  labelOpenSettings: string
  labelDismiss: string
}

export function TranslateError({
  error, isApiKeyError, canRetry,
  onRetry, onDismiss, onOpenSettings,
  labelRetry, labelOpenSettings, labelDismiss,
}: TranslateErrorProps) {
  return (
    <div className="fade-in flex flex-col gap-2">
      <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30
                      border border-red-200 dark:border-red-900 rounded-lg">
        <AlertTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
        <p className="flex-1 text-sm text-red-700 dark:text-red-300 break-words">{error}</p>
        <button
          type="button"
          onClick={onDismiss}
          title={labelDismiss}
          className="flex-shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300
                     cursor-pointer transition-colors mt-0.5"
          aria-label={labelDismiss}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onRetry}
          disabled={!canRetry}
          className="btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {labelRetry}
        </button>
        {isApiKeyError && (
          <button type="button" onClick={onOpenSettings} className="btn-primary text-xs">
            {labelOpenSettings}
          </button>
        )}
      </div>
    </div>
  )
}
