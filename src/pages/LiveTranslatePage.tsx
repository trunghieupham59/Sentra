import { useState } from 'react'
import { SegmentRow } from '../components/live/SegmentRow'
import { TranslationRow } from '../components/live/TranslationRow'
import { MarkdownText } from '../components/MarkdownText'
import { ModelSelector } from '../components/ModelSelector'
import { TranslateLanguageBar } from '../components/translate/TranslateLanguageBar'
import {
  AlertTriangleIcon,
  CheckIcon,
  DownloadIcon,
  GearIcon,
  InfoCircleIcon,
  LightbulbIcon,
  MicrophoneIcon,
  MonitorIcon,
  SpinnerIcon,
  StopIcon,
  SubtitlesIcon,
  TranslateIcon,
  TrashIcon,
} from '../components/ui/icons'
import { COPY_FEEDBACK_DURATION_MS } from '../constants/ui'
import { MACOS_SCREEN_RECORDING_PREFS } from '../constants/urls'
import { DEFAULT_SUBTITLE_SETTINGS, useLiveTranslate } from '../hooks/useLiveTranslate'
import { useAppStore, useT } from '../store/useAppStore'

/**
 * DUP-04: Shared helper for downloading text content as a file.
 */
function downloadTextFile(content: string, baseName: string, ext: string): void {
  const dateStr = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}-${dateStr}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

const SUBTITLE_FONT_SIZES = [
  { size: 14 as const, label: 'S' },
  { size: 18 as const, label: 'M' },
  { size: 22 as const, label: 'L' },
  { size: 28 as const, label: 'XL' },
  { size: 34 as const, label: '2X' },
]

type PostTab = 'summary' | 'actions' | 'decisions'

// ── Component ─────────────────────────────────────────────────────────────────
export function LiveTranslatePage() {
  const { targetLang, setTargetLang, setActivePage, openSettings } = useAppStore()
  const t = useT()

  const {
    audioMode, setAudioMode, screenPermission,
    isActive, rawTranscript, translation, isTranscribing, isTranslating, micError,
    pipelineError,
    showSubtitles, setShowSubtitles,
    showSubtitleConfig, setShowSubtitleConfig, subtitleSettings, setSubtitleSettings,
    showSummaryBtn, summary, isSummarizing,
    actionItems, isExtractingActionItems, decisions, isExtractingDecisions,
    speakerNameMap, sessionStartTime,
    segments, pendingText,
    handleStart, handleStop, handleClear, handleSummarize,
    handleExtractActionItems, handleExtractDecisions, handleRenameSpeaker,
    rawEndRef, txEndRef, wordCount, isMac, hasOpenAIKey, hasAnyKey,
  } = useLiveTranslate()

  const [copiedRaw,     setCopiedRaw]     = useState(false)
  const [copiedTx,      setCopiedTx]      = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [postTab, setPostTab] = useState<PostTab>('summary')

  const handleCopy = async (text: string, setFlag: (v: boolean) => void) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setFlag(true)
    setTimeout(() => setFlag(false), COPY_FEEDBACK_DURATION_MS)
  }

  // ── Export functions ───────────────────────────────────────────────────────
  const handleExportTxt = () => {
    if (!rawTranscript) return
    const lines: string[] = [
      '=== Meeting Transcript ===',
      `Date: ${new Date().toLocaleString()}`,
      '',
      '--- Original ---',
      rawTranscript,
      '',
      '--- Translation ---',
      translation,
    ]
    if (summary) lines.push('', '--- Summary ---', summary)
    if (actionItems) lines.push('', '--- Action Items ---', actionItems)
    if (decisions) lines.push('', '--- Key Decisions ---', decisions)
    downloadTextFile(lines.join('\n'), 'meeting', 'txt')
  }

  const handleExportSrt = () => {
    if (!segments.length) return
    const toSrtTime = (ms: number) => {
      const totalSec = Math.floor(ms / 1000)
      const h = Math.floor(totalSec / 3600)
      const m = Math.floor((totalSec % 3600) / 60)
      const s = totalSec % 60
      const msRem = Math.min(999, ms % 1000)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(msRem).padStart(3, '0')}`
    }
    const lines: string[] = []
    const base = sessionStartTime || (segments[0]?.timestamp ?? Date.now())
    segments.forEach((seg, i) => {
      const startMs = Math.max(0, seg.timestamp - base)
      const nextMs  = i < segments.length - 1 ? segments[i + 1].timestamp - base : startMs + 3000
      const endMs   = Math.max(startMs + 500, nextMs)
      const displayName = speakerNameMap[seg.speaker] || seg.speaker
      lines.push(
        String(i + 1),
        `${toSrtTime(startMs)} --> ${toSrtTime(endMs)}`,
        `[${displayName}] ${seg.translation || seg.rawText}`,
        '',
      )
    })
    downloadTextFile(lines.join('\n'), 'meeting', 'srt')
  }

  const subtitleColors = [
    { label: t.live_subtitle_color_white,  value: '#ffffff' },
    { label: t.live_subtitle_color_yellow, value: '#fde047' },
    { label: t.live_subtitle_color_cyan,   value: '#22d3ee' },
    { label: t.live_subtitle_color_green,  value: '#4ade80' },
    { label: t.live_subtitle_color_orange, value: '#fb923c' },
    { label: t.live_subtitle_color_pink,   value: '#f472b6' },
  ]

  const showPostPanel = showSummaryBtn || !!summary || isSummarizing
    || !!actionItems || isExtractingActionItems
    || !!decisions || isExtractingDecisions

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col h-full bg-white dark:bg-gray-950">

      {/* ── Main scrollable area ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-6 pb-4 flex flex-col gap-4 flex-1 min-h-0 min-w-0">

          {/* ── Gray card: CẤU HÌNH AI NÂNG CAO ── */}
          <div className="rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 px-5 py-4 flex flex-col gap-4 flex-shrink-0">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Cấu hình AI Nâng Cao
            </h2>

            {/* Row 1: Provider | Model ← left   Mic|Hệ Thống|Cả Hai | Phụ Đề | Bắt Đầu → right */}
            <div className="flex items-center gap-3">
              {/* Left: ModelSelector (Provider | Model) */}
              <div className="flex-1 min-w-0 overflow-hidden">
                <ModelSelector />
              </div>

              {/* Right: Audio toggle + Phụ Đề + Start/Stop */}
              <div className="flex items-end gap-3 flex-shrink-0">

                {/* Audio source toggle: Mic | Hệ Thống | Cả Hai */}
                <div className="flex flex-col gap-1">
                  <span className="text-[0.65rem] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap select-none">Nguồn</span>
                  <div className="flex items-center rounded-full border border-gray-200 dark:border-gray-700
                                  bg-white dark:bg-gray-800 p-0.5 gap-0.5 select-none">
                    <button
                      type="button" disabled={isActive} onClick={() => setAudioMode('mic')}
                      title={t.live_audio_mode_mic_title}
                      className={[
                        'flex items-center justify-center px-2 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                        audioMode === 'mic'
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-sm'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                        isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <MicrophoneIcon className="w-3 h-3" />
                    </button>
                    <button
                      type="button" disabled={isActive} onClick={() => setAudioMode('system')}
                      title={t.live_audio_mode_system_title}
                      className={[
                        'flex items-center justify-center px-2 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                        audioMode === 'system'
                          ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                        isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <MonitorIcon className="w-3 h-3" />
                    </button>
                    <button
                      type="button" disabled={isActive} onClick={() => setAudioMode('both')}
                      title={t.live_audio_mode_both_title}
                      className={[
                        'flex items-center justify-center px-2 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                        audioMode === 'both'
                          ? 'bg-gray-100 dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                        isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <span className="relative inline-flex items-center w-4 h-3 flex-shrink-0">
                        <MicrophoneIcon className="w-2.5 h-2.5 absolute left-0" />
                        <MonitorIcon className="w-2.5 h-2.5 absolute right-0" />
                      </span>
                    </button>
                  </div>
                </div>

                {/* Separator */}
                <span className="text-gray-200 dark:text-gray-700 text-base font-thin select-none flex-shrink-0 pb-1">|</span>

                {/* Phụ Đề toggle + settings popup */}
                <div className="flex flex-col gap-1 relative">
                  <span className="text-[0.65rem] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap select-none">Phụ đề</span>
                  <div className="flex items-center rounded-full border border-gray-200 dark:border-gray-700
                                  bg-white dark:bg-gray-800 p-0.5 gap-0.5 select-none">
                    {/* On/off toggle */}
                    <button
                      type="button"
                      onClick={() => setShowSubtitles(v => !v)}
                      title={showSubtitles ? t.live_subtitles_hide_title : t.live_subtitles_show_title}
                      className={[
                        'flex items-center justify-center px-2 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer',
                        showSubtitles
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                      ].join(' ')}
                    >
                      <SubtitlesIcon className="w-3.5 h-3.5" />
                    </button>
                    {/* Settings button */}
                    <button
                      type="button"
                      onClick={() => setShowSubtitleConfig(v => !v)}
                      title={t.live_subtitle_config_title}
                      className={[
                        'flex items-center justify-center px-2 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer',
                        showSubtitleConfig
                          ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                      ].join(' ')}
                    >
                      <GearIcon className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Settings popup */}
                  {showSubtitleConfig && (
                    <div className="absolute top-full mt-2 right-0 z-50 w-64
                                    bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                                    rounded-xl shadow-xl p-3 flex flex-col gap-3 select-none">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                          {t.live_subtitle_text_color}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {subtitleColors.map(({ label, value }) => (
                            <button
                              key={value} type="button" title={label}
                              onClick={() => setSubtitleSettings(s => ({ ...s, textColor: value }))}
                              className={[
                                'w-6 h-6 rounded-full border-2 cursor-pointer transition-all duration-100',
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
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                          {t.live_subtitle_font_size} — {subtitleSettings.fontSize}px
                        </p>
                        <div className="flex gap-1">
                          {SUBTITLE_FONT_SIZES.map(({ size, label }) => (
                            <button
                              key={size} type="button"
                              onClick={() => setSubtitleSettings(s => ({ ...s, fontSize: size }))}
                              className={[
                                'flex-1 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-100',
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
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                          {t.live_subtitle_bg_opacity} — {subtitleSettings.bgOpacity}%
                        </p>
                        <input
                          type="range" min={0} max={100} step={5}
                          value={subtitleSettings.bgOpacity}
                          onChange={e => setSubtitleSettings(s => ({ ...s, bgOpacity: Number(e.target.value) }))}
                          className="w-full accent-blue-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-gray-300 dark:text-gray-600 mt-0.5">
                          <span>{t.live_subtitle_transparent}</span>
                          <span>{t.live_subtitle_opaque}</span>
                        </div>
                      </div>
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

                {/* Separator */}
                <span className="text-gray-200 dark:text-gray-700 text-base font-thin select-none flex-shrink-0 pb-1">|</span>

                {/* Bắt Đầu / Dừng button */}
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
                    <><StopIcon className="w-3.5 h-3.5" />{t.live_stop}</>
                  ) : (
                    <><MicrophoneIcon className="w-3.5 h-3.5" />{t.live_start}</>
                  )}
                </button>
              </div>
            </div>

            {/* Row 2: Language selector */}
            <TranslateLanguageBar
              sourceLang="auto"
              onSourceLangChange={() => {}}
              targetLang={targetLang}
              onTargetLangChange={setTargetLang}
              detectedSourceLang={null}
              canSwap={false}
              isDetectingLang={false}
              onSwap={() => {}}
              langNames={t.lang_names}
              swapTitle=""
            />

            {/* Row 3: Actions — Clear | Export TXT/SRT →  Word count */}
            {(rawTranscript || wordCount > 0) && (
              <div className="flex items-center gap-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                {rawTranscript && (
                  <button
                    type="button" onClick={handleClear}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                               text-gray-500 hover:text-red-500 hover:bg-red-50
                               dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/30
                               transition-colors duration-150 cursor-pointer"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    {t.live_clear}
                  </button>
                )}
                {rawTranscript && (
                  <>
                    <button
                      type="button" onClick={handleExportTxt}
                      title={t.live_export_txt}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800
                                 transition-colors duration-150 cursor-pointer"
                    >
                      <DownloadIcon className="w-3.5 h-3.5" />
                      TXT
                    </button>
                    {segments.length > 0 && (
                      <button
                        type="button" onClick={handleExportSrt}
                        title={t.live_export_srt}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                                   text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800
                                   transition-colors duration-150 cursor-pointer"
                      >
                        <DownloadIcon className="w-3.5 h-3.5" />
                        SRT
                      </button>
                    )}
                  </>
                )}
                {wordCount > 0 && (
                  <span className="ml-auto text-xs text-gray-400 tabular-nums">
                    {wordCount.toLocaleString()} {t.live_words}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* ── End gray card ── */}

          {/* Notices */}
          {!hasOpenAIKey && (
            <Notice>
              {t.live_no_openai_key}{' '}
              <button type="button" onClick={() => openSettings()} className="underline font-medium cursor-pointer">
                {t.translate_error_open_settings}
              </button>
            </Notice>
          )}

          {/* System audio hint */}
          {(audioMode === 'system' || audioMode === 'both') && !isActive && isMac && screenPermission !== 'granted' && (
            <div className="flex items-center gap-2 px-4 py-2
                            bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl">
              <InfoCircleIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-blue-600 dark:text-blue-400 flex-1">
                {t.live_screen_recording_hint.split(/(<strong>.*?<\/strong>)/g).map((part, i) => {
                  const m = part.match(/^<strong>(.*?)<\/strong>$/)
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable index for locale string segments
                  return m ? <strong key={i}>{m[1]}</strong> : part
                })}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (typeof window.api?.openExternal === 'function') {
                    window.api.openExternal(MACOS_SCREEN_RECORDING_PREFS)
                  } else {
                    window.open(MACOS_SCREEN_RECORDING_PREFS)
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

          {/* ── Two panels: Nguyên Bản | Bản Dịch — bo góc rounded-2xl ── */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

            {/* Left: Nguyên Bản */}
            <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 select-none">
                  {t.live_panel_original}
                </span>
                {/* Right side: status indicator + copy button */}
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="flex items-center gap-1.5 select-none">
                      {isTranscribing ? (
                        <>
                          <SpinnerIcon className="w-2.5 h-2.5 animate-spin text-violet-500 flex-shrink-0" />
                          <span className="text-[10px] font-medium text-violet-500 dark:text-violet-400">Đang nhận diện...</span>
                        </>
                      ) : isTranslating ? (
                        <>
                          <SpinnerIcon className="w-2.5 h-2.5 animate-spin text-blue-500 flex-shrink-0" />
                          <span className="text-[10px] font-medium text-blue-500 dark:text-blue-400">Đang dịch...</span>
                        </>
                      ) : pendingText ? (
                        <>
                          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                          </span>
                          <span className="text-[10px] font-medium text-amber-500 dark:text-amber-400">Đang thu âm...</span>
                        </>
                      ) : (
                        <>
                          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                          </span>
                          <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Đang nghe...</span>
                        </>
                      )}
                    </span>
                  )}
                  {rawTranscript && (
                    <button type="button" onClick={() => handleCopy(rawTranscript, setCopiedRaw)}
                      className={`btn-ghost py-0.5 px-2 text-xs ${copiedRaw ? 'text-green-600' : ''}`}>
                      {copiedRaw ? t.translate_copied : t.translate_copy}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {segments.length > 0 || (isActive && pendingText) ? (
                  <>
                    {segments.map((seg) => (
                      <SegmentRow
                        key={seg.id}
                        speaker={seg.speaker}
                        text={seg.rawText}
                        speakerNameMap={speakerNameMap}
                        onRename={handleRenameSpeaker}
                      />
                    ))}
                    {isActive && pendingText && (
                      <div className="flex items-start gap-2 opacity-50">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 mt-0.5
                                         bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {segments.length > 0
                            ? (speakerNameMap[segments[segments.length - 1].speaker] || segments[segments.length - 1].speaker)
                            : 'Speaker 1'}
                        </span>
                        <span className="text-[15px] text-gray-500 dark:text-gray-500 leading-relaxed italic">
                          {pendingText}
                          <span className="not-italic inline-block ml-0.5 w-0.5 h-4 bg-gray-400 dark:bg-gray-600 animate-pulse align-middle" />
                        </span>
                      </div>
                    )}
                    {isActive && !pendingText && (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="inline-block w-0.5 h-4 bg-gray-400 dark:bg-gray-600 animate-pulse" />
                      </div>
                    )}
                  </>
                ) : rawTranscript ? (
                  <p className="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap p-1">
                    {rawTranscript}
                    {isActive && <span className="inline-block ml-0.5 w-0.5 h-4 bg-gray-400 dark:bg-gray-600 animate-pulse align-middle" />}
                  </p>
                ) : (
                  <EmptyPanel icon="mic">{t.live_empty}</EmptyPanel>
                )}
                <div ref={rawEndRef} />
              </div>
            </div>

            {/* Right: Bản Dịch */}
            <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 shadow-sm overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
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
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {segments.length > 0 ? (
                  <>
                    {segments.map((seg) => (
                      <TranslationRow
                        key={seg.id}
                        speaker={seg.speaker}
                        text={seg.translation}
                        speakerNameMap={speakerNameMap}
                      />
                    ))}
                    {isActive && isTranslating && (
                      <div className="flex items-center gap-2 pl-1">
                        <SpinnerIcon className="w-3 h-3 animate-spin text-blue-400" />
                        <span className="text-xs text-blue-400 italic">{t.live_status_translating}</span>
                      </div>
                    )}
                    {isActive && !isTranslating && (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="inline-block w-0.5 h-4 bg-blue-300 dark:bg-blue-700 animate-pulse" />
                      </div>
                    )}
                  </>
                ) : translation ? (
                  <p className="text-[15px] font-medium text-blue-700 dark:text-blue-300 leading-relaxed whitespace-pre-wrap p-1">
                    {translation}
                  </p>
                ) : (
                  <EmptyPanel icon="translate">{t.live_empty_desc}</EmptyPanel>
                )}
                <div ref={txEndRef} />
              </div>
            </div>
          </div>
          {/* ── End two panels ── */}

        </div>
      </div>
      {/* ── End main scrollable area ── */}

      {/* ── Post-session AI panels ── */}
      {showPostPanel && (
        <div className="flex-shrink-0 border-t-2 border-purple-100 dark:border-purple-900/40
                        bg-purple-50/50 dark:bg-purple-950/10">

          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap">
            <LightbulbIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />

            <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
              {(['summary', 'actions', 'decisions'] as PostTab[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPostTab(tab)}
                  className={[
                    'px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer select-none',
                    postTab === tab
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : 'text-gray-400 hover:text-purple-600 dark:hover:text-purple-400',
                  ].join(' ')}
                >
                  {tab === 'summary' ? t.live_post_tab_summary : tab === 'actions' ? t.live_post_tab_actions : t.live_post_tab_decisions}
                </button>
              ))}
            </div>

            {postTab === 'summary' && summary && !isSummarizing && (
              <button type="button" onClick={() => handleCopy(summary, setCopiedSummary)}
                className={`btn-ghost py-0.5 px-2 text-xs ${copiedSummary ? 'text-green-600' : ''}`}>
                {copiedSummary ? t.translate_copied : t.translate_copy}
              </button>
            )}

            {postTab === 'summary' && !isSummarizing && (
              <button
                type="button" onClick={handleSummarize}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                           bg-purple-500 hover:bg-purple-600 text-white cursor-pointer
                           transition-all duration-200 shadow-sm flex-shrink-0"
              >
                <LightbulbIcon className="w-3.5 h-3.5" />
                {summary ? t.live_summarize_again : t.live_summarize}
              </button>
            )}
            {postTab === 'summary' && isSummarizing && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-500 dark:text-purple-400">
                <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                {t.live_summarizing}
              </span>
            )}

            {postTab === 'actions' && !isExtractingActionItems && (
              <button
                type="button" onClick={handleExtractActionItems}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                           bg-amber-500 hover:bg-amber-600 text-white cursor-pointer
                           transition-all duration-200 shadow-sm flex-shrink-0"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                {actionItems ? t.live_action_items_extract_again : t.live_action_items_extract}
              </button>
            )}
            {postTab === 'actions' && isExtractingActionItems && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-500 dark:text-amber-400">
                <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                {t.live_extracting_action_items}
              </span>
            )}

            {postTab === 'decisions' && !isExtractingDecisions && (
              <button
                type="button" onClick={handleExtractDecisions}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                           bg-green-500 hover:bg-green-600 text-white cursor-pointer
                           transition-all duration-200 shadow-sm flex-shrink-0"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                {decisions ? t.live_decisions_extract_again : t.live_decisions_extract}
              </button>
            )}
            {postTab === 'decisions' && isExtractingDecisions && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-green-500 dark:text-green-400">
                <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                {t.live_extracting_decisions}
              </span>
            )}
          </div>

          <div className="px-4 pb-4 max-h-44 overflow-y-auto">
            {postTab === 'summary' && (
              isSummarizing ? (
                <div className="flex items-center gap-2 text-sm text-purple-400 dark:text-purple-600">
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  {t.live_summarizing}
                </div>
              ) : summary ? (
                <MarkdownText text={summary} className="text-purple-800 dark:text-purple-200" />
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-600 italic">{t.live_empty_desc}</p>
              )
            )}
            {postTab === 'actions' && (
              isExtractingActionItems ? (
                <div className="flex items-center gap-2 text-sm text-amber-400 dark:text-amber-600">
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  {t.live_extracting_action_items}
                </div>
              ) : actionItems ? (
                <MarkdownText text={actionItems} className="text-amber-800 dark:text-amber-200" />
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-600 italic">{t.live_empty_desc}</p>
              )
            )}
            {postTab === 'decisions' && (
              isExtractingDecisions ? (
                <div className="flex items-center gap-2 text-sm text-green-400 dark:text-green-600">
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                  {t.live_extracting_decisions}
                </div>
              ) : decisions ? (
                <MarkdownText text={decisions} className="text-green-800 dark:text-green-200" />
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-600 italic">{t.live_empty_desc}</p>
              )
            )}
          </div>
        </div>
      )}

      {/* Pipeline error toast */}
      {pipelineError && (
        <div className="pointer-events-none absolute bottom-14 inset-x-0 flex justify-center px-4 z-50">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                          bg-amber-50 dark:bg-amber-950/60
                          border border-amber-200 dark:border-amber-700/60
                          text-amber-700 dark:text-amber-300
                          text-xs font-medium shadow-md
                          animate-[fadeIn_0.15s_ease-out]">
            <AlertTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
            {pipelineError}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Notice({ children, variant = 'warning' }: { children: React.ReactNode; variant?: 'warning' | 'error' }) {
  const cls = variant === 'error'
    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
  return (
    <div className={`flex-shrink-0 flex items-start gap-2 p-3 rounded-xl border text-sm ${cls}`}>
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
