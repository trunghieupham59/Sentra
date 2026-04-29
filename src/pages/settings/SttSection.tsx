/**
 * SttSection — Speech-to-Text settings section.
 *
 * Lets users choose between four STT engines:
 *   - Auto (recommended) — Whisper → Gemini STT → Groq (free) smart routing
 *   - OpenAI Whisper      — highest accuracy, requires OpenAI key
 *   - Gemini STT          — uses Gemini API key, no extra GCP setup
 *   - Groq Whisper (Free) — whisper-large-v3-turbo, 28,800 sec/day, no credit card
 *
 * The selected provider is persisted in the Zustand store (sttProvider field).
 * The Groq API key is stored in the OS keychain — add it in the card below the selector.
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangleIcon,
  AutoModeIcon,
  CheckCircleIcon,
  GeminiProviderIcon,
  GroqIcon,
  OpenAIProviderIcon,
  SpinnerIcon,
  TrashIcon,
} from '../../components/ui/icons'
import { TOAST_DISMISS_DELAY_MS } from '../../constants/ui'
import { GROQ_CONSOLE_URL } from '../../constants/urls'
import { useAppStore, useT } from '../../store/useAppStore'
import type { SttProvider } from '../../types'
import { tpl } from '../../utils/tpl'

// ─── Provider card definitions ────────────────────────────────────────────────

interface ProviderOption {
  id: SttProvider
  label: string
  description: string
  statusBadge: ReactNode
  icon: ReactNode
  note?: string
}

interface ProviderCardProps extends ProviderOption {
  selected: boolean
  onSelect: () => void
}

function ProviderLogoFrame({
  children,
  selected,
}: {
  children: ReactNode
  selected: boolean
}) {
  return (
    <span
      className={[
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
        selected
          ? 'border-blue-200 bg-white text-gray-950 dark:border-blue-900 dark:bg-gray-950 dark:text-white'
          : 'border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function ProviderCard({ label, description, statusBadge, icon, note, selected, onSelect }: ProviderCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'text-left px-3 py-2.5 rounded-lg border transition-colors min-h-[104px]',
        'flex flex-col gap-2',
        selected
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300'
          : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-900 dark:hover:bg-blue-950/20',
      ].join(' ')}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <span className="flex min-w-0 items-start gap-2">
          <ProviderLogoFrame selected={selected}>
            {icon}
          </ProviderLogoFrame>
          <span className="block min-w-0 text-sm font-semibold leading-snug pt-0.5">
            {label}
          </span>
        </span>
        <span className="flex-shrink-0">
          {statusBadge}
        </span>
      </div>

      <div className="min-w-0">
        <p className={[
          'text-xs leading-snug',
          selected ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400',
        ].join(' ')}>
          {description}
        </p>
        {note && (
          <p className="flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-relaxed">
            <AlertTriangleIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{note}</span>
          </p>
        )}
      </div>
    </button>
  )
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

function BadgeReady({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold
                     bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
      {label}
    </span>
  )
}

function BadgeWarning({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold
                     bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      {label}
    </span>
  )
}

// ─── Section component ────────────────────────────────────────────────────────

export function SttSection() {
  const { keyStatus, sttProvider, setSttProvider } = useAppStore()
  const t = useT()
  const hasOpenAIKey = keyStatus.openai
  const hasGeminiKey = keyStatus.gemini

  // ── Groq key state (optional free fallback — not in main keyStatus) ────────
  const [groqKeyExists,  setGroqKeyExists]  = useState(false)
  const [groqMasked,     setGroqMasked]     = useState<string | null>(null)
  const [groqInput,      setGroqInput]      = useState('')
  const [groqSaveMsg,    setGroqSaveMsg]    = useState<{ text: string; ok: boolean } | null>(null)
  const [groqSaving,     setGroqSaving]     = useState(false)
  const [groqDeleting,   setGroqDeleting]   = useState(false)

  // Load Groq key status on mount
  useEffect(() => {
    if (!window.api) return
    window.api.keychain.get('groq')
      .then((result) => {
        setGroqKeyExists(result.exists ?? false)
        setGroqMasked(result.masked ?? null)
      })
      .catch(() => {/* ignore */})
  }, [])

  const handleSaveGroq = async () => {
    if (!groqInput.trim() || !window.api) return
    setGroqSaving(true)
    setGroqSaveMsg(null)
    try {
      await window.api.keychain.save('groq', groqInput.trim())
      const updated = await window.api.keychain.get('groq')
      setGroqKeyExists(updated.exists ?? false)
      setGroqMasked(updated.masked ?? null)
      setGroqInput('')
      setGroqSaveMsg({ text: t.settings_stt_groq_saved, ok: true })
      setTimeout(() => setGroqSaveMsg(null), TOAST_DISMISS_DELAY_MS)
    } catch (err) {
      setGroqSaveMsg({
        text: err instanceof Error ? err.message : t.settings_stt_groq_failed,
        ok: false,
      })
    } finally {
      setGroqSaving(false)
    }
  }

  const handleDeleteGroq = async () => {
    if (!window.api) return
    setGroqDeleting(true)
    try {
      await window.api.keychain.delete('groq')
      setGroqKeyExists(false)
      setGroqMasked(null)
      setGroqInput('')
      setGroqSaveMsg(null)
    } catch {/* ignore */} finally {
      setGroqDeleting(false)
    }
  }

  const showGroqMasked = groqKeyExists && groqInput === ''

  const providers: ProviderOption[] = [
    {
      id: 'auto',
      label: t.settings_stt_auto,
      description: t.settings_stt_auto_desc,
      icon: <AutoModeIcon className="w-5 h-5 text-blue-600 dark:text-blue-300" />,
      statusBadge: (
        hasOpenAIKey || hasGeminiKey || groqKeyExists
          ? <BadgeReady label={t.settings_stt_ready} />
          : <BadgeWarning label={t.settings_stt_needs_key} />
      ),
    },
    {
      id: 'whisper',
      label: t.settings_stt_whisper,
      description: t.settings_stt_whisper_desc,
      icon: <OpenAIProviderIcon size={20} />,
      statusBadge: (
        hasOpenAIKey
          ? <BadgeReady label={t.settings_stt_ready} />
          : <BadgeWarning label={t.settings_stt_needs_key} />
      ),
    },
    {
      id: 'google',
      label: t.settings_stt_google,
      description: t.settings_stt_google_desc,
      icon: <GeminiProviderIcon size={20} />,
      note: t.settings_stt_google_note,
      statusBadge: (
        hasGeminiKey
          ? <BadgeReady label={t.settings_stt_ready} />
          : <BadgeWarning label={t.settings_stt_needs_gemini} />
      ),
    },
    {
      id: 'groq',
      label: t.settings_stt_groq,
      description: t.settings_stt_groq_desc,
      icon: <GroqIcon size={10} />,
      statusBadge: (
        groqKeyExists
          ? <BadgeReady label={t.settings_stt_ready} />
          : <BadgeWarning label={t.settings_stt_needs_groq} />
      ),
    },
  ]

  return (
    <section className="space-y-3">
      <h2 className="section-label">{t.settings_stt_section}</h2>

      <div className="card divide-y divide-gray-100 dark:divide-gray-700">
        {/* STT provider selector */}
        <div className="px-4 py-3.5 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_stt_select_provider}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_stt_provider_desc}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                {...p}
                selected={sttProvider === p.id}
                onSelect={() => setSttProvider(p.id)}
              />
            ))}
          </div>
        </div>

        {/* Groq API Key */}
        <div className="px-4 py-3.5 space-y-2">
          {/* Header: title + link on left, badge on right */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <ProviderLogoFrame selected={false}>
                <GroqIcon size={10} />
              </ProviderLogoFrame>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {t.settings_stt_groq_key}
                </h3>
                <button
                  type="button"
                  onClick={() => window.api?.openExternal(GROQ_CONSOLE_URL)}
                  className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                >
                  {t.settings_get_key}
                </button>
              </div>
            </div>
            {groqKeyExists ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                {t.settings_key_saved}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                {t.settings_no_key}
              </span>
            )}
          </div>

          {/* Input row */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="password"
                value={showGroqMasked ? (groqMasked ?? '••••••••••••••••••••••••••••••••') : groqInput}
                readOnly={showGroqMasked}
                onChange={showGroqMasked ? undefined : (e) => {
                  setGroqInput(e.target.value)
                  if (groqSaveMsg) setGroqSaveMsg(null)
                }}
                onClick={showGroqMasked ? () => setGroqInput('') : undefined}
                onKeyDown={(e) => { if (e.key === 'Enter' && !showGroqMasked) handleSaveGroq() }}
                placeholder={tpl(t.settings_key_placeholder_paste, { name: 'Groq' })}
                className={[
                  'w-full px-3 py-2 border rounded-lg text-sm font-mono',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'text-gray-800 dark:text-gray-200 placeholder-gray-400 transition-colors',
                  showGroqMasked
                    ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 cursor-pointer pr-9'
                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600',
                ].join(' ')}
                autoComplete="off"
                spellCheck={false}
              />
              {showGroqMasked && groqKeyExists && (
                <button
                  type="button"
                  onClick={handleDeleteGroq}
                  disabled={groqDeleting}
                  title={t.settings_remove}
                  className="absolute right-2 inset-y-0 flex items-center text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                >
                  {groqDeleting
                    ? <SpinnerIcon className="w-4 h-4 animate-spin" />
                    : <TrashIcon className="w-4 h-4" />
                  }
                </button>
              )}
            </div>
            {!showGroqMasked && (
              <button
                type="button"
                onClick={handleSaveGroq}
                disabled={!groqInput.trim() || groqSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800"
              >
                {groqSaving ? (
                  <>
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    {t.settings_verifying}
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-4 h-4" />
                    {t.settings_verify_save}
                  </>
                )}
              </button>
            )}
          </div>

          {groqSaveMsg && (
            <div className={[
              'px-3 py-2 rounded-lg text-xs font-medium',
              groqSaveMsg.ok
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800',
            ].join(' ')}>
              {groqSaveMsg.text}
            </div>
          )}
        </div>
      </div>

    </section>
  )
}
