import { Button } from '../ui/atoms'
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
      <div className="ui-error-box flex items-start gap-2" role="alert">
        <AlertTriangleIcon className="ui-error-icon w-4 h-4 flex-shrink-0 mt-0.5" />
        <p className="flex-1 break-words">{error}</p>
        <Button
          size="sm"
          shape="icon"
          variant="danger"
          appearance="ghost"
          onClick={onDismiss}
          title={labelDismiss}
          className="mt-0.5 flex-shrink-0"
          aria-label={labelDismiss}
        >
          <XIcon className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          shape="rect"
          variant="neutral"
          appearance="outline"
          onClick={onRetry}
          disabled={!canRetry}
        >
          {labelRetry}
        </Button>
        {isApiKeyError && (
          <Button size="sm" shape="rect" variant="primary" appearance="solid" onClick={onOpenSettings}>
            {labelOpenSettings}
          </Button>
        )}
      </div>
    </div>
  )
}
