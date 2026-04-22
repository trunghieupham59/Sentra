import { useState } from 'react'
import { useT } from '../store/useAppStore'
import type { ProviderConfig } from '../types'
import { tpl } from '../utils/tpl'
import { PROVIDER_COLORS, ProviderIcon } from './ProviderIcon'
import { CheckCircleIcon, CheckIcon, SpinnerIcon, TrashIcon } from './ui/icons'

interface ApiKeyInputProps {
  provider: ProviderConfig
  onSave: (key: string) => Promise<void>
  onDelete: () => Promise<void>
  hasKey: boolean
  maskedKey: string | null
}

type VerifyStatus = 'idle' | 'verifying' | 'valid' | 'rate_limited' | 'invalid' | 'network_error'

export function ApiKeyInput({ provider, onSave, onDelete, hasKey, maskedKey }: ApiKeyInputProps) {
  const t = useT()
  const [inputValue, setInputValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyMessage, setVerifyMessage] = useState('')

  const colors = PROVIDER_COLORS[provider.id]
  const isVerifying = verifyStatus === 'verifying'
  const isSuccess = verifyStatus === 'valid' || verifyStatus === 'rate_limited'
  const isError = verifyStatus === 'invalid' || verifyStatus === 'network_error'

  // Show masked dots in the input when a key is saved and the user hasn't started typing a new one
  const showMasked = hasKey && inputValue === ''

  const handleVerify = async () => {
    if (!inputValue.trim()) return
    setVerifyStatus('verifying')
    setVerifyMessage('')
    try {
      const result = await window.api.verifyKey(provider.id, inputValue.trim())
      if (result.success || result.valid) {
        await onSave(inputValue.trim())
        setVerifyStatus(result.valid ? 'rate_limited' : 'valid')
        setVerifyMessage(result.valid ? t.settings_msg_rate_limited : t.settings_msg_valid)
        setInputValue('')
        setTimeout(() => setVerifyStatus('idle'), 5000)
      } else {
        switch (result.errorCode) {
          case 'RATE_LIMIT':
            await onSave(inputValue.trim())
            setVerifyStatus('rate_limited')
            setVerifyMessage(t.settings_msg_rate_limited)
            setInputValue('')
            setTimeout(() => setVerifyStatus('idle'), 5000)
            break
          case 'INVALID_KEY':
            setVerifyStatus('invalid')
            setVerifyMessage(t.settings_msg_invalid)
            break
          case 'NETWORK':
            setVerifyStatus('network_error')
            setVerifyMessage(t.settings_msg_network)
            break
          default:
            setVerifyStatus('invalid')
            setVerifyMessage(`✗ ${result.error ?? 'Verification failed'}`)
        }
      }
    } catch (err) {
      setVerifyStatus('invalid')
      setVerifyMessage(`✗ ${err instanceof Error ? err.message : 'Unexpected error'}`)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`${t.settings_remove} API key for ${provider.name}?`)) return
    setIsDeleting(true)
    setVerifyStatus('idle')
    setVerifyMessage('')
    setInputValue('')
    try { await onDelete() } finally { setIsDeleting(false) }
  }

  // Badge element
  const badge = () => {
    if (isError) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          {t.settings_key_invalid}
        </span>
      )
    }
    if (isSuccess || hasKey) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
            {/* Ping animation on fresh verify; gentle pulse when key already saved */}
            <span className={[
              'absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75',
              isSuccess ? 'animate-ping' : 'animate-pulse',
            ].join(' ')} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          {t.settings_key_saved}
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
        {t.settings_no_key}
      </span>
    )
  }

  return (
    <div className={`card p-4 space-y-3 border-l-4 ${colors.border}`}>
      {/* Provider header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg} flex-shrink-0`}>
            <ProviderIcon provider={provider.id} size={22} />
          </div>
          <div>
            <h3 className={`font-semibold ${colors.text}`}>{provider.name}</h3>
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
              onClick={(e) => {
                e.preventDefault()
                if (window.api) window.open(provider.docsUrl, '_blank')
              }}
            >
              {t.settings_get_key}
            </a>
          </div>
        </div>
        {badge()}
      </div>

      {/* Input row — masked key shown inline; delete icon inside input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="password"
            value={showMasked ? (maskedKey ?? '••••••••••••••••••••••••••••••••') : inputValue}
            readOnly={showMasked}
            onChange={showMasked ? undefined : (e) => {
              setInputValue(e.target.value)
              if (verifyStatus !== 'idle') setVerifyStatus('idle')
            }}
            onClick={showMasked ? () => setInputValue('') : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter' && !showMasked) handleVerify() }}
            placeholder={hasKey ? t.settings_key_placeholder_new : tpl(t.settings_key_placeholder_paste, { name: provider.name })}
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
              showMasked ? '' : hasKey ? 'pr-3' : 'pr-3',
            ].join(' ')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {/* Delete icon — shown inside input when key exists and not editing */}
          {showMasked && hasKey && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              title={t.settings_remove}
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

        {/* Verify button — only shown when user is typing a new key */}
        {!showMasked && (
          <button
            type="button"
            onClick={handleVerify}
            disabled={!inputValue.trim() || isVerifying}
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
            {isVerifying ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                {t.settings_verifying}
              </>
            ) : isSuccess ? (
              <>
                <CheckIcon className="w-4 h-4" />
                {t.settings_verified}
              </>
            ) : isError ? (
              t.settings_try_again
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4" />
                {t.settings_verify_save}
              </>
            )}
          </button>
        )}
      </div>

      {/* Result message */}
      {verifyMessage && (
        <div className={[
          'px-3 py-2 rounded-lg text-xs font-medium',
          isSuccess
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800'
            : verifyStatus === 'network_error'
              ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 border border-yellow-200'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800',
        ].join(' ')}>
          {verifyMessage}
        </div>
      )}

      {/* Hint — only shown when idle and no key yet */}
      {verifyStatus === 'idle' && !verifyMessage && !showMasked && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{t.settings_hint_verify}</p>
      )}
    </div>
  )
}
