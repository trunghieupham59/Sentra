import { useEffect, useState } from 'react'
import { ApiKeyInput } from '../../components/ApiKeyInput'
import { DeepResearchApiSection } from '../../components/chat/DeepResearchApiSection'
import { LockIcon } from '../../components/ui/icons'
import { PROVIDERS } from '../../constants/providers'
import { JINA_DOCS_URL } from '../../constants/urls'
import { useAppStore, useT } from '../../store/useAppStore'
import type { Provider } from '../../types'

export function ApiKeysSection() {
  const { setKeyStatus, keyStatus, setDynamicModels } = useAppStore()
  const t = useT()

  const [keyData, setKeyData] = useState<Record<string, { exists: boolean; masked: string | null }>>({
    gemini: { exists: false, masked: null },
    claude: { exists: false, masked: null },
    openai: { exists: false, masked: null },
  })

  useEffect(() => {
    const loadKeys = async () => {
      if (!window.api) return
      for (const p of PROVIDERS) {
        try {
          const result = await window.api.keychain.get(p.id)
          setKeyData((prev) => ({
            ...prev,
            [p.id]: { exists: result.exists ?? false, masked: result.masked ?? null },
          }))
          setKeyStatus(p.id as Provider, result.exists ?? false)
        } catch { /* ignore */ }
      }
    }
    loadKeys()
  }, [setKeyStatus])

  const handleSaveKey = async (providerId: string, key: string) => {
    if (!window.api) throw new Error('App API not available')
    const result = await window.api.keychain.save(providerId, key)
    if (!result.success) throw new Error(result.error || 'Failed to save key')
    const updated = await window.api.keychain.get(providerId)
    setKeyData((prev) => ({
      ...prev,
      [providerId]: { exists: updated.exists ?? false, masked: updated.masked ?? null },
    }))
    setKeyStatus(providerId as Provider, true)
    setDynamicModels(providerId as Provider, [])
  }

  const handleDeleteKey = async (providerId: string) => {
    if (!window.api) throw new Error('App API not available')
    await window.api.keychain.delete(providerId)
    setKeyData((prev) => ({
      ...prev,
      [providerId]: { exists: false, masked: null },
    }))
    setKeyStatus(providerId as Provider, false)
    setDynamicModels(providerId as Provider, [])
  }

  const configuredCount = PROVIDERS.filter((p) => keyStatus[p.id] || keyData[p.id]?.exists).length

  return (
    <>
      {/* Security notice */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30
                      border border-blue-100 dark:border-blue-900 rounded-xl">
        <LockIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{t.settings_security_title}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{t.settings_security_desc}</p>
        </div>
      </div>

      {/* AI Provider API Keys */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">{t.settings_api_keys}</h2>
          <span className="text-xs text-gray-400">
            {configuredCount}/{PROVIDERS.length} {t.settings_configured}
          </span>
        </div>
        {PROVIDERS.map((provider) => (
          <ApiKeyInput
            key={provider.id}
            provider={provider}
            hasKey={keyData[provider.id]?.exists ?? false}
            maskedKey={keyData[provider.id]?.masked ?? null}
            onSave={(key) => handleSaveKey(provider.id, key)}
            onDelete={() => handleDeleteKey(provider.id)}
          />
        ))}
      </section>

      {/* Deep Research Web Search API Keys */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">{t.settings_web_search_section}</h2>
        </div>

        {/* Info card */}
        <div className="flex items-start gap-3 px-4 py-3
                        bg-blue-50 dark:bg-blue-950/30
                        border border-blue-100 dark:border-blue-900 rounded-xl">
          <span className="text-base flex-shrink-0">🌐</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
              {t.settings_web_search_title}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {t.settings_web_search_desc_prefix}{' '}
              <button
                type="button"
                onClick={() => window.api?.openExternal(JINA_DOCS_URL)}
                className="underline cursor-pointer hover:text-blue-800 dark:hover:text-blue-200"
              >
                Jina AI
              </button>
              {' '}{t.settings_web_search_desc_suffix}
            </p>
          </div>
        </div>

        {/* Shared provider table */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden px-4 py-3">
          <DeepResearchApiSection />
        </div>
      </section>
    </>
  )
}
