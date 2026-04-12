import { useState, useEffect } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { ApiKeyInput } from '../components/ApiKeyInput'
import { PROVIDERS } from '../constants/providers'
import { Provider, TtsVoice } from '../types'
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
    setAutoTranslateDelay,
    showFurigana, setShowFurigana,
    locale, localeAuto, setLocale, setLocaleAuto, setLocaleFromSystem,
    setDynamicModels, keyStatus,
    ttsVoice, setTtsVoice,
    fontSize, setFontSize,
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

            {/* Font Size */}
            <div className="flex items-center justify-between px-4 py-3.5 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_font_size}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_font_size_desc}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {([
                  ['small',  t.settings_font_size_small],
                  ['medium', t.settings_font_size_medium],
                  ['large',  t.settings_font_size_large],
                ] as ['small' | 'medium' | 'large', string][]).map(([size, label]) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setFontSize(size)}
                    className={[
                      'px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-150',
                      fontSize === size
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Phonetic / Phiên Âm toggle */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_furigana}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_furigana_desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFurigana(!showFurigana)}
                aria-label={t.settings_furigana}
                className={`flex-shrink-0 relative inline-flex items-center w-9 h-5 rounded-full transition-colors duration-200 ${
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

        {/* TTS Voice */}
        <section className="space-y-3">
          <h2 className="section-label">{t.settings_tts_section}</h2>
          <div className="card divide-y divide-gray-100 dark:divide-gray-700">
            <div className="flex items-center justify-between px-4 py-3.5 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_tts_voice}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_tts_voice_desc}</p>
              </div>
              <div className="relative flex-shrink-0">
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value as TtsVoice)}
                  className="select-field py-1.5 pl-3 pr-8 text-xs min-w-[200px]"
                >
                  {([
                    ['alloy',   t.settings_tts_voice_alloy],
                    ['echo',    t.settings_tts_voice_echo],
                    ['fable',   t.settings_tts_voice_fable],
                    ['onyx',    t.settings_tts_voice_onyx],
                    ['nova',    t.settings_tts_voice_nova],
                    ['shimmer', t.settings_tts_voice_shimmer],
                  ] as [TtsVoice, string][]).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 inset-y-0 flex items-center">
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Voice preview badges */}
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {([
                { id: 'alloy',   color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
                { id: 'echo',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
                { id: 'fable',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
                { id: 'onyx',    color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
                { id: 'nova',    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
                { id: 'shimmer', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
              ] as { id: TtsVoice; color: string }[]).map(({ id, color }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTtsVoice(id)}
                  className={[
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    'border transition-all duration-150 cursor-pointer select-none',
                    ttsVoice === id
                      ? `${color} border-current ring-1 ring-current`
                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700',
                  ].join(' ')}
                >
                  {ttsVoice === id && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                    </svg>
                  )}
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </button>
              ))}
            </div>
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
