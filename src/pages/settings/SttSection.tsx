/**
 * SttSection — Speech-to-Text settings section.
 *
 * Lets users choose between four STT engines:
 *   - Auto (recommended) — Whisper first, Google STT fallback
 *   - OpenAI Whisper      — highest accuracy, requires OpenAI key
 *   - Google Cloud STT    — uses Gemini API key, very reliable
 *   - Browser Speech API  — free, real-time, no key needed (Chrome/Electron built-in)
 *
 * The selected provider is persisted in the Zustand store (sttProvider field).
 */
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

  const providers: Omit<ProviderCardProps, 'selected' | 'onSelect'>[] = [
    {
      id: 'auto',
      label: t.settings_stt_auto,
      description: t.settings_stt_auto_desc,
      statusBadge: (
        hasOpenAIKey || hasGeminiKey
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
      id: 'webSpeech',
      label: t.settings_stt_webspeech,
      description: t.settings_stt_webspeech_desc,
      statusBadge: <BadgeReady label={t.settings_stt_always_available} />,
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

      {/* Auto-mode hint */}
      {sttProvider === 'auto' && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30
                        border border-blue-100 dark:border-blue-900/50">
          <span className="text-blue-400 dark:text-blue-500 text-sm leading-none mt-0.5">ℹ</span>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">
            {t.settings_stt_auto_note}
          </p>
        </div>
      )}

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
