import { useEffect, useState } from 'react'
import { TtsVoicePicker } from '../../components/ui/TtsVoicePicker'
import { ChevronDownIcon, CheckCircleIcon, SpinnerIcon, TrashIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'
import type { TtsVoice } from '../../types'

export function TtsSection() {
  const { ttsVoice, setTtsVoice } = useAppStore()
  const t = useT()

  // ── ElevenLabs key state ────────────────────────────────────────────────────
  const [elKey, setElKey]         = useState({ exists: false, masked: null as string | null })
  const [elInput, setElInput]     = useState('')
  const [elSaving, setElSaving]   = useState(false)
  const [elDeleting, setElDeleting] = useState(false)
  const [elMsg, setElMsg]         = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!window.api) return
    window.api.keychain.get('elevenlabs').then((r) => {
      setElKey({ exists: r.exists ?? false, masked: r.masked ?? null })
    }).catch(() => {})
  }, [])

  const showMasked = elKey.exists && elInput === ''

  const handleElSave = async () => {
    if (!elInput.trim() || !window.api) return
    setElSaving(true)
    setElMsg(null)
    try {
      const result = await window.api.keychain.save('elevenlabs', elInput.trim())
      if (result.success) {
        const updated = await window.api.keychain.get('elevenlabs')
        setElKey({ exists: updated.exists ?? false, masked: updated.masked ?? null })
        setElInput('')
        setElMsg({ text: t.settings_tts_el_saved, ok: true })
        setTimeout(() => setElMsg(null), 4000)
      } else {
        setElMsg({ text: `✗ ${result.error ?? t.settings_tts_el_failed}`, ok: false })
      }
    } catch (err) {
      setElMsg({ text: `✗ ${err instanceof Error ? err.message : t.settings_tts_el_failed}`, ok: false })
    } finally {
      setElSaving(false)
    }
  }

  const handleElDelete = async () => {
    if (!window.api || !confirm(`${t.settings_remove} ElevenLabs API key?`)) return
    setElDeleting(true)
    try {
      await window.api.keychain.delete('elevenlabs')
      setElKey({ exists: false, masked: null })
      setElInput('')
      setElMsg(null)
    } finally {
      setElDeleting(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="section-label">{t.settings_tts_section}</h2>

      {/* TTS priority info */}
      <div className="px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-0.5">
          {t.settings_tts_section} — {t.settings_tts_priority_label}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400 font-mono tracking-wide">
          {t.settings_tts_priority_desc}
        </p>
        <p className="text-[10px] text-blue-500 dark:text-blue-500 mt-1">
          {t.settings_tts_edge_free_note}
        </p>
      </div>

      <div className="card divide-y divide-gray-100 dark:divide-gray-700">

        {/* Voice selector — applies when OpenAI is the active provider */}
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

        {/* ElevenLabs API key */}
        <div className="px-4 py-3.5 space-y-2">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {t.settings_tts_elevenlabs_key}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t.settings_tts_elevenlabs_key_desc}
            </p>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            {elKey.exists ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                {t.settings_key_saved}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
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
                value={showMasked ? (elKey.masked ?? '••••••••••••••••••••••••••••••••') : elInput}
                readOnly={showMasked}
                onChange={showMasked ? undefined : (e) => setElInput(e.target.value)}
                onClick={showMasked ? () => setElInput('') : undefined}
                onKeyDown={(e) => { if (e.key === 'Enter' && !showMasked) handleElSave() }}
                placeholder={elKey.exists ? t.settings_key_placeholder_new : t.settings_tts_el_key_placeholder}
                className={[
                  'w-full px-3 py-2 border rounded-lg text-sm font-mono',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500',
                  'text-gray-800 dark:text-gray-200 placeholder-gray-400 transition-colors',
                  showMasked
                    ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 text-gray-400 cursor-pointer pr-9'
                    : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600',
                ].join(' ')}
                autoComplete="off"
                spellCheck={false}
              />
              {/* Delete icon inside input */}
              {showMasked && elKey.exists && (
                <button
                  type="button"
                  onClick={handleElDelete}
                  disabled={elDeleting}
                  title={t.settings_remove}
                  className="absolute right-2 inset-y-0 flex items-center text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                >
                  {elDeleting
                    ? <SpinnerIcon className="w-4 h-4 animate-spin" />
                    : <TrashIcon className="w-4 h-4" />
                  }
                </button>
              )}
            </div>

            {/* Save button — only when typing */}
            {!showMasked && (
              <button
                type="button"
                onClick={handleElSave}
                disabled={!elInput.trim() || elSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800"
              >
                {elSaving ? (
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

          {/* Result message */}
          {elMsg && (
            <div className={[
              'px-3 py-2 rounded-lg text-xs font-medium',
              elMsg.ok
                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800',
            ].join(' ')}>
              {elMsg.text}
            </div>
          )}
        </div>

      </div>
    </section>
  )
}
