import { useState, useEffect } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { ApiKeyInput } from '../components/ApiKeyInput'
import { PROVIDERS } from '../constants/providers'
import { Provider } from '../types'
import { AppLogoIcon } from '../components/AppLogo'
import { AppLocale, LOCALE_NAMES } from '../i18n'

const SUPPORTED_LOCALES: AppLocale[] = ['en', 'vi', 'ja']
function detectSystemLocale(): AppLocale {
  const lang = (navigator.language || 'en').split('-')[0]
  return SUPPORTED_LOCALES.includes(lang as AppLocale) ? (lang as AppLocale) : 'en'
}

export function SettingsPage() {
  const {
    setKeyStatus, autoTranslate, autoTranslateDelay,
    setAutoTranslate, setAutoTranslateDelay,
    showFurigana, setShowFurigana,
    locale, localeAuto, setLocale, setLocaleAuto, setLocaleFromSystem,
    setDynamicModels, keyStatus,
  } = useAppStore()
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

  const handleToggleLocaleAuto = () => {
    if (localeAuto) {
      // Turning off: keep current locale, mark as user-set
      setLocale(locale)
    } else {
      // Turning on: re-detect from system
      setLocaleAuto(true)
      setLocaleFromSystem(detectSystemLocale())
    }
  }

  const configuredCount = PROVIDERS.filter((p) => keyStatus[p.id] || keyData[p.id]?.exists).length

  return (
    <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50">{t.settings_title}</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{t.settings_subtitle}</p>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-950/30
                        border border-blue-100 dark:border-blue-900 rounded-xl">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{t.settings_security_title}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{t.settings_security_desc}</p>
          </div>
        </div>

        {/* API Keys */}
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

        {/* Preferences */}
        <section className="space-y-3">
          <h2 className="section-label">{t.settings_prefs}</h2>

          <div className="card divide-y divide-gray-100 dark:divide-gray-700">

            {/* Follow System Language toggle */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_locale_auto}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_locale_auto_desc}</p>
              </div>
              <button
                type="button"
                onClick={handleToggleLocaleAuto}
                aria-label={t.settings_locale_auto}
                className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors duration-200 ${
                  localeAuto ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  localeAuto ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* App Language selector */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_app_language}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_app_language_desc}</p>
              </div>
              <div className="relative">
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as AppLocale)}
                  className="select-field py-1.5 pl-3 pr-8 text-xs min-w-[130px]"
                >
                  {(Object.entries(LOCALE_NAMES) as [AppLocale, string][]).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 inset-y-0 flex items-center">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Translate Mode */}
            <div className="px-4 py-3.5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_translate_mode}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_translate_mode_desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoTranslate(true)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    autoTranslate
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${autoTranslate ? 'bg-white' : 'bg-green-400'}`} />
                    {t.settings_mode_auto}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAutoTranslate(false)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    !autoTranslate
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${!autoTranslate ? 'bg-white' : 'bg-gray-400'}`} />
                    {t.settings_mode_manual}
                  </span>
                </button>
              </div>
            </div>

            {/* Furigana toggle */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_furigana}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_furigana_desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFurigana(!showFurigana)}
                aria-label={t.settings_furigana}
                className={`relative inline-flex items-center w-9 h-5 rounded-full transition-colors duration-200 ${
                  showFurigana ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  showFurigana ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Delay slider (only for auto) */}
            {autoTranslate && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_translate_delay}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_translate_delay_desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={300}
                    max={2000}
                    step={100}
                    value={autoTranslateDelay}
                    onChange={(e) => setAutoTranslateDelay(Number(e.target.value))}
                    className="w-24 accent-blue-600"
                  />
                  <span className="text-xs text-gray-500 font-mono w-14 text-right tabular-nums">
                    {autoTranslateDelay}ms
                  </span>
                </div>
              </div>
            )}

          </div>
        </section>

        {/* About */}
        <section className="space-y-3">
          <h2 className="section-label">{t.settings_about}</h2>
          <div className="card px-4 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <AppLogoIcon size={44} />
                <div>
                  <p className="font-bold text-gray-900 dark:text-gray-50">TranslateApp</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_about_version}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t.settings_about_platform}: {window.api?.platform || 'web'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t.settings_about_supports}</p>
                <p className="text-xs text-gray-400">Google Gemini</p>
                <p className="text-xs text-gray-400">Anthropic Claude</p>
                <p className="text-xs text-gray-400">OpenAI GPT</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500">{t.settings_about_footer}</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
