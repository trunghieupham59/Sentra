import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import {
  IconBrandBrave,
  IconBrandClaude,
  IconBrandGemini,
  IconBrandGroq,
  IconBrandOpenAI,
  IconBrandTavily,
  IconCheck,
  IconClose,
  IconEye,
  IconEyeOff,
  IconMoon,
  IconSpinner,
  IconSun,
  IconTrash,
} from './icons/AppIcons'

type Section =
  | 'general'
  | 'translation'
  | 'apikeys'
  | 'tts'
  | 'stt'
  | 'chat'
  | 'cost'
  | 'about'


// ── Toggle component ───────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className={`toggle-track${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
      role="switch"
      aria-checked={on}
    >
      <div className="toggle-thumb" />
    </div>
  )
}

// ── Row component ──────────────────────────────────────────────────────────────
function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="settings-row">
      <div>
        <div className="settings-label">{label}</div>
        {hint && <div className="settings-hint">{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

// ── Pill radio ─────────────────────────────────────────────────────────────────
function PillRadio<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="tab-bar">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`tab-item${value === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── General section ────────────────────────────────────────────────────────────
function GeneralSection() {
  const t               = useT()
  const locale          = useAppStore((s) => s.locale)
  const setLocale       = useAppStore((s) => s.setLocale)
  const localeAuto      = useAppStore((s) => s.localeAuto)
  const setLocaleAuto   = useAppStore((s) => s.setLocaleAuto)
  const fontSize        = useAppStore((s) => s.fontSize)
  const setFontSize     = useAppStore((s) => s.setFontSize)
  const sidebarCollapsed    = useAppStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed)
  const theme    = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  return (
    <div className="settings-section">
      <Row label={t.settings_locale_auto} hint={t.settings_locale_auto_desc}>
        <Toggle on={localeAuto} onChange={setLocaleAuto} />
      </Row>

      <Row label={t.settings_app_language} hint={localeAuto ? t.settings_app_language_auto_hint : undefined}>
        <div style={{ opacity: localeAuto ? 0.4 : 1, pointerEvents: localeAuto ? 'none' : undefined, transition: 'opacity 0.2s' }}>
          <PillRadio
            options={[
              { value: 'en', label: 'English' },
              { value: 'vi', label: 'Tiếng Việt' },
              { value: 'ja', label: '日本語' },
            ]}
            value={locale}
            onChange={(v) => setLocale(v as 'en' | 'vi' | 'ja')}
          />
        </div>
      </Row>

      <Row label={t.settings_theme}>
        <PillRadio
          options={[
            { value: 'system', label: t.settings_theme_system },
            { value: 'dark',   label: t.settings_theme_dark },
            { value: 'light',  label: t.settings_theme_light },
          ]}
          value={theme}
          onChange={(v) => setTheme(v as 'system' | 'dark' | 'light')}
        />
      </Row>

      <Row label={t.settings_font_size}>
        <PillRadio
          options={[
            { value: 'small',  label: t.settings_font_size_small },
            { value: 'medium', label: t.settings_font_size_medium },
            { value: 'large',  label: t.settings_font_size_large },
          ]}
          value={fontSize}
          onChange={setFontSize}
        />
      </Row>

      <Row label={t.settings_sidebar_collapsed} hint={t.settings_sidebar_collapsed_desc}>
        <Toggle on={sidebarCollapsed} onChange={setSidebarCollapsed} />
      </Row>
    </div>
  )
}

// ── Translation section ───────────────────────────────────────────────────────
function TranslationSection() {
  const t = useT()
  const autoTranslate        = useAppStore((s) => s.autoTranslate)
  const setAutoTranslate     = useAppStore((s) => s.setAutoTranslate)
  const autoTranslateDelay   = useAppStore((s) => s.autoTranslateDelay)
  const setAutoTranslateDelay = useAppStore((s) => s.setAutoTranslateDelay)
  const phoneticMode         = useAppStore((s) => s.phoneticMode)
  const setPhoneticMode      = useAppStore((s) => s.setPhoneticMode)
  const translationStyle     = useAppStore((s) => s.translationStyle)
  const setTranslationStyle  = useAppStore((s) => s.setTranslationStyle)

  const delaySeconds = Math.round(autoTranslateDelay / 1000)

  return (
    <div className="settings-section">
      <Row label={t.settings_auto_translate} hint={t.settings_auto_translate_desc}>
        <Toggle on={autoTranslate} onChange={setAutoTranslate} />
      </Row>

      {autoTranslate && (
        <Row label={t.settings_translate_delay} hint={`${delaySeconds}s`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="range"
              min={0}
              max={5000}
              step={500}
              value={autoTranslateDelay}
              onChange={(e) => setAutoTranslateDelay(Number(e.target.value))}
              style={{ width: 120, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 28 }}>{delaySeconds}s</span>
          </div>
        </Row>
      )}

      <Row label={t.settings_furigana} hint={t.settings_furigana_desc}>
        <PillRadio
          options={[
            { value: 'off',      label: t.translate_phonetic_off },
            { value: 'standard', label: t.translate_phonetic_standard },
            { value: 'phonetic', label: t.translate_phonetic_transcription },
          ]}
          value={phoneticMode}
          onChange={setPhoneticMode}
        />
      </Row>

      <Row label={t.settings_translation_style_label}>
        <select
          className="field-select"
          value={translationStyle}
          onChange={(e) => setTranslationStyle(e.target.value as typeof translationStyle)}
          style={{ width: 130 }}
        >
          <option value="general">{t.translate_style_general}</option>
          <option value="formal">{t.translate_style_formal}</option>
          <option value="casual">{t.translate_style_casual}</option>
          <option value="business">{t.translate_style_business}</option>
          <option value="technical">{t.translate_style_technical}</option>
          <option value="natural">{t.translate_style_natural}</option>
        </select>
      </Row>
    </div>
  )
}

// ── API Keys section ──────────────────────────────────────────────────────────
interface KeyProviderDef {
  id: string
  label: string
  placeholder: string
  hint: string
  validate: (k: string) => boolean
}

const KEY_PROVIDERS: KeyProviderDef[] = [
  {
    id: 'gemini', label: 'Gemini', placeholder: 'AIzaSy...',
    hint: 'Google AI Studio — starts with AIzaSy',
    validate: (k) => k.startsWith('AIza') && k.length >= 35,
  },
  {
    id: 'claude', label: 'Claude', placeholder: 'sk-ant-api03-...',
    hint: 'Anthropic Console — starts with sk-ant-',
    validate: (k) => k.startsWith('sk-ant-'),
  },
  {
    id: 'openai', label: 'OpenAI', placeholder: 'sk-...',
    hint: 'OpenAI Platform — starts with sk-',
    validate: (k) => k.startsWith('sk-') && !k.startsWith('sk-ant-'),
  },
  {
    id: 'groq', label: 'Groq', placeholder: 'gsk_...',
    hint: 'Groq Console — starts with gsk_',
    validate: (k) => k.startsWith('gsk_'),
  },
  {
    id: 'tavily', label: 'Tavily', placeholder: 'tvly-...',
    hint: 'Tavily Search — starts with tvly-',
    validate: (k) => k.startsWith('tvly-'),
  },
  {
    id: 'brave', label: 'Brave Search', placeholder: 'BSA...',
    hint: 'Brave Search API key',
    validate: (k) => k.length >= 10,
  },
]

const PROVIDER_ACCENT: Record<string, { color: string; bg: string }> = {
  gemini: { color: '#4285F4', bg: 'rgba(66,133,244,0.15)' },
  claude: { color: '#D97757', bg: 'rgba(217,119,87,0.15)' },
  openai: { color: '#10A37F', bg: 'rgba(16,163,127,0.15)' },
  groq:   { color: '#F8A000', bg: 'rgba(248,160,0,0.15)' },
  tavily: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  brave:  { color: '#FF5B00', bg: 'rgba(255,91,0,0.15)' },
}

type BrandIconComponent = React.ComponentType<{ size?: number; style?: React.CSSProperties }>
const PROVIDER_ICON: Record<string, BrandIconComponent> = {
  gemini: IconBrandGemini,
  claude: IconBrandClaude,
  openai: IconBrandOpenAI,
  groq:   IconBrandGroq,
  tavily: IconBrandTavily,
  brave:  IconBrandBrave,
}

type KeyRowState = 'idle' | 'editing' | 'saving' | 'deleting'

function ApiKeyRow({ provider, onStatusChange }: {
  provider: KeyProviderDef
  onStatusChange: (id: string, has: boolean) => void
}) {
  const [state, setState] = useState<KeyRowState>('idle')
  const [isVerifying, setIsVerifying] = useState(false)
  const [value, setValue] = useState('')
  const [masked, setMasked] = useState<string | null>(null)
  const [hasKey, setHasKey] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const accent = PROVIDER_ACCENT[provider.id] ?? { color: 'var(--text-secondary)', bg: 'var(--glass-bg)' }
  const BrandIcon = PROVIDER_ICON[provider.id]

  useEffect(() => {
    window.api?.keychain?.get(provider.id).then((res) => {
      setHasKey(res.exists ?? false)
      setMasked(res.masked ?? null)
    }).catch(() => {})
  }, [provider.id])

  useEffect(() => {
    if (state === 'editing') {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [state])

  const formatValid = value.trim().length > 0 && provider.validate(value.trim())

  const handleVerify = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setIsVerifying(true)
    setError(null)
    setVerified(false)
    try {
      const res = await window.api?.verifyKey(provider.id, trimmed)
      if (res?.valid || res?.success) {
        setVerified(true)
        setError(null)
      } else {
        setError(res?.error ?? 'Key verification failed.')
        setVerified(false)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setIsVerifying(false)
    }
  }, [value, provider.id])

  const handleSave = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    setState('saving')
    setError(null)
    try {
      const res = await window.api?.keychain?.save(provider.id, trimmed)
      if (res?.success) {
        const getRes = await window.api?.keychain?.get(provider.id)
        setHasKey(true)
        setMasked(getRes?.masked ?? null)
        setValue('')
        setVerified(false)
        setState('idle')
        onStatusChange(provider.id, true)
      } else {
        setError(res?.error ?? 'Failed to save key.')
        setState('editing')
      }
    } catch (e) {
      setError(String(e))
      setState('editing')
    }
  }, [value, provider.id, onStatusChange])

  const handleDelete = useCallback(async () => {
    setState('deleting')
    setError(null)
    try {
      const res = await window.api?.keychain?.delete(provider.id)
      if (res?.success) {
        setHasKey(false)
        setMasked(null)
        setState('idle')
        onStatusChange(provider.id, false)
      } else {
        setError('Failed to delete key.')
        setState('idle')
      }
    } catch (e) {
      setError(String(e))
      setState('idle')
    }
  }, [provider.id, onStatusChange])

  const handleCancel = useCallback(() => {
    setValue('')
    setVerified(false)
    setError(null)
    setState('idle')
  }, [])

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${state === 'editing' ? 'var(--glass-border-strong)' : hovered ? 'rgba(255,255,255,0.14)' : 'var(--glass-border)'}`,
        background: state === 'editing'
          ? 'rgba(255,255,255,0.05)'
          : hovered
          ? 'rgba(255,255,255,0.035)'
          : 'rgba(255,255,255,0.02)',
        transition: 'background 0.15s, border-color 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px' }}>
        {/* Provider avatar */}
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: accent.bg,
          border: `1px solid ${accent.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent.color,
        }}>
          {BrandIcon
            ? <BrandIcon size={18} style={{ color: accent.color }} />
            : <span style={{ fontSize: 13, fontWeight: 700 }}>{provider.label[0]}</span>
          }
        </div>

        {/* Name + masked key */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            {provider.label}
          </div>
          {hasKey && masked && state !== 'editing' ? (
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace',
              marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: '0.02em',
            }}>
              {masked}
            </div>
          ) : state !== 'editing' && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.3 }}>
              {provider.hint}
            </div>
          )}
        </div>

        {/* Right: status + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          {state === 'idle' && (
            <>
              {/* Status pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: hasKey ? 'var(--success)' : 'rgba(255,255,255,0.2)',
                  boxShadow: hasKey ? '0 0 5px rgba(48,209,88,0.45)' : 'none',
                }} />
                <span style={{
                  fontSize: 11,
                  color: hasKey ? 'var(--success)' : 'var(--text-tertiary)',
                  minWidth: 42,
                }}>
                  {hasKey ? 'Saved' : 'Not set'}
                </span>
              </div>

              {/* Edit / Add button */}
              <button
                type="button"
                className="btn btn-glass"
                style={{ fontSize: 11, padding: '4px 11px', height: 27 }}
                onClick={() => setState('editing')}
              >
                {hasKey ? 'Edit' : 'Add'}
              </button>

              {/* Delete — reveals on hover */}
              {hasKey && (
                <button
                  type="button"
                  className="btn-icon"
                  style={{
                    color: 'var(--danger)',
                    opacity: hovered ? 0.65 : 0,
                    transition: 'opacity 0.15s',
                    width: 27, height: 27,
                  }}
                  title="Remove key"
                  tabIndex={hovered ? 0 : -1}
                  onClick={handleDelete}
                >
                  <IconTrash size={13} />
                </button>
              )}
            </>
          )}

          {(state === 'saving' || state === 'deleting') && (
            <IconSpinner size={14} style={{ color: 'var(--text-tertiary)' }} />
          )}
        </div>
      </div>

      {/* Edit panel */}
      {state === 'editing' && (
        <div style={{ padding: '0 13px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ height: 1, background: 'var(--glass-border)', marginBottom: 1 }} />

          {/* Hint */}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.01em' }}>
            {provider.hint}
          </div>

          {/* Input with eye toggle */}
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type={showValue ? 'text' : 'password'}
              className="field-input"
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                paddingRight: 38,
                borderColor: error
                  ? 'rgba(255,69,58,0.5)'
                  : value && formatValid
                  ? 'rgba(48,209,88,0.35)'
                  : undefined,
              }}
              placeholder={provider.placeholder}
              value={value}
              onChange={(e) => { setValue(e.target.value); setVerified(false); setError(null) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && formatValid) handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              className="btn-icon"
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)' }}
              onClick={() => setShowValue((v) => !v)}
              tabIndex={-1}
              type="button"
            >
              {showValue ? <IconEyeOff size={13} /> : <IconEye size={13} />}
            </button>
          </div>

          {/* Validation feedback */}
          {value.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              {verified ? (
                <>
                  <IconCheck size={12} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--success)' }}>Verified successfully</span>
                </>
              ) : formatValid ? (
                <>
                  <IconCheck size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-tertiary)' }}>Format valid — verify to confirm</span>
                </>
              ) : (
                <span style={{ color: 'var(--warning)' }}>Doesn't match expected format</span>
              )}
            </div>
          )}

          {/* Error box */}
          {error && (
            <div style={{
              fontSize: 11, color: 'var(--danger)',
              background: 'rgba(255,69,58,0.08)',
              border: '1px solid rgba(255,69,58,0.2)',
              borderRadius: 7, padding: '6px 10px',
            }}>
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 12, padding: '6px 16px' }}
              disabled={!value.trim()}
              onClick={handleSave}
            >
              Save
            </button>
            {formatValid && !verified && provider.id !== 'brave' && provider.id !== 'tavily' && (
              <button
                type="button"
                className="btn btn-glass"
                style={{ fontSize: 12, padding: '6px 12px' }}
                disabled={isVerifying}
                onClick={handleVerify}
              >
                {isVerifying ? <IconSpinner size={13} /> : 'Verify'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '6px 12px', marginLeft: 'auto' }}
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ApiKeysSection() {
  const t = useT()
  const setKeyStatus    = useAppStore((s) => s.setKeyStatus)
  const setHasTavilyKey = useAppStore((s) => s.setHasTavilyKey)
  const setHasBraveKey  = useAppStore((s) => s.setHasBraveKey)

  const handleStatusChange = useCallback((id: string, has: boolean) => {
    if (id === 'tavily') { setHasTavilyKey(has); return }
    if (id === 'brave')  { setHasBraveKey(has); return }
    setKeyStatus(id as Provider, has)
  }, [setKeyStatus, setHasTavilyKey, setHasBraveKey])

  return (
    <div className="settings-section" style={{ gap: 5 }}>
      {KEY_PROVIDERS.map((p) => (
        <ApiKeyRow key={p.id} provider={p} onStatusChange={handleStatusChange} />
      ))}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 2px 2px',
      }}>
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
          {t.settings_keys_encrypted}
        </p>
      </div>
    </div>
  )
}

// ── TTS section ───────────────────────────────────────────────────────────────
function TtsSection() {
  const t = useT()
  const ttsMode    = useAppStore((s) => s.ttsMode)
  const setTtsMode = useAppStore((s) => s.setTtsMode)
  const ttsVoice   = useAppStore((s) => s.ttsVoice)
  const setTtsVoice = useAppStore((s) => s.setTtsVoice)

  return (
    <div className="settings-section">
      <Row label={t.settings_tts_mode} hint={t.settings_tts_mode_desc}>
        <PillRadio
          options={[
            { value: 'free',    label: t.settings_tts_mode_free_label },
            { value: 'auto',    label: t.settings_tts_mode_auto },
            { value: 'premium', label: t.settings_tts_mode_premium_label },
          ]}
          value={ttsMode}
          onChange={setTtsMode}
        />
      </Row>

      <Row label={t.settings_tts_voice} hint={t.settings_tts_voice_hint}>
        <select
          className="field-select"
          value={ttsVoice}
          onChange={(e) => setTtsVoice(e.target.value as typeof ttsVoice)}
          style={{ width: 110 }}
        >
          {(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const).map((v) => (
            <option key={v} value={v}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </option>
          ))}
        </select>
      </Row>
    </div>
  )
}

// ── STT section ───────────────────────────────────────────────────────────────
function SttSection() {
  const t = useT()
  const sttProvider    = useAppStore((s) => s.sttProvider)
  const setSttProvider = useAppStore((s) => s.setSttProvider)

  return (
    <div className="settings-section">
      <Row label={t.settings_stt_section} hint={t.settings_stt_provider_desc}>
        <PillRadio
          options={[
            { value: 'auto',    label: t.settings_stt_auto },
            { value: 'whisper', label: 'Whisper' },
            { value: 'google',  label: 'Gemini' },
            { value: 'groq',    label: 'Groq' },
          ]}
          value={sttProvider}
          onChange={setSttProvider}
        />
      </Row>

      <div style={{ paddingTop: 6 }}>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
          {t.settings_stt_auto_note}<br />
          {t.settings_stt_whisper_note}<br />
          {t.settings_stt_gemini_note}<br />
          {t.settings_stt_groq_note}
        </p>
      </div>
    </div>
  )
}

// ── Chat section ──────────────────────────────────────────────────────────────
function ChatSection() {
  const t = useT()
  const chatSendShortcut    = useAppStore((s) => s.chatSendShortcut)
  const setChatSendShortcut = useAppStore((s) => s.setChatSendShortcut)
  const chatSystemPrompt    = useAppStore((s) => s.chatSystemPrompt)

  return (
    <div className="settings-section">
      <Row label={t.settings_chat_shortcut_send} hint={t.settings_chat_shortcut_send_desc}>
        <PillRadio
          options={[
            { value: 'enter',    label: t.settings_chat_shortcut_send_enter },
            { value: 'modEnter', label: 'Ctrl+Enter' },
          ]}
          value={chatSendShortcut}
          onChange={setChatSendShortcut}
        />
      </Row>

      <div style={{ paddingTop: 4 }}>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>{t.settings_chat_system_preview}</p>
        {chatSystemPrompt ? (
          <div style={{
            padding: '8px 10px', borderRadius: 8,
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
            maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {chatSystemPrompt}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            {t.settings_chat_no_prompt}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Cost section ──────────────────────────────────────────────────────────────
function CostSection() {
  const t = useT()
  const costCurrency    = useAppStore((s) => s.costCurrency)
  const setCostCurrency = useAppStore((s) => s.setCostCurrency)

  return (
    <div className="settings-section">
      <Row label={t.settings_cost_display_currency} hint={t.settings_cost_currency_hint}>
        <div className="tab-bar">
          {(['USD', 'VND', 'JPY', 'EUR', 'GBP'] as const).map((c) => (
            <button
              key={c}
              type="button"
              className={`tab-item${costCurrency === c ? ' active' : ''}`}
              onClick={() => setCostCurrency(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </Row>

      <div style={{ paddingTop: 6 }}>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{t.settings_cost_note}</p>
      </div>
    </div>
  )
}

// ── About section ─────────────────────────────────────────────────────────────
function AboutSection() {
  const t = useT()
  return (
    <div className="settings-section">
      <Row label={t.settings_about_version_label}>
        <span className="badge badge-glass" style={{ fontSize: 11 }}>v2.1.4</span>
      </Row>

      <Row label={t.settings_about_app_name}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Viezan</span>
      </Row>

      <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          type="button"
          className="btn btn-glass"
          onClick={() => window.api?.openExternal?.('https://github.com')}
          style={{ fontSize: 12, padding: '7px 14px', width: 'fit-content' }}
        >
          {t.settings_about_github}
        </button>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{t.settings_about_description}</p>
      </div>
    </div>
  )
}

// ── Render the active section ─────────────────────────────────────────────────
function SectionContent({ section }: { section: Section }) {
  switch (section) {
    case 'general':     return <GeneralSection />
    case 'translation': return <TranslationSection />
    case 'apikeys':     return <ApiKeysSection />
    case 'tts':         return <TtsSection />
    case 'stt':         return <SttSection />
    case 'chat':        return <ChatSection />
    case 'cost':        return <CostSection />
    case 'about':       return <AboutSection />
  }
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function SettingsModal() {
  const t             = useT()
  const closeSettings = useAppStore((s) => s.closeSettings)
  const [section, setSection] = useState<Section>('general')

  const sections = useMemo(() => [
    { id: 'general'     as Section, label: t.settings_nav_general },
    { id: 'translation' as Section, label: t.settings_nav_translation },
    { id: 'apikeys'     as Section, label: t.settings_nav_apikeys },
    { id: 'tts'         as Section, label: t.settings_nav_tts },
    { id: 'stt'         as Section, label: t.settings_nav_stt },
    { id: 'chat'        as Section, label: t.settings_nav_chat },
    { id: 'cost'        as Section, label: t.settings_nav_cost },
    { id: 'about'       as Section, label: t.settings_nav_about },
  ], [t])

  return (
    <div className="modal-backdrop" onClick={closeSettings}>
      <div
        className="modal-panel"
        style={{ width: 720, maxWidth: '92vw', height: '80vh', maxHeight: 560, display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px', borderBottom: '1px solid var(--glass-border)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{t.settings_title}</span>
          <button className="btn-icon" onClick={closeSettings} aria-label={t.settings_close}>
            <IconClose size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 20px' }}>
          <div className="settings-layout">
            {/* Left nav */}
            <nav className="settings-nav">
              {sections.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`settings-nav-item${section === id ? ' active' : ''}`}
                  onClick={() => setSection(id)}
                  style={{ border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Right content */}
            <div className="scroll-area" style={{ flex: 1 }}>
              <SectionContent section={section} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
