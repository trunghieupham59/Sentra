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
import { MicrophoneIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'
import type { SttProvider } from '../../types'

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
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
            {description}
          </p>
          {note && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 leading-relaxed">
              ⚠ {note}
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
    try {
      await window.api.keychain.delete('groq')
      setGroqKeyExists(false)
      setGroqMasked(null)
      setGroqInput('')
      setGroqSaveMsg(null)
    } catch {/* ignore */}
  }

  const providers: Omit<ProviderCardProps, 'selected' | 'onSelect'>[] = [
    {
      id: 'auto',
      label: t.settings_stt_auto,
      description: t.settings_stt_auto_desc,
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

      {/* Section description */}
      <p className="text-xs text-gray-400 dark:text-gray-500 px-0.5">
        {t.settings_stt_provider_desc}
      </p>

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
      </div>

      {/* ── Groq API Key (optional free STT fallback) ─────────────────────────── */}
      {/* Groq uses the same Whisper model API format (OpenAI-compatible) at no cost.
          When configured, it becomes the 3rd fallback in 'auto' mode:
          OpenAI Whisper → Gemini STT → Groq Whisper */}
      <div className="card px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {t.settings_stt_groq_key}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">
              {t.settings_stt_groq_key_desc}
            </p>
          </div>
          {groqKeyExists && (
            <BadgeReady label={t.settings_stt_ready} />
          )}
        </div>

        {/* Masked existing key / input row */}
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={groqInput}
            onChange={(e) => setGroqInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGroq() }}
            placeholder={groqMasked ?? t.settings_stt_groq_key_placeholder}
            className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200
                       placeholder-gray-300 dark:placeholder-gray-600
                       focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400
                       transition-colors duration-150"
          />
          <button
            type="button"
            disabled={!groqInput.trim() || groqSaving}
            onClick={handleSaveGroq}
            className={[
              'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150',
              groqInput.trim() && !groqSaving
                ? 'bg-blue-500 hover:bg-blue-600 text-white cursor-pointer'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600',
            ].join(' ')}
          >
            {groqSaving ? '…' : t.settings_verify_save}
          </button>
          {groqKeyExists && (
            <button
              type="button"
              onClick={handleDeleteGroq}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500
                         hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30
                         transition-colors duration-150 cursor-pointer"
            >
              {t.settings_remove}
            </button>
          )}
        </div>

        {/* Save feedback message */}
        {groqSaveMsg && (
          <p className={[
            'text-[11px] font-medium',
            groqSaveMsg.startsWith('✓')
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-500 dark:text-red-400',
          ].join(' ')}>
            {groqSaveMsg}
          </p>
        )}
      </div>

      {/* Feature tags */}
      <div className="flex flex-wrap gap-1.5 px-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium
                         bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <MicrophoneIcon className="w-3 h-3" /> {t.settings_stt_feature_voice}
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium
                         bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <MicrophoneIcon className="w-3 h-3" /> {t.settings_stt_feature_live}
        </span>
      </div>
    </section>
  )
}
