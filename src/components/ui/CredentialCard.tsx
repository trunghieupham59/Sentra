import type { ReactNode } from 'react'
import { CheckCircleIcon, CheckIcon, SpinnerIcon, TrashIcon } from './icons'

export type CredentialMessageTone = 'success' | 'warning' | 'error'

interface CredentialLabels {
  saved: string
  empty: string
  invalid: string
  remove: string
  verifying: string
  verified: string
  tryAgain: string
  submit: string
}

interface CredentialStatusBadgeProps {
  hasSecret: boolean
  isSuccess?: boolean
  isError?: boolean
  labels: Pick<CredentialLabels, 'saved' | 'empty' | 'invalid'>
}

export function CredentialStatusBadge({ hasSecret, isSuccess = false, isError = false, labels }: CredentialStatusBadgeProps) {
  if (isError) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 flex-shrink-0">
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        {labels.invalid}
      </span>
    )
  }

  if (isSuccess || hasSecret) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex-shrink-0">
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          <span className={[
            'absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75',
            isSuccess ? 'animate-ping' : 'animate-pulse',
          ].join(' ')} />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
        {labels.saved}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 flex-shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
      {labels.empty}
    </span>
  )
}

interface CredentialSecretInputRowProps {
  inputValue: string
  maskedValue: string | null
  showMasked: boolean
  placeholder: string
  hasSecret: boolean
  isBusy?: boolean
  isSuccess?: boolean
  isError?: boolean
  isDeleting?: boolean
  labels: Pick<CredentialLabels, 'remove' | 'verifying' | 'verified' | 'tryAgain' | 'submit'>
  onInputChange: (value: string) => void
  onSubmit: () => void
  onDelete: () => void
  onStatusReset?: () => void
}

export function CredentialSecretInputRow({
  inputValue,
  maskedValue,
  showMasked,
  placeholder,
  hasSecret,
  isBusy = false,
  isSuccess = false,
  isError = false,
  isDeleting = false,
  labels,
  onInputChange,
  onSubmit,
  onDelete,
  onStatusReset,
}: CredentialSecretInputRowProps) {
  const handleInputChange = (value: string) => {
    onInputChange(value)
    onStatusReset?.()
  }

  return (
    <div className="flex gap-2">
      <div className="flex-1 relative">
        <input
          type="password"
          value={showMasked ? (maskedValue ?? '********************************') : inputValue}
          readOnly={showMasked}
          onChange={showMasked ? undefined : (e) => handleInputChange(e.target.value)}
          onClick={showMasked ? () => onInputChange('') : undefined}
          onKeyDown={(e) => { if (e.key === 'Enter' && !showMasked) onSubmit() }}
          placeholder={placeholder}
          className={[
            'w-full px-3 py-2 border rounded-lg text-sm font-mono',
            'focus:outline-none focus:ring-2 focus:ring-blue-500',
            'text-gray-800 dark:text-gray-200 placeholder-gray-400 transition-colors',
            showMasked
              ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 cursor-pointer pr-9'
              : isSuccess
                ? 'bg-white dark:bg-gray-700 border-green-400 dark:border-green-600'
                : isError
                  ? 'bg-white dark:bg-gray-700 border-red-400 dark:border-red-600'
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600',
          ].join(' ')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {showMasked && hasSecret && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            title={labels.remove}
            className="absolute right-2 inset-y-0 flex items-center text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
          >
            {isDeleting ? (
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {!showMasked && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={!inputValue.trim() || isBusy}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            'whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
            isSuccess
              ? 'bg-green-600 text-white hover:bg-green-700'
              : isError
                ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
          ].join(' ')}
        >
          {isBusy ? (
            <>
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              {labels.verifying}
            </>
          ) : isSuccess ? (
            <>
              <CheckIcon className="w-4 h-4" />
              {labels.verified}
            </>
          ) : isError ? (
            labels.tryAgain
          ) : (
            <>
              <CheckCircleIcon className="w-4 h-4" />
              {labels.submit}
            </>
          )}
        </button>
      )}
    </div>
  )
}

interface CredentialStatusMessageProps {
  message: string
  tone: CredentialMessageTone
}

export function CredentialStatusMessage({ message, tone }: CredentialStatusMessageProps) {
  return (
    <div className={[
      'px-3 py-2 rounded-lg text-xs font-medium',
      tone === 'success'
        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800'
        : tone === 'warning'
          ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 border border-yellow-200'
          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800',
    ].join(' ')}>
      {message}
    </div>
  )
}

interface CredentialCardProps {
  icon: ReactNode
  title: string
  docsLabel: string
  labels: CredentialLabels
  inputValue: string
  maskedValue: string | null
  placeholder: string
  hasSecret: boolean
  isBusy?: boolean
  isSuccess?: boolean
  isError?: boolean
  isDeleting?: boolean
  statusMessage?: { text: string; tone: CredentialMessageTone }
  meta?: ReactNode
  onOpenDocs: () => void
  onInputChange: (value: string) => void
  onSubmit: () => void
  onDelete: () => void
  onStatusReset?: () => void
}

export function CredentialCard({
  icon,
  title,
  docsLabel,
  labels,
  inputValue,
  maskedValue,
  placeholder,
  hasSecret,
  isBusy = false,
  isSuccess = false,
  isError = false,
  isDeleting = false,
  statusMessage,
  meta,
  onOpenDocs,
  onInputChange,
  onSubmit,
  onDelete,
  onStatusReset,
}: CredentialCardProps) {
  const showMasked = hasSecret && inputValue === ''

  return (
    <div className="card p-4 space-y-3 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-700 flex-shrink-0">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <button
              type="button"
              onClick={onOpenDocs}
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
            >
              {docsLabel}
            </button>
            {meta && <div className="mt-1">{meta}</div>}
          </div>
        </div>
        <CredentialStatusBadge
          hasSecret={hasSecret}
          isSuccess={isSuccess}
          isError={isError}
          labels={labels}
        />
      </div>

      <CredentialSecretInputRow
        inputValue={inputValue}
        maskedValue={maskedValue}
        showMasked={showMasked}
        placeholder={placeholder}
        hasSecret={hasSecret}
        isBusy={isBusy}
        isSuccess={isSuccess}
        isError={isError}
        isDeleting={isDeleting}
        labels={labels}
        onInputChange={onInputChange}
        onSubmit={onSubmit}
        onDelete={onDelete}
        onStatusReset={onStatusReset}
      />

      {statusMessage && (
        <CredentialStatusMessage message={statusMessage.text} tone={statusMessage.tone} />
      )}
    </div>
  )
}
