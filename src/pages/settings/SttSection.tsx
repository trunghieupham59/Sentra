/**
 * SttSection — Speech-to-Text settings section.
 *
 * Displays the current STT engine (OpenAI Whisper), its readiness status,
 * and which features in the app use STT.  Kept intentionally lightweight
 * since there is currently only one STT provider; the section can be
 * extended with provider selection if/when alternatives are added.
 */
import { MicrophoneIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'

export function SttSection() {
  const { keyStatus } = useAppStore()
  const t = useT()
  const hasOpenAIKey = keyStatus.openai

  return (
    <section className="space-y-3">
      <h2 className="section-label">{t.settings_stt_section}</h2>

      {/* Provider info banner */}
      <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-0.5">
          {t.settings_stt_provider_label}
        </p>
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-mono tracking-wide">
          {t.settings_stt_engine_name}
        </p>
        <p className="text-[10px] text-emerald-500 dark:text-emerald-500 mt-1">
          {t.settings_stt_provider_desc}
        </p>
      </div>

      <div className="card divide-y divide-gray-100 dark:divide-gray-700">

        {/* Engine status row */}
        <div className="flex items-center justify-between px-4 py-3.5 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <MicrophoneIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {t.settings_stt_engine_name}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {t.settings_stt_usage} {t.settings_stt_feature_voice} · {t.settings_stt_feature_live}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0">
            {hasOpenAIKey ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                               bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                {t.settings_stt_ready}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                               bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {t.settings_stt_needs_key}
              </span>
            )}
          </div>
        </div>

        {/* Feature tags */}
        <div className="px-4 py-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium
                           bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            🎤 {t.settings_stt_feature_voice}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium
                           bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            🎙 {t.settings_stt_feature_live}
          </span>
        </div>

      </div>
    </section>
  )
}
