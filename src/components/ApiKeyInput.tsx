import { useState } from 'react'
import { ProviderConfig } from '../types'
import { ProviderIcon, PROVIDER_COLORS } from './ProviderIcon'
import { useT } from '../store/useAppStore'

interface ApiKeyInputProps {
  provider: ProviderConfig
  onSave: (key: string) => Promise<void>
  onDelete: () => Promise<void>
  hasKey: boolean
  maskedKey: string | null
}

type VerifyStatus = 'idle' | 'verifying' | 'valid' | 'invalid' | 'rate_limited' | 'network_error'

export function ApiKeyInput({ provider, onSave, onDelete, hasKey, maskedKey }: ApiKeyInputProps) {
  const t = useT()
  const [inputValue, setInputValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyMessage, setVerifyMessage] = useState('')

  const colors = PROVIDER_COLORS[provider.id]

  const handleVerifyAndSave = async () => {
    if (!inputValue.trim()) return
    setVerifyStatus('verifying')
    setVerifyMessage('')
    try {
      const result = await window.api.verifyKey(provider.id, inputValue.trim())
      if (result.success || result.valid) {
        await onSave(inputValue.trim())
        setVerifyStatus('valid')
        setVerifyMessage(result.valid ? t.settings_msg_rate_limited : t.settings_msg_valid)
        setInputValue('')
        setTimeout(() => setVerifyStatus('idle'), 4000)
      } else {
        switch (result.errorCode) {
          case 'INVALID_KEY':
            setVerifyStatus('invalid')
            setVerifyMessage(t.settings_msg_invalid)
            break
          case 'RATE_LIMIT':
            await onSave(inputValue.trim())
            setVerifyStatus('rate_limited')
            setVerifyMessage(t.settings_msg_rate_limited)
            setInputValue('')
            setTimeout(() => setVerifyStatus('idle'), 4000)
            break
          case 'NETWORK':
            setVerifyStatus('network_error')
            setVerifyMessage(t.settings_msg_network)
            break
          default:
            setVerifyStatus('invalid')
            setVerifyMessage(`✗ ${result.error || 'Verification failed'}`)
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
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerifyAndSave()
  }

  const isVerifying = verifyStatus === 'verifying'

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
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          hasKey
            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span>{hasKey ? t.settings_key_saved : t.settings_no_key}</span>
        </div>
      </div>

      {/* Current saved key display */}
      {hasKey && maskedKey && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono flex-1 truncate">
            {showKey ? maskedKey : '••••••••••••••••••••••••••••••••'}
          </span>
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-2 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0"
          >
            {showKey ? t.settings_hide : t.settings_show}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0"
          >
            {isDeleting ? '…' : t.settings_remove}
          </button>
        </div>
      )}

      {/* Input + Verify button */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              if (verifyStatus !== 'idle') setVerifyStatus('idle')
            }}
            onKeyDown={handleKeyDown}
            placeholder={hasKey ? `Enter new key to replace…` : `Paste your ${provider.name} API key…`}
            className={`w-full px-3 py-2 bg-white dark:bg-gray-700 border rounded-lg text-sm font-mono
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        text-gray-800 dark:text-gray-200 placeholder-gray-400 transition-colors ${
              verifyStatus === 'valid' || verifyStatus === 'rate_limited'
                ? 'border-green-400 dark:border-green-600'
                : verifyStatus === 'invalid'
                ? 'border-red-400 dark:border-red-600'
                : 'border-gray-200 dark:border-gray-600'
            }`}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <button
          type="button"
          onClick={handleVerifyAndSave}
          disabled={!inputValue.trim() || isVerifying}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                      whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
            verifyStatus === 'valid' || verifyStatus === 'rate_limited'
              ? 'bg-green-600 text-white hover:bg-green-700'
              : verifyStatus === 'invalid'
              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {isVerifying ? (
            <>
              <svg className="w-4 h-4 spinner" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t.settings_verifying}
            </>
          ) : verifyStatus === 'valid' || verifyStatus === 'rate_limited' ? (
            `✓ ${t.settings_verified}`
          ) : verifyStatus === 'invalid' ? (
            t.settings_try_again
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t.settings_verify_save}
            </>
          )}
        </button>
      </div>

      {/* Verify message */}
      {verifyMessage && (
        <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
          verifyStatus === 'valid' || verifyStatus === 'rate_limited'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800'
            : verifyStatus === 'network_error'
            ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300 border border-yellow-200'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800'
        }`}>
          {verifyMessage}
        </div>
      )}

      {/* Hint */}
      {verifyStatus === 'idle' && !verifyMessage && (
        <p className="text-xs text-gray-400 dark:text-gray-500">{t.settings_hint_verify}</p>
      )}
    </div>
  )
}
