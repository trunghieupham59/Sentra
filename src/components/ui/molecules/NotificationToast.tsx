import { Button } from '../atoms/Button'
import { AlertTriangleIcon, CheckCircleIcon, InfoCircleIcon, XIcon } from '../icons'

export type NotificationToastTone = 'info' | 'success' | 'warning' | 'error'

export interface NotificationToastProps {
  tone?: NotificationToastTone
  title?: string
  message: string
  actionLabel?: string
  onAction?: () => void
  dismissLabel?: string
  onDismiss?: () => void
  className?: string
}

function NotificationIcon({ tone }: { tone: NotificationToastTone }) {
  if (tone === 'success') return <CheckCircleIcon className="h-4 w-4" />
  if (tone === 'info') return <InfoCircleIcon className="h-4 w-4" />
  return <AlertTriangleIcon className="h-4 w-4" />
}

/** Props-driven notification surface; viewport placement remains with its owner. */
export function NotificationToast({
  tone = 'info',
  title,
  message,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
  className = '',
}: NotificationToastProps) {
  const role = tone === 'error' ? 'alert' : 'status'

  return (
    <section
      className={`notification-toast notification-toast--${tone}${className ? ` ${className}` : ''}`}
      role={role}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <span className="notification-toast-icon" aria-hidden="true">
        <NotificationIcon tone={tone} />
      </span>
      <span className="notification-toast-copy">
        {title && <span className="notification-toast-title">{title}</span>}
        <span className="notification-toast-message">{message}</span>
      </span>
      {(onAction || onDismiss) && (
        <span className="notification-toast-actions">
          {onAction && actionLabel && (
            <Button
              size="sm"
              shape="pill"
              variant="primary"
              appearance="outline"
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          )}
          {onDismiss && dismissLabel && (
            <Button
              size="sm"
              shape="icon"
              variant="neutral"
              appearance="ghost"
              onClick={onDismiss}
              title={dismissLabel}
              aria-label={dismissLabel}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          )}
        </span>
      )}
    </section>
  )
}
