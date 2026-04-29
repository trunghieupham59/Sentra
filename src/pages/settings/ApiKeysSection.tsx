import { useEffect, useState } from 'react'
import { ApiKeyInput } from '../../components/ApiKeyInput'
import { DeepResearchApiSection } from '../../components/chat/DeepResearchApiSection'
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
    <div className="space-y-8">
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
      <section className="space-y-3 border-t border-gray-200 pt-6 dark:border-gray-700">
        <div>
          <h2 className="section-label">{t.settings_web_search_section}</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t.settings_web_search_desc_prefix}{' '}
            <button
              type="button"
              onClick={() => window.api?.openExternal(JINA_DOCS_URL)}
              className="text-blue-500 hover:text-blue-700 hover:underline"
            >
              Jina AI
            </button>
            {' '}{t.settings_web_search_desc_suffix}
          </p>
        </div>

        {/* Shared provider table */}
        <DeepResearchApiSection />
      </section>
    </div>
  )
}
