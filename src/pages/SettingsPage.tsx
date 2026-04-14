import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiKeyInput } from '../components/ApiKeyInput'
import { AppLogoIcon } from '../components/AppLogo'
import { ToggleSwitch } from '../components/ui/ToggleSwitch'
import { PROVIDERS } from '../constants/providers'
import { type AppLocale, LOCALE_NAMES } from '../i18n'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider, SystemPromptPreset, TtsVoice } from '../types'
import { detectSystemLocale } from '../utils/locale'

// ─── Module-level types ───────────────────────────────────────────────────────
type ExtTokenInfo = { id: string; name: string; createdAt: number; expiresAt: number }
type UpdaterStatusType = {
  type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  error?: string
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
    // ── Hotkey / Browser integration ──
    selectedProvider, selectedModels, targetLang,
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

  // ── Global Hotkey state ────────────────────────────────────────────────────
  const [hotkeyEnabled, setHotkeyEnabled] = useState(false)
  const [hotkeyValue, setHotkeyValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [hotkeyError, setHotkeyError] = useState('')
  const [hotkeyStatus, setHotkeyStatus] = useState<'idle' | 'translating' | 'done' | 'error'>('idle')
  const [hotkeyStatusMsg, setHotkeyStatusMsg] = useState('')
  const hotkeyInputRef = useRef<HTMLButtonElement>(null)

  const hotkeyProvider = selectedProvider
  const hotkeyModel = selectedModels[selectedProvider]
  const hotkeyTargetLang = targetLang

  const DEFAULT_HOTKEY = 'Alt+Shift+T'

  // Load saved hotkey settings on mount
  useEffect(() => {
    if (!window.api?.hotkey) return
    window.api.hotkey.get().then((res: { success: boolean; settings?: Record<string, unknown> }) => {
      if (res?.success && res.settings) {
        const s = res.settings
        setHotkeyEnabled(s.enabled === true)
        setHotkeyValue(typeof s.hotkey === 'string' && s.hotkey ? s.hotkey : DEFAULT_HOTKEY)
      } else {
        // No saved settings: use default hotkey
        setHotkeyValue(DEFAULT_HOTKEY)
      }
    })
  }, [])

  // Listen for hotkey feedback events from main process
  useEffect(() => {
    if (!window.api?.hotkey) return
    const unsub1 = window.api.hotkey.onTranslating(() => {
      setHotkeyStatus('translating')
      setHotkeyStatusMsg(t.settings_hotkey_status_translating)
    })
    const unsub2 = window.api.hotkey.onTranslated(() => {
      setHotkeyStatus('done')
      setHotkeyStatusMsg(t.settings_hotkey_status_done)
      setTimeout(() => setHotkeyStatus('idle'), 3000)
    })
    const unsub3 = window.api.hotkey.onError((data: { error: string }) => {
      setHotkeyStatus('error')
      setHotkeyStatusMsg(data?.error ?? t.settings_hotkey_status_error)
      setTimeout(() => setHotkeyStatus('idle'), 5000)
    })
    return () => { unsub1(); unsub2(); unsub3() }
  }, [t])

  const saveHotkeySettings = useCallback(async (overrides: Record<string, unknown> = {}) => {
    if (!window.api?.hotkey) return
    const settings = {
      hotkey: hotkeyValue,
      enabled: hotkeyEnabled,
      provider: hotkeyProvider,
      model: hotkeyModel,
      targetLang: hotkeyTargetLang,
      ...overrides,
    }
    const res = await window.api.hotkey.update(settings)
    if (!res?.success && res?.error) {
      setHotkeyError(res.error)
      setHotkeyEnabled(false)
    } else {
      setHotkeyError('')
    }
  }, [hotkeyValue, hotkeyEnabled, hotkeyProvider, hotkeyModel, hotkeyTargetLang])

  // Convert a KeyboardEvent to an Electron accelerator string
  const keyEventToAccelerator = (e: React.KeyboardEvent): string => {
    const parts: string[] = []
    if (e.metaKey)  parts.push('Command')
    if (e.ctrlKey)  parts.push('Ctrl')
    if (e.altKey)   parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    const key = e.key
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      const mapped: Record<string, string> = {
        ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
        Escape: 'Escape', Enter: 'Return', Backspace: 'Backspace', Delete: 'Delete',
        Tab: 'Tab', F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
        F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
      }
      parts.push(mapped[key] ?? key.toUpperCase())
    }
    return parts.join('+')
  }

  // Auto-sync hotkey settings to backend whenever store values change
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveHotkeySettings is stable via useCallback; hotkeyEnabled/hotkeyValue accessed inside
  useEffect(() => {
    if (!window.api?.hotkey || !hotkeyValue) return
    saveHotkeySettings()
  }, [hotkeyProvider, hotkeyModel, hotkeyTargetLang])

  const handleHotkeyKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    if (e.key === 'Escape') {
      setIsRecording(false)
      return
    }
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return
    const acc = keyEventToAccelerator(e)
    if (acc) {
      setHotkeyValue(acc)
      setIsRecording(false)
      saveHotkeySettings({ hotkey: acc })
    }
  }

  // ── Extension token state (multi-token) ───────────────────────────────────
  const [extPort, setExtPort] = useState(39875)
  const [extTokens, setExtTokens] = useState<ExtTokenInfo[]>([])
  const [extTokensLoading, setExtTokensLoading] = useState(false)
  const [extTokensError, setExtTokensError] = useState('')

  // One-time token reveal — shown immediately after create or regenerate
  const [revealedToken, setRevealedToken] = useState<{ token: string; name: string; expiresAt: number } | null>(null)
  const [revealedCopied, setRevealedCopied] = useState(false)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenTtl, setNewTokenTtl] = useState(30)
  const [creating, setCreating] = useState(false)

  // Per-token actions
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [extPortCopied, setExtPortCopied] = useState(false)

  const handleCopyExtUrl = async () => {
    await navigator.clipboard.writeText(`http://localhost:${extPort}`)
    setExtPortCopied(true)
    setTimeout(() => setExtPortCopied(false), 2000)
  }

  const defaultTokenName = () => {
    const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    return `Chrome Extension - ${today}`
  }

  const loadTokenList = useCallback(async () => {
    if (!window.api?.localServer) {
      setExtTokensError('Không thể kết nối — đảm bảo app đang chạy qua Electron.')
      return
    }
    setExtTokensLoading(true)
    setExtTokensError('')
    try {
      const res = await window.api.localServer.listTokens()
      if (res?.success) {
        setExtTokens(res.tokens ?? [])
        setExtPort(res.port ?? 39875)
      } else {
        setExtTokensError('Không thể tải danh sách token.')
      }
    } catch (e) {
      setExtTokensError(`Lỗi IPC: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExtTokensLoading(false)
    }
  }, [])

  useEffect(() => { loadTokenList() }, [loadTokenList])

  // Tracks errors from token create/delete/regenerate operations
  const [tokenActionError, setTokenActionError] = useState<string>('')

  const handleCreateToken = async () => {
    if (!window.api?.localServer) return
    setCreating(true)
    setTokenActionError('')
    try {
      const res = await window.api.localServer.createToken({
        name: newTokenName.trim() || defaultTokenName(),
        ttlDays: newTokenTtl,
      })
      if (res?.success && res.token) {
        setRevealedToken({ token: res.token, name: res.name ?? '', expiresAt: res.expiresAt ?? 0 })
        setRevealedCopied(false)
        setShowCreateForm(false)
        setNewTokenName('')
        setNewTokenTtl(30)
        await loadTokenList()
      } else if (!res?.success) {
        setTokenActionError(res?.error ?? 'Không thể tạo token. Vui lòng thử lại.')
      }
    } catch (e) {
      setTokenActionError(e instanceof Error ? e.message : 'Không thể tạo token. Vui lòng thử lại.')
    } finally { setCreating(false) }
  }

  const handleDeleteToken = async (id: string) => {
    if (!window.api?.localServer) return
    setDeletingId(id)
    setTokenActionError('')
    try {
      await window.api.localServer.deleteToken({ id })
      setExtTokens(prev => prev.filter(t => t.id !== id))
      if (revealedToken) setRevealedToken(null)
    } catch (e) {
      setTokenActionError(e instanceof Error ? e.message : 'Không thể xóa token.')
    } finally { setDeletingId(null) }
  }

  const handleRegenerateToken = async (id: string) => {
    if (!window.api?.localServer) return
    setRegeneratingId(id)
    setTokenActionError('')
    try {
      const res = await window.api.localServer.regenerateToken({ id })
      if (res?.success && res.token) {
        setRevealedToken({ token: res.token, name: res.name ?? '', expiresAt: res.expiresAt ?? 0 })
        setRevealedCopied(false)
        await loadTokenList()
      } else if (!res?.success) {
        setTokenActionError(res?.error ?? 'Không thể cấp phát lại token.')
      }
    } catch (e) {
      setTokenActionError(e instanceof Error ? e.message : 'Không thể cấp phát lại token.')
    } finally { setRegeneratingId(null) }
  }

  const handleCopyRevealed = async () => {
    if (!revealedToken) return
    await navigator.clipboard.writeText(revealedToken.token)
    setRevealedCopied(true)
    setTimeout(() => setRevealedCopied(false), 2000)
  }

  // ── Legacy Assistant state ─────────────────────────────────────────────────
  const [laEnabled, setLaEnabled] = useState(false)
  const [laBookmarklet, setLaBookmarklet] = useState('')
  const [laBookmarkletCopied, setLaBookmarkletCopied] = useState(false)
  const isMac = window.api?.platform === 'darwin'

  // Use targetLang from global store (same as Translate page)
  const laTargetLang = targetLang

  useEffect(() => {
    if (!window.api?.legacyAssistant) return
    window.api.legacyAssistant.get().then((res: { success: boolean; settings?: Record<string, unknown> }) => {
      if (res?.success && res.settings) {
        const s = res.settings
        setLaEnabled(s.enabled === true)
      }
    })
  }, [])

  const loadBookmarklet = useCallback(async () => {
    if (!window.api?.legacyAssistant) return
    const res = await window.api.legacyAssistant.getBookmarklet()
    if (res?.success) setLaBookmarklet(res.bookmarklet ?? '')
  }, [])

  useEffect(() => { loadBookmarklet() }, [loadBookmarklet])

  // Auto-sync targetLang to legacy assistant backend when store changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: laEnabled accessed inside
  useEffect(() => {
    if (!window.api?.legacyAssistant) return
    window.api.legacyAssistant.update({ targetLang: laTargetLang })
    loadBookmarklet()
  }, [laTargetLang, loadBookmarklet])

  const handleLaToggle = async () => {
    const next = !laEnabled
    setLaEnabled(next)
    await window.api?.legacyAssistant?.update({ enabled: next, targetLang: laTargetLang })
  }

  const handleCopyBookmarklet = async () => {
    let url = laBookmarklet
    // If not loaded yet, try fetching it first
    if (!url && window.api?.legacyAssistant) {
      const res = await window.api.legacyAssistant.getBookmarklet()
      if (res?.success && res.bookmarklet) {
        url = res.bookmarklet
        setLaBookmarklet(url)
      }
    }
    if (!url) return
    await navigator.clipboard.writeText(url)
    setLaBookmarkletCopied(true)
    setTimeout(() => setLaBookmarkletCopied(false), 2000)
  }

  const handleInjectNow = () => {
    window.api?.legacyAssistant?.injectNow()
  }

  // ── Updater state ──────────────────────────────────────────────────────────
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatusType>({ type: 'idle' })
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    if (!window.api?.updater) return
    window.api.updater.getVersion().then((res: { version: string }) => {
      if (res?.version) setAppVersion(res.version)
    })
    const unsub = window.api.updater.onStatus((status) => {
      setUpdaterStatus(status as UpdaterStatusType)
    })
    return unsub
  }, [])

  const handleCheckUpdate = async () => {
    if (!window.api?.updater) return
    setUpdaterStatus({ type: 'checking' })
    await window.api.updater.check()
  }

  const handleDownloadUpdate = () => window.api?.updater?.download()
  const handleInstallUpdate  = () => window.api?.updater?.install()

  /** Simple template helper: replaces {key} placeholders */
  const tpl = (str: string, vars: Record<string, string | number>) =>
    str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

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
              <ToggleSwitch
                checked={localeAuto}
                onChange={handleToggleLocaleAuto}
                aria-label={t.settings_locale_auto}
              />
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
              <ToggleSwitch
                checked={showFurigana}
                onChange={setShowFurigana}
                aria-label={t.settings_furigana}
              />
            </div>

            {/* Auto / Manual translation mode toggle */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {`${t.settings_translate_mode} — ${autoTranslate ? t.settings_mode_auto : t.settings_mode_manual}`}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t.settings_translate_mode_desc}
                </p>
              </div>
              <ToggleSwitch
                checked={autoTranslate}
                onChange={setAutoTranslate}
                aria-label="Auto translate toggle"
                color="green"
              />
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

        {/* ── Global Hotkey ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <h2 className="section-label">{t.settings_hotkey_section}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_hotkey_section_desc}</p>
          </div>

          <div className="card divide-y divide-gray-100 dark:divide-gray-700">

            {/* Enable toggle */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_hotkey_enabled}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_hotkey_enabled_desc}</p>
              </div>
              <ToggleSwitch
                checked={hotkeyEnabled}
                onChange={(next) => {
                  setHotkeyEnabled(next)
                  saveHotkeySettings({ enabled: next })
                }}
                color="green"
              />
            </div>

            {/* Shortcut recorder */}
            <div className="px-4 py-3.5 space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_hotkey_label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_hotkey_desc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hotkeyValue && !isRecording && (
                    <button
                      type="button"
                      onClick={() => {
                        setHotkeyValue('')
                        setHotkeyEnabled(false)
                        saveHotkeySettings({ hotkey: '', enabled: false })
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                      title={t.settings_hotkey_clear}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <button
                    ref={hotkeyInputRef}
                    type="button"
                    onKeyDown={isRecording ? handleHotkeyKeyDown : undefined}
                    onClick={() => setIsRecording(true)}
                    onBlur={() => setIsRecording(false)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all min-w-[160px] text-center',
                      isRecording
                        ? 'bg-blue-50 dark:bg-blue-950 border-blue-400 text-blue-700 dark:text-blue-300 ring-2 ring-blue-300/50'
                        : hotkeyValue
                          ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
                          : 'bg-gray-50 dark:bg-gray-800/50 border-dashed border-gray-300 dark:border-gray-600 text-gray-400',
                    ].join(' ')}
                  >
                    {isRecording
                      ? t.settings_hotkey_recording
                      : hotkeyValue || t.settings_hotkey_none}
                  </button>
                </div>
              </div>
              {hotkeyError && (
                <p className="text-xs text-red-500 dark:text-red-400">{hotkeyError}</p>
              )}
            </div>

            {/* Status indicator */}
            {hotkeyStatus !== 'idle' && (
              <div className={`px-4 py-3 flex items-center gap-2 text-xs ${
                hotkeyStatus === 'translating' ? 'text-blue-600 dark:text-blue-400' :
                hotkeyStatus === 'done' ? 'text-green-600 dark:text-green-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {hotkeyStatus === 'translating' && (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                <span>{hotkeyStatusMsg}</span>
              </div>
            )}

          </div>
        </section>

        {/* ── Legacy Browser Translate (Legacy Assistant + Chrome Extension) ── */}
        <section className="space-y-3">
          <div>
            <h2 className="section-label">Legacy Browser Translate</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Dịch trực tiếp trên trình duyệt — không cần rời khỏi trang web</p>
          </div>

          {/* ── Legacy Assistant card ── */}
          <div className="card divide-y divide-gray-100 dark:divide-gray-700">

            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Legacy Assistant</p>
            </div>

            {/* Auto-inject toggle — macOS only */}
            {isMac ? (
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_la_auto_enabled}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_la_auto_enabled_desc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleInjectNow}
                    className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                               text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    {t.settings_la_inject_now}
                  </button>
                  <ToggleSwitch
                    checked={laEnabled}
                    onChange={() => handleLaToggle()}
                    color="green"
                  />
                </div>
              </div>
            ) : (
              <div className="px-4 py-3.5">
                <p className="text-xs text-amber-600 dark:text-amber-400">{t.settings_la_macos_only}</p>
              </div>
            )}

            {/* Bookmarklet */}
            <div className="px-4 py-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Bookmarklet</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Hoạt động trên mọi trình duyệt, mọi nền tảng — không cần cài extension
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {/* Step 1: Drag */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Kéo vào thanh bookmark của trình duyệt</p>
                    {laBookmarklet ? (
                      <a
                        href={laBookmarklet}
                        onClick={(e) => e.preventDefault()}
                        draggable
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                                   bg-white dark:bg-gray-700 border-2 border-dashed border-blue-300 dark:border-blue-700
                                   text-sm font-medium text-blue-700 dark:text-blue-300
                                   cursor-grab active:cursor-grabbing select-none
                                   hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                      >
                        <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                        🌐 Lotus Translate
                        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4" />
                        </svg>
                      </a>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm text-gray-400 dark:text-gray-500">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Đang tải...
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Hoặc sao chép URL và tự tạo bookmark</p>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {/* Copy bookmarklet URL */}
                      <button
                        type="button"
                        onClick={handleCopyBookmarklet}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border transition-colors cursor-pointer font-medium ${
                          laBookmarkletCopied
                            ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600'
                        }`}
                      >
                        {laBookmarkletCopied ? (
                          <>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Đã sao chép!
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            Sao chép URL
                          </>
                        )}
                      </button>
                      {/* Replace / reload bookmarklet */}
                      <button
                        type="button"
                        onClick={loadBookmarklet}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border border-gray-200 dark:border-gray-600
                                   bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300
                                   hover:border-amber-400 hover:text-amber-600 transition-colors cursor-pointer font-medium"
                        title="Tải lại bookmarklet từ server"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Tải lại
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2: Use */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Vào trang web → Click bookmark → Bôi đen text → Dịch!</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Icon Lotus xuất hiện góc dưới-phải · Dịch sang:{' '}
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        {(t.lang_names as Record<string, string>)[laTargetLang] ?? laTargetLang}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── Chrome Extension token card ── */}
          <div className="card divide-y divide-gray-100 dark:divide-gray-700">

            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Chrome Extension</p>
            </div>

            {/* ── Create token ── */}
            <div className="px-4 py-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Quản lý Token</p>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-blue-200 dark:border-blue-800
                             bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400
                             hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer font-medium"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Tạo Token Mới
                </button>
              </div>

              {/* Create form */}
              {showCreateForm && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-3 border border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <label htmlFor="new-token-name" className="text-xs font-medium text-gray-700 dark:text-gray-300">Tên token</label>
                    <input
                      id="new-token-name"
                      type="text"
                      value={newTokenName}
                      onChange={(e) => setNewTokenName(e.target.value)}
                      placeholder={defaultTokenName()}
                      className="w-full text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                                 rounded-lg px-3 py-2 outline-none focus:border-blue-400 dark:focus:border-blue-600
                                 text-gray-800 dark:text-gray-200 placeholder-gray-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Thời hạn</p>
                    <div className="flex gap-2 flex-wrap">
                      {([
                        { days: 7,   label: '7 ngày' },
                        { days: 30,  label: '30 ngày' },
                        { days: 90,  label: '90 ngày' },
                        { days: 365, label: '1 năm' },
                      ] as { days: number; label: string }[]).map(({ days, label }) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setNewTokenTtl(days)}
                          className={`px-3 py-1 text-xs rounded-lg border transition-all cursor-pointer ${
                            newTokenTtl === days
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => { setShowCreateForm(false); setNewTokenName(''); setNewTokenTtl(30) }}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                                 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >
                      Huỷ
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateToken}
                      disabled={creating}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white
                                 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer font-medium"
                    >
                      {creating && (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      )}
                      Generate Token
                    </button>
                  </div>
                </div>
              )}

              {/* ── One-time token reveal ── */}
              {revealedToken && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 text-sm flex-shrink-0">🔑</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                        Token "{revealedToken.name}" — sao chép ngay!
                      </p>
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                        Token này chỉ hiện <strong>một lần duy nhất</strong>. Sau khi đóng sẽ không xem lại được.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRevealedToken(null)}
                      className="p-1 text-amber-400 hover:text-amber-600 cursor-pointer flex-shrink-0"
                      title="Đóng"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
                    <code className="text-xs text-gray-800 dark:text-gray-200 font-mono break-all flex-1 select-all">
                      {revealedToken.token}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyRevealed}
                      className={`flex-shrink-0 px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer font-medium ${
                        revealedCopied
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                      }`}
                    >
                      {revealedCopied ? '✓ Đã sao chép' : 'Sao chép'}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-500 dark:text-amber-400">
                    🔒 Hết hạn: {new Date(revealedToken.expiresAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </p>
                </div>
              )}

              {/* ── Token action error (create/delete/regenerate) ── */}
              {tokenActionError && (
                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900">
                  <span>⚠</span>
                  <span className="flex-1">{tokenActionError}</span>
                  <button type="button" onClick={() => setTokenActionError('')} className="p-0.5 hover:text-red-700 cursor-pointer" title="Đóng">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              )}

              {/* ── Token list ── */}
              {extTokensError && (
                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900">
                  <span>⚠</span>
                  <span className="flex-1">{extTokensError}</span>
                  <button type="button" onClick={loadTokenList} className="underline font-medium cursor-pointer">Thử lại</button>
                </div>
              )}

              {extTokensLoading && (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Đang tải...
                </div>
              )}

              {!extTokensLoading && extTokens.length === 0 && !extTokensError && (
                <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-3 italic">
                  Chưa có token nào. Nhấn "+ Tạo Token Mới" để bắt đầu.
                </p>
              )}

              {extTokens.length > 0 && (
                <div className="space-y-2">
                  {extTokens.map((tk) => {
                    const now = Date.now()
                    const msLeft = tk.expiresAt - now
                    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
                    const expired = msLeft <= 0
                    const expireDate = new Date(tk.expiresAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    const isRegen = regeneratingId === tk.id
                    const isDel = deletingId === tk.id
                    return (
                      <div key={tk.id} className="flex items-center gap-3 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{tk.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {expired ? (
                              <span className="text-[10px] text-red-500 font-medium">🔴 Đã hết hạn</span>
                            ) : daysLeft <= 7 ? (
                              <span className="text-[10px] text-amber-500 font-medium">⚠️ Còn {daysLeft} ngày ({expireDate})</span>
                            ) : (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">🔒 Hết hạn {expireDate} · còn {daysLeft} ngày</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Regenerate */}
                          <button
                            type="button"
                            onClick={() => handleRegenerateToken(tk.id)}
                            disabled={isRegen || isDel}
                            title="Tạo lại token mới (giá trị cũ hết hiệu lực)"
                            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg border border-gray-200 dark:border-gray-600
                                       text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer
                                       disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isRegen ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            )}
                            Tạo lại
                          </button>
                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteToken(tk.id)}
                            disabled={isDel || isRegen}
                            title="Xóa token — hết hiệu lực ngay"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950
                                       transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {isDel ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Port info + Copy URL */}
            <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
              <span>{t.settings_extension_port}</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                  {extPort}
                </code>
                <button
                  type="button"
                  onClick={handleCopyExtUrl}
                  title="Sao chép URL kết nối"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                    extPortCopied
                      ? 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800'
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {extPortCopied ? (
                    <>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Đã sao chép!
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy URL
                    </>
                  )}
                </button>
              </div>
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

        {/* ── Updates ──────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div>
            <h2 className="section-label">{t.settings_update_section}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_update_section_desc}</p>
          </div>

          <div className="card divide-y divide-gray-100 dark:divide-gray-700">

            {/* Current version + Check button */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_update_current_version}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                  v{appVersion || window.api?.version || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={updaterStatus.type === 'checking' || updaterStatus.type === 'downloading'}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  updaterStatus.type === 'downloaded'
                    ? 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:text-blue-600',
                ].join(' ')}
              >
                {updaterStatus.type === 'checking' && (
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {updaterStatus.type === 'checking'
                  ? t.settings_update_checking
                  : t.settings_update_check}
              </button>
            </div>

            {/* Status row — shown when not idle */}
            {updaterStatus.type !== 'idle' && updaterStatus.type !== 'checking' && (
              <div className="px-4 py-3 space-y-2">

                {/* Update available */}
                {updaterStatus.type === 'available' && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>{tpl(t.settings_update_available, { version: updaterStatus.version ?? '' })}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadUpdate}
                      className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors cursor-pointer"
                    >
                      {t.settings_update_download}
                    </button>
                  </div>
                )}

                {/* Up to date */}
                {updaterStatus.type === 'not-available' && (
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{tpl(t.settings_update_not_available, { version: updaterStatus.version ?? appVersion ?? '' })}</span>
                  </div>
                )}

                {/* Downloading */}
                {updaterStatus.type === 'downloading' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                      <span className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        {tpl(t.settings_update_downloading, { percent: updaterStatus.percent ?? 0 })}
                      </span>
                      <span className="text-gray-400 text-[10px] tabular-nums">
                        {updaterStatus.percent ?? 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${updaterStatus.percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Downloaded — ready to install */}
                {updaterStatus.type === 'downloaded' && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{tpl(t.settings_update_downloaded, { version: updaterStatus.version ?? '' })}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleInstallUpdate}
                      className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors cursor-pointer"
                    >
                      {t.settings_update_install}
                    </button>
                  </div>
                )}

                {/* Error */}
                {updaterStatus.type === 'error' && (
                  <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>{t.settings_update_error}{updaterStatus.error ? `: ${updaterStatus.error}` : ''}</span>
                  </div>
                )}

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
