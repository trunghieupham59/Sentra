import { useState } from 'react'
import { LanguageSelector } from '../components/LanguageSelector'
import { MarkdownText } from '../components/MarkdownText'
import { ModelSelector } from '../components/ModelSelector'
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  GearIcon,
  InfoCircleIcon,
  LightbulbIcon,
  MicrophoneIcon,
  MonitorIcon,
  SpinnerIcon,
  StopIcon,
  SubtitlesIcon,
  TrashIcon,
  TranslateIcon,
} from '../components/ui/icons'
import { useLiveTranslate, DEFAULT_SUBTITLE_SETTINGS } from '../hooks/useLiveTranslate'
import { COPY_FEEDBACK_DURATION_MS } from '../constants/ui'
import { useAppStore, useT } from '../store/useAppStore'

// ── Deep link to macOS Screen Recording settings ──────────────────────────────
const SCREEN_RECORDING_PREFS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'


const SUBTITLE_FONT_SIZES = [
  { size: 14 as const, label: 'S' },
  { size: 18 as const, label: 'M' },
  { size: 22 as const, label: 'L' },
  { size: 28 as const, label: 'XL' },
  { size: 34 as const, label: '2X' },
]

// ── Component ─────────────────────────────────────────────────────────────────
export function LiveTranslatePage() {
  const { sourceLang, targetLang, setSourceLang, setTargetLang, setActivePage } = useAppStore()
  const t = useT()

  // All business logic lives in the hook — this page owns only UI copy state
  const {
    audioMode, setAudioMode, screenPermission,
    isActive, rawTranscript, translation, isTranscribing, isTranslating, micError,
    showSubtitles, setShowSubtitles, latestSubtitle,
    showSubtitleConfig, setShowSubtitleConfig, subtitleSettings, setSubtitleSettings,
    showSummaryBtn, summary, isSummarizing,
    handleStart, handleStop, handleClear, handleSummarize,
    rawEndRef, txEndRef, wordCount, isMac, hasOpenAIKey, hasAnyKey,
  } = useLiveTranslate()

  // Pure UI copy-flash state — does not belong in the audio/translate hook
  const [copiedRaw,     setCopiedRaw]     = useState(false)
  const [copiedTx,      setCopiedTx]      = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

  const handleCopy = async (text: string, setFlag: (v: boolean) => void) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setFlag(true)
    setTimeout(() => setFlag(false), COPY_FEEDBACK_DURATION_MS)
  }

  // Subtitle color options driven by i18n labels
  const subtitleColors = [
    { label: t.live_subtitle_color_white,  value: '#ffffff' },
    { label: t.live_subtitle_color_yellow, value: '#fde047' },
    { label: t.live_subtitle_color_cyan,   value: '#22d3ee' },
    { label: t.live_subtitle_color_green,  value: '#4ade80' },
    { label: t.live_subtitle_color_orange, value: '#fb923c' },
    { label: t.live_subtitle_color_pink,   value: '#f472b6' },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1 min-w-0 overflow-hidden"><ModelSelector /></div>
      </div>

      {/* Language + audio source toggle + Start/Stop bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1">
          <LanguageSelector value={sourceLang} onChange={setSourceLang} includeAuto />
        </div>
        <ArrowRightIcon className="flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600" />
        <div className="flex-1">
          <LanguageSelector value={targetLang} onChange={setTargetLang} includeAuto={false} />
        </div>

        {/* Audio source toggle: Mic | System — disabled while recording */}
        <div className="flex-shrink-0 flex items-center rounded-full border border-gray-200 dark:border-gray-700
                        bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5 select-none">
          <button
            type="button"
            disabled={isActive}
            onClick={() => setAudioMode('mic')}
            title={t.live_audio_mode_mic_title}
            className={[
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
              audioMode === 'mic'
                ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
              isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            <MicrophoneIcon className="w-3 h-3" />
            {t.live_audio_mode_mic}
          </button>
          <button
            type="button"
            disabled={isActive}
            onClick={() => setAudioMode('system')}
            title={t.live_audio_mode_system_title}
            className={[
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
              audioMode === 'system'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
              isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            <MonitorIcon className="w-3 h-3" />
            {t.live_audio_mode_system}
          </button>
        </div>

        {/* Start / Stop button */}
        <button
          type="button"
          onClick={isActive ? handleStop : handleStart}
          disabled={!hasOpenAIKey || !hasAnyKey}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold flex-shrink-0 transition-all duration-200 select-none',
            isActive
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm cursor-pointer'
              : (!hasOpenAIKey || !hasAnyKey)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm cursor-pointer',
          ].join(' ')}
        >
          {isActive ? (
            <>
              <StopIcon className="w-3.5 h-3.5" />
              {t.live_stop}
            </>
          ) : (
            <>
              <MicrophoneIcon className="w-3.5 h-3.5" />
              {t.live_start}
            </>
          )}
        </button>
      </div>

      {/* Notices */}
      {!hasOpenAIKey && (
        <Notice>
          {t.live_no_openai_key}{' '}
          <button type="button" onClick={() => setActivePage('settings')} className="underline font-medium cursor-pointer">
            {t.translate_error_open_settings}
          </button>
        </Notice>
      )}

      {/* System audio hint — shown when 'System' mode is selected & NOT yet granted permission */}
      {audioMode === 'system' && !isActive && isMac && screenPermission !== 'granted' && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2
                        bg-blue-50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/40">
          <InfoCircleIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span
            className="text-xs text-blue-600 dark:text-blue-400 flex-1"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: t.live_screen_recording_hint }}
          />
          <button
            type="button"
            onClick={() => {
              // window.open is intercepted by Electron's setWindowOpenHandler
              // which calls shell.openExternal — works without needing IPC restart.
              // Falls back to IPC openExternal if available.
              if (typeof window.api?.openExternal === 'function') {
                window.api.openExternal(SCREEN_RECORDING_PREFS)
              } else {
                window.open(SCREEN_RECORDING_PREFS)
              }
            }}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                       bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-150 cursor-pointer"
          >
            <GearIcon className="w-3 h-3" />
            {t.live_open_system_settings}
          </button>
        </div>
      )}

      {micError && <Notice variant="error">{micError}</Notice>}

      {/* Active recording status bar */}
      {isActive && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-1.5
                        bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/40">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-xs font-medium text-red-600 dark:text-red-400 animate-pulse">
            {t.live_status_listening}
          </span>
          {isTranscribing && (
            <span className="text-xs text-gray-400 flex items-center gap-1 ml-2">
              <SpinnerIcon className="w-3 h-3 animate-spin" />
              {t.live_status_stt}
            </span>
          )}
          {isTranslating && !isTranscribing && (
            <span className="text-xs text-blue-400 flex items-center gap-1 ml-2">
              <SpinnerIcon className="w-3 h-3 animate-spin" />
              {t.live_status_translating}
            </span>
          )}
          <span className="ml-auto text-xs text-red-300 dark:text-red-700">{t.live_chunk_hint}</span>
        </div>
      )}

      {/* Two-panel area: Original | Translation */}
      <div className="flex flex-1 min-h-0 divide-x divide-gray-100 dark:divide-gray-800">

        {/* Left: Original */}
        <div className="flex-1 basis-0 flex flex-col min-w-0">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
                          border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 select-none">
              {t.live_panel_original}
            </span>
            {rawTranscript && (
              <button type="button" onClick={() => handleCopy(rawTranscript, setCopiedRaw)}
                className={`btn-ghost py-0.5 px-2 text-xs ${copiedRaw ? 'text-green-600' : ''}`}>
                {copiedRaw ? t.translate_copied : t.translate_copy}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {rawTranscript ? (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {rawTranscript}
                {isActive && <span className="inline-block ml-0.5 w-0.5 h-4 bg-gray-400 dark:bg-gray-600 animate-pulse align-middle" />}
              </p>
            ) : (
              <EmptyPanel icon="mic">{t.live_empty}</EmptyPanel>
            )}
            <div ref={rawEndRef} />
          </div>
        </div>

        {/* Right: Translation */}
        <div className="flex-1 basis-0 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2
                          border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 dark:text-blue-600 select-none">
              {t.live_panel_translation}
            </span>
            {translation && (
              <button type="button" onClick={() => handleCopy(translation, setCopiedTx)}
                className={`btn-ghost py-0.5 px-2 text-xs ${copiedTx ? 'text-green-600' : ''}`}>
                {copiedTx ? t.translate_copied : t.translate_copy}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {translation ? (
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-wrap">
                {translation}
                {isTranslating && (
                  <SpinnerIcon className="inline w-3 h-3 animate-spin ml-1 text-blue-300 dark:text-blue-700 align-middle" />
                )}
              </p>
            ) : (
              <EmptyPanel icon="translate">{t.live_empty_desc}</EmptyPanel>
            )}
            <div ref={txEndRef} />
          </div>
        </div>
      </div>

      {/* Summary panel — shown after session ends */}
      {(showSummaryBtn || summary || isSummarizing) && (
        <div className="flex-shrink-0 border-t-2 border-purple-100 dark:border-purple-900/40
                        bg-purple-50/50 dark:bg-purple-950/10">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <LightbulbIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400 select-none flex-1">
              {summary ? t.live_summary_title : t.live_summarize}
            </span>
            {summary && (
              <button type="button" onClick={() => handleCopy(summary, setCopiedSummary)}
                className={`btn-ghost py-0.5 px-2 text-xs ${copiedSummary ? 'text-green-600' : ''}`}>
                {copiedSummary ? t.translate_copied : t.translate_copy}
              </button>
            )}
            {!isSummarizing && (
              <button
                type="button"
                onClick={handleSummarize}
                disabled={isSummarizing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                           bg-purple-500 hover:bg-purple-600 text-white cursor-pointer
                           transition-all duration-200 shadow-sm flex-shrink-0"
              >
                <LightbulbIcon className="w-3.5 h-3.5" />
                {summary ? t.live_summarize_again : t.live_summarize}
              </button>
            )}
          </div>

          {(summary || isSummarizing) && (
            <div className="px-4 pb-4 max-h-44 overflow-y-auto">
              {isSummarizing ? (
                <div className="flex items-center gap-2 text-sm text-purple-400 dark:text-purple-600">
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  {t.live_summarizing}
                </div>
              ) : summary ? (
                <MarkdownText
                  text={summary}
                  className="text-purple-800 dark:text-purple-200"
                />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 h-11
                      border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        {rawTranscript && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       text-gray-500 hover:text-red-500 hover:bg-red-50
                       dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/30
                       transition-colors duration-150 cursor-pointer"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            {t.live_clear}
          </button>
        )}

        {/* Subtitle toggle + settings */}
        <div className="relative flex items-center gap-1">
          {/* Toggle button */}
          <button
            type="button"
            onClick={() => { setShowSubtitles(v => !v); setShowSubtitleConfig(false) }}
            title={showSubtitles ? t.live_subtitles_hide_title : t.live_subtitles_show_title}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none',
              showSubtitles
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30',
            ].join(' ')}
          >
            <SubtitlesIcon className="w-3.5 h-3.5" />
            {t.live_subtitles}
          </button>

          {/* Settings gear — only visible when subtitles are on */}
          {showSubtitles && (
            <button
              type="button"
              onClick={() => setShowSubtitleConfig(v => !v)}
              title={t.live_subtitle_config_title}
              className={[
                'p-1.5 rounded-lg transition-all duration-150 cursor-pointer',
                showSubtitleConfig
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30',
              ].join(' ')}
            >
              <GearIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Settings popover */}
          {showSubtitleConfig && (
            <div className="absolute bottom-full mb-2 left-0 z-50 w-64
                            bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                            rounded-xl shadow-xl p-3 flex flex-col gap-3 select-none">

              {/* Text color */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                  {t.live_subtitle_text_color}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {subtitleColors.map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      title={label}
                      onClick={() => setSubtitleSettings(s => ({ ...s, textColor: value }))}
                      className={[
                        'w-6 h-6 rounded-full border-2 transition-all duration-100 cursor-pointer',
                        subtitleSettings.textColor === value
                          ? 'border-blue-500 scale-110 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 hover:scale-110',
                      ].join(' ')}
                      style={{ background: value }}
                      aria-label={label}
                    />
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                  {t.live_subtitle_font_size} — {subtitleSettings.fontSize}px
                </p>
                <div className="flex gap-1">
                  {SUBTITLE_FONT_SIZES.map(({ size, label }) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSubtitleSettings(s => ({ ...s, fontSize: size }))}
                      className={[
                        'flex-1 py-1 rounded-lg text-xs font-semibold transition-all duration-100 cursor-pointer',
                        subtitleSettings.fontSize === size
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-950/30',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background opacity */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                  {t.live_subtitle_bg_opacity} — {subtitleSettings.bgOpacity}%
                </p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={subtitleSettings.bgOpacity}
                  onChange={e => setSubtitleSettings(s => ({ ...s, bgOpacity: Number(e.target.value) }))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-gray-300 dark:text-gray-600 mt-0.5">
                  <span>{t.live_subtitle_transparent}</span>
                  <span>{t.live_subtitle_opaque}</span>
                </div>
              </div>

              {/* Reset */}
              <button
                type="button"
                onClick={() => setSubtitleSettings({ ...DEFAULT_SUBTITLE_SETTINGS })}
                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-center transition-colors"
              >
                {t.live_subtitle_reset}
              </button>
            </div>
          )}
        </div>

        <span className="ml-auto text-xs text-gray-400 tabular-nums">
          {wordCount > 0 ? `${wordCount.toLocaleString()} ${t.live_words}` : ''}
        </span>
      </div>

    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Notice({ children, variant = 'warning' }: { children: React.ReactNode; variant?: 'warning' | 'error' }) {
  const cls = variant === 'error'
    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
  return (
    <div className={`flex-shrink-0 flex items-start gap-2 mx-4 mt-3 p-3 rounded-lg border text-sm ${cls}`}>
      <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

function EmptyPanel({ children, icon }: { children: React.ReactNode; icon: 'mic' | 'translate' }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        {icon === 'mic' ? (
          <MicrophoneIcon className="w-6 h-6 text-gray-400" />
        ) : (
          <TranslateIcon className="w-6 h-6 text-blue-300 dark:text-blue-700" />
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-600 text-center max-w-[160px]">{children}</p>
    </div>
  )
}
