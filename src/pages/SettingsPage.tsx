import { useState, useEffect } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import { ApiKeyInput } from '../components/ApiKeyInput'
import { PROVIDERS } from '../constants/providers'
import { Provider, TtsVoice, SystemPromptPreset } from '../types'
import { AppLogoIcon } from '../components/AppLogo'
import { AppLocale, LOCALE_NAMES } from '../i18n'

const SUPPORTED_LOCALES: AppLocale[] = ['en', 'vi', 'ja']
function detectSystemLocale(): AppLocale {
  const lang = (navigator.language || 'en').split('-')[0]
  return SUPPORTED_LOCALES.includes(lang as AppLocale) ? (lang as AppLocale) : 'en'
}

export function SettingsPage() {
  const {
    setKeyStatus, autoTranslate, setAutoTranslate, autoTranslateDelay,
    setAutoTranslateDelay,
    showFurigana, setShowFurigana,
    locale, localeAuto, setLocale, setLocaleAuto, setLocaleFromSystem,
    setDynamicModels, keyStatus,
    ttsVoice, setTtsVoice,
    fontSize, setFontSize,
    systemPromptPresets, addSystemPromptPreset, updateSystemPromptPreset,
    deleteSystemPromptPreset, setDefaultSystemPromptPreset,
    setChatSystemPrompt,
  } = useAppStore()
  const t = useT()

  // Preset form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetContent, setNewPresetContent] = useState('')
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editContent, setEditContent] = useState('')

  const handleAddPreset = () => {
    if (!newPresetName.trim() || !newPresetContent.trim()) return
    addSystemPromptPreset({ name: newPresetName.trim(), content: newPresetContent.trim() })
    setNewPresetName('')
    setNewPresetContent('')
    setShowAddForm(false)
  }

  const startEdit = (preset: SystemPromptPreset) => {
    setEditingPresetId(preset.id)
    setEditName(preset.name)
    setEditContent(preset.content)
  }

  const saveEdit = () => {
    if (!editingPresetId || !editName.trim() || !editContent.trim()) return
    updateSystemPromptPreset(editingPresetId, { name: editName.trim(), content: editContent.trim() })
    setEditingPresetId(null)
  }

  const cancelEdit = () => setEditingPresetId(null)

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

            {/* Auto / Manual translation mode toggle */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {autoTranslate ? 'Tự động dịch (Auto)' : 'Dịch thủ công (Manual)'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {autoTranslate
                    ? 'Tự động dịch khi bạn nhập. Tắt để dịch thủ công bằng nút Dịch.'
                    : 'Nhấn nút Dịch để thực hiện dịch. Bật để dịch tự động khi nhập.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoTranslate(!autoTranslate)}
                aria-label="Auto translate toggle"
                className={`flex-shrink-0 relative inline-flex items-center w-9 h-5 rounded-full transition-colors duration-200 ${
                  autoTranslate ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                  autoTranslate ? 'translate-x-[18px]' : 'translate-x-0.5'
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

        {/* AI Chat */}
        <section className="space-y-3">
          <h2 className="section-label">{t.settings_chat_section}</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">{t.settings_chat_section_desc}</p>
          <div className="card divide-y divide-gray-100 dark:divide-gray-700">


            {/* System Prompt Presets */}
            <div className="px-4 py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_chat_presets}</p>
                <button
                  type="button"
                  onClick={() => { setShowAddForm((v) => !v); setEditingPresetId(null) }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                             bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400
                             hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {t.settings_chat_preset_add}
                </button>
              </div>

              {/* Add form */}
              {showAddForm && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2 border border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder={t.settings_chat_preset_name_placeholder}
                    className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                               rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 dark:focus:border-blue-600
                               text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <textarea
                    value={newPresetContent}
                    onChange={(e) => setNewPresetContent(e.target.value)}
                    placeholder={t.chat_system_prompt_placeholder}
                    rows={3}
                    className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                               rounded-lg px-3 py-1.5 outline-none resize-none focus:border-blue-400 dark:focus:border-blue-600
                               text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setNewPresetName(''); setNewPresetContent('') }}
                      className="px-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                                 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      {t.settings_chat_preset_cancel}
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPreset}
                      disabled={!newPresetName.trim() || !newPresetContent.trim()}
                      className="px-3 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      {t.settings_chat_preset_save}
                    </button>
                  </div>
                </div>
              )}

              {/* Preset list */}
              {systemPromptPresets.length === 0 && !showAddForm ? (
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-2">{t.settings_chat_presets_empty}</p>
              ) : (
                <div className="space-y-2">
                  {systemPromptPresets.map((preset) => (
                    <div key={preset.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {editingPresetId === preset.id ? (
                        /* Edit mode */
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 space-y-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={t.settings_chat_preset_name_placeholder}
                            className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                                       rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 dark:focus:border-blue-600
                                       text-gray-800 dark:text-gray-200 placeholder-gray-400"
                          />
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            rows={3}
                            className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                                       rounded-lg px-3 py-1.5 outline-none resize-none focus:border-blue-400 dark:focus:border-blue-600
                                       text-gray-800 dark:text-gray-200"
                          />
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={cancelEdit}
                              className="px-3 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                                         text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                              {t.settings_chat_preset_cancel}
                            </button>
                            <button type="button" onClick={saveEdit}
                              disabled={!editName.trim() || !editContent.trim()}
                              className="px-3 py-1 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white
                                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                              {t.settings_chat_preset_save}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-white dark:bg-gray-800/50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{preset.name}</span>
                              {preset.isDefault && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-medium">
                                  {t.settings_chat_preset_is_default}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{preset.content}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Set default */}
                            {!preset.isDefault && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDefaultSystemPromptPreset(preset.id)
                                  setChatSystemPrompt(preset.content)
                                }}
                                title={t.settings_chat_preset_set_default}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                            {/* Apply to current prompt */}
                            <button
                              type="button"
                              onClick={() => setChatSystemPrompt(preset.content)}
                              title="Use this prompt"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            </button>
                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => startEdit(preset)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => deleteSystemPromptPreset(preset.id)}
                              title={t.settings_chat_preset_delete}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
