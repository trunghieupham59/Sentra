/**
 * DeepResearchApiSection — Inline API key management for Deep Research providers.
 *
 * Shown inside the AI Config popup on ChatPage AND in the Settings App (ApiKeysSection).
 *
 * Provider priority (highest → lowest quality):
 *   1. Tavily   — Best for LLMs, requires key (app.tavily.com)
 *   2. Brave    — Good quality, requires key (api.search.brave.com)
 *   3. Jina AI  — Free forever, no key needed (default fallback)
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useAppStore, useT } from '../../store/useAppStore'
import { BraveSearchIcon, CheckCircleIcon, CheckIcon, SpinnerIcon, TavilyIcon, TrashIcon } from '../ui/icons'

// ─── Provider config ──────────────────────────────────────────────────────────

interface WebSearchProviderConfig {
  id: 'tavily' | 'brave'
  name: string
  docsUrl: string
  placeholder: string
  colors: {
    border: string
    bg: string
    text: string
  }
  icon: ReactNode
}

const WEB_SEARCH_PROVIDERS: WebSearchProviderConfig[] = [
  {
    id: 'tavily',
    name: 'Tavily',
    docsUrl: 'https://app.tavily.com',
    placeholder: 'tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    colors: {
      border: 'border-indigo-500',
      bg: 'bg-indigo-50 dark:bg-indigo-900/30',
      text: 'text-indigo-700 dark:text-indigo-300',
    },
    icon: <TavilyIcon size={22} />,
  },
  {
    id: 'brave',
    name: 'Brave Search',
    docsUrl: 'https://api.search.brave.com',
    placeholder: 'BSA1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    colors: {
      border: 'border-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-300',
    },
    icon: <BraveSearchIcon size={22} />,
  },
]

// ─── Single provider card ─────────────────────────────────────────────────────

type VerifyStatus = 'idle' | 'verifying' | 'saving' | 'valid' | 'invalid'

interface KeyCardProps {
  provider: WebSearchProviderConfig
  onStatusChange: (exists: boolean) => void
}

function KeyCard({ provider, onStatusChange }: KeyCardProps) {
  const [masked, setMasked] = useState<string | null>(null)
  const [exists, setExists] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyMessage, setVerifyMessage] = useState('')

  const t = useT()
  const { colors } = provider
  const isVerifying = verifyStatus === 'verifying' || verifyStatus === 'saving'
  const isSuccess = verifyStatus === 'valid'
  const isError = verifyStatus === 'invalid'

  // Show masked dots in the input when a key is saved and the user hasn't started typing
  const showMasked = exists && inputValue === ''

  useEffect(() => {
    if (!window.api) return
    window.api.keychain.get(provider.id).then((res) => {
      const e = res.exists ?? false
      setExists(e)
      setMasked(res.masked ?? null)
      onStatusChange(e)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id, onStatusChange])

  const handleVerify = async () => {
    const key = inputValue.trim()
    if (!key || !window.api) return
    setVerifyMessage('')

    // Step 1 — Verify the key
    if (typeof window.api.webSearchVerify === 'function') {
      setVerifyStatus('verifying')
      try {
        const verifyResult = await window.api.webSearchVerify({ provider: provider.id, apiKey: key })
        if (!verifyResult.valid) {
          setVerifyStatus('invalid')
          setVerifyMessage(verifyResult.error ?? t.settings_msg_invalid)
          return
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isIpcMissing =
          msg.includes('not a function') ||
          msg.includes('No handler registered') ||
          msg.includes('undefined') ||
          msg.includes('ERR_IPC')
        if (!isIpcMissing) {
          setVerifyStatus('invalid')
          setVerifyMessage(msg || t.settings_msg_invalid)
          return
        }
        // IPC not available → fall through to save directly
      }
    }

    // Step 2 — Save to secure keychain
    setVerifyStatus('saving')
    try {
      await window.api.keychain.save(provider.id, key)
      const updated = await window.api.keychain.get(provider.id)
      const e = updated.exists ?? false
      setExists(e)
      setMasked(updated.masked ?? null)
      onStatusChange(e)
      setVerifyStatus('valid')
      setVerifyMessage(t.settings_msg_valid)
      setInputValue('')
      const VERIFY_STATUS_RESET_MS = 5_000  // Reset verify badge after 5s
      setTimeout(() => setVerifyStatus('idle'), VERIFY_STATUS_RESET_MS)
    } catch (err) {
      setVerifyStatus('invalid')
      setVerifyMessage(err instanceof Error ? err.message : t.settings_msg_invalid)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`${t.settings_remove} API key for ${provider.name}?`)) return
    setIsDeleting(true)
    setVerifyStatus('idle')
    setVerifyMessage('')
    setInputValue('')
    try {
      await window.api.keychain.delete(provider.id)
      setExists(false)
      setMasked(null)
      onStatusChange(false)
    } catch { /* ignore */ } finally {
      setIsDeleting(false)
    }
  }

  // Status badge
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
    if (isSuccess || exists) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
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
            {provider.icon}
          </div>
          <div>
            <h3 className={`font-semibold ${colors.text}`}>{provider.name}</h3>
            <button
              type="button"
              onClick={() => window.api?.openExternal(provider.docsUrl)}
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
            >
              {t.settings_get_key}
            </button>
          </div>
        </div>
        {badge()}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="password"
            value={showMasked ? (masked ?? '••••••••••••••••••••••••••••••••') : inputValue}
            readOnly={showMasked}
            onChange={showMasked ? undefined : (e) => {
              setInputValue(e.target.value)
              if (verifyStatus !== 'idle') setVerifyStatus('idle')
            }}
            onClick={showMasked ? () => setInputValue('') : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter' && !showMasked) handleVerify() }}
            placeholder={exists ? t.settings_key_placeholder_new : provider.placeholder}
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
          {/* Delete icon — shown inside input when key exists and not editing */}
          {showMasked && exists && (
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

        {/* Verify & Save button — only shown when user is typing */}
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
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800',
        ].join(' ')}>
          {verifyMessage}
        </div>
      )}

    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function DeepResearchApiSection() {
  const { setHasTavilyKey, setHasBraveKey } = useAppStore()

  const statusHandlers: Record<'tavily' | 'brave', (exists: boolean) => void> = {
    tavily: setHasTavilyKey,
    brave: setHasBraveKey,
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Provider cards */}
      {WEB_SEARCH_PROVIDERS.map((provider) => (
        <KeyCard
          key={provider.id}
          provider={provider}
          onStatusChange={statusHandlers[provider.id]}
        />
      ))}

    </div>
  )
}
