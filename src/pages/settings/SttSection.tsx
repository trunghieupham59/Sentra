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
import { useEffect, useState } from 'react'
import { AlertTriangleIcon, CheckCircleIcon, MicrophoneIcon, SpinnerIcon, TrashIcon } from '../../components/ui/icons'
import { GROQ_CONSOLE_URL } from '../../constants/urls'
import { useAppStore, useT } from '../../store/useAppStore'
import type { SttProvider } from '../../types'
import { tpl } from '../../utils/tpl'

// ─── Provider card definitions ────────────────────────────────────────────────

interface ProviderCardProps {
  id: SttProvider
  label: string
  description: string
  statusBadge: React.ReactNode
  note?: string
  selected: boolean
  onSelect: () => void
}

function ProviderCard({ id: _id, label, description, statusBadge, note, selected, onSelect }: ProviderCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left px-4 py-3 transition-colors duration-150',
        'flex items-start justify-between gap-3',
        selected
          ? 'bg-blue-50 dark:bg-blue-950/40'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      ].join(' ')}
    >
      {/* Radio dot + text */}
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Radio indicator */}
        <div className={[
          'mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center',
          selected
            ? 'border-blue-500 dark:border-blue-400'
            : 'border-gray-300 dark:border-gray-600',
        ].join(' ')}>
          {selected && (
            <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
          )}
        </div>

        {/* Label + description */}
        <div className="min-w-0">
          <p className={[
            'text-sm font-medium',
            selected
              ? 'text-blue-700 dark:text-blue-300'
              : 'text-gray-800 dark:text-gray-200',
          ].join(' ')}>
            {label}
          </p>
          {description && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
              {description}
            </p>
          )}
          {note && (
            <p className="flex items-start gap-1 text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-relaxed">
              <AlertTriangleIcon className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{note}</span>
            </p>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0 mt-0.5">
        {statusBadge}
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
  const [groqSaveMsg,    setGroqSaveMsg]    = useState<string | null>(null)
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
    if (!groqInput.trim()) return
    setGroqSaving(true)
    setGroqSaveMsg(null)
    try {
      await window.api.keychain.save('groq', groqInput.trim())
      const updated = await window.api.keychain.get('groq')
      setGroqKeyExists(updated.exists ?? false)
      setGroqMasked(updated.masked ?? null)
      setGroqInput('')
      setGroqSaveMsg(t.settings_stt_groq_saved)
      setTimeout(() => setGroqSaveMsg(null), 3000)
    } catch {
      setGroqSaveMsg(t.settings_stt_groq_failed)
    } finally {
      setGroqSaving(false)
    }
  }

  const handleDeleteGroq = async () => {
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

  const providers: Omit<ProviderCardProps, 'selected' | 'onSelect'>[] = [
    {
      id: 'auto',
      label: t.settings_stt_auto,
      description: '',
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

      {/* Section info banner */}
      <div className="flex items-start gap-3 px-4 py-3
                      bg-blue-50 dark:bg-blue-950/30
                      border border-blue-100 dark:border-blue-900 rounded-xl">
        <span className="text-base flex-shrink-0">🎤</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
            {t.settings_stt_section}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            {t.settings_stt_provider_desc}
          </p>
        </div>
      </div>

      {/* Provider selector card */}
      <div className="card overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60">
        {/* Label row */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50">
          <MicrophoneIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t.settings_stt_select_provider}
          </p>
        </div>

        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            {...p}
            selected={sttProvider === p.id}
            onSelect={() => setSttProvider(p.id)}
          />
        ))}

        {/* ── Groq API Key — inline inside the card ── */}
        <div className="px-4 py-3.5 space-y-3">
          {/* Header: title + link on left, badge on right */}
          <div className="flex items-center justify-between gap-4">
            <div>
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
                  <><SpinnerIcon className="w-4 h-4 animate-spin" />{t.settings_verifying}</>
                ) : (
                  <><CheckCircleIcon className="w-4 h-4" />{t.settings_verify_save}</>
                )}
              </button>
            )}
          </div>

          {groqSaveMsg && (
            <div className={[
              'px-3 py-2 rounded-lg text-xs font-medium',
              groqSaveMsg.startsWith('✓')
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800',
            ].join(' ')}>
              {groqSaveMsg}
            </div>
          )}
        </div>

      </div>
    </section>
  )
}
