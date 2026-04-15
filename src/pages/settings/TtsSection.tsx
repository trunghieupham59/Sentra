import { TtsVoicePicker } from '../../components/ui/TtsVoicePicker'
import { ChevronDownIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'
import type { TtsVoice } from '../../types'

export function TtsSection() {
  const { ttsVoice, setTtsVoice } = useAppStore()
  const t = useT()

  return (
    <section className="space-y-3">
      <h2 className="section-label">{t.settings_tts_section}</h2>
      <div className="card divide-y divide-gray-100 dark:divide-gray-700">

        {/* Voice selector */}
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
              <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Voice preview badges */}
        <TtsVoicePicker value={ttsVoice} onChange={setTtsVoice} />

      </div>
    </section>
  )
}
