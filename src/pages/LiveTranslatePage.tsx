import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SEGMENT_DURATION_MS, MIN_SEGMENT_DURATION_MS } from '../constants/ui'
import { LiveSourceLangBar } from '../components/live/LiveSourceLangBar'
import { LiveTargetLangBar } from '../components/live/LiveTargetLangBar'
import { SegmentRow } from '../components/live/SegmentRow'
import { TranslationRow } from '../components/live/TranslationRow'
import { MarkdownText } from '../components/MarkdownText'
import { ModelSelector } from '../components/ModelSelector'
import { 
  AlertTriangleIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  GearIcon,
  InfoCircleIcon,
  LightbulbIcon,
  MicrophoneIcon,
  MonitorIcon,
  SpinnerIcon,
  StopIcon,
  SubtitlesIcon,SwapIcon, 
  TranslateIcon,
  TrashIcon,
  XIcon,} from '../components/ui/icons'
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
  const { targetLang, setTargetLang, openSettings, sttProvider } = useAppStore()
  const t = useT()

  const {
    audioMode, setAudioMode, screenPermission,
    isActive, rawTranscript, translation, isTranscribing, isTranslating,
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
    activeSttProvider,
  } = useLiveTranslate()

  const [copiedRaw,     setCopiedRaw]     = useState(false)
  const [copiedTx,      setCopiedTx]      = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [postTab, setPostTab] = useState<PostTab>('summary')
  const [showScreenPermModal, setShowScreenPermModal] = useState(false)
  const [showSummaryPopup, setShowSummaryPopup] = useState(false)

  /** CẤU HÌNH AI NÂNG CAO popup — contains Model + Nguồn + Phụ Đề + Transcript */
  const [showAIConfig, setShowAIConfig] = useState(false)
  const aiConfigRef = useRef<HTMLDivElement>(null)

  // ── Close popup on outside click ──
  useEffect(() => {
    if (!showAIConfig) return
    const handleOutside = (e: MouseEvent) => {
      if (aiConfigRef.current && !aiConfigRef.current.contains(e.target as Node)) {
        setShowAIConfig(false)
        setShowSubtitleConfig(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showAIConfig, setShowSubtitleConfig])

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
      t.live_export_header,
      `Date: ${new Date().toLocaleString()}`,
      '',
      t.live_export_original_section,
      rawTranscript,
      '',
      t.live_export_translation_section,
      translation,
    ]
    if (summary) lines.push('', t.live_export_summary_section, summary)
    if (actionItems) lines.push('', t.live_export_action_items_section, actionItems)
    if (decisions) lines.push('', t.live_export_decisions_section, decisions)
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
      const nextMs  = i < segments.length - 1 ? segments[i + 1].timestamp - base : startMs + DEFAULT_SEGMENT_DURATION_MS
      const endMs   = Math.max(startMs + MIN_SEGMENT_DURATION_MS, nextMs)
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

  // ── Open summary popup and auto-trigger summarize ─────────────────────────
  const handleOpenSummaryPopup = () => {
    setShowSummaryPopup(true)
    setPostTab('summary')
    if (!isSummarizing && !summary) {
      handleSummarize()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex flex-col h-full bg-white dark:bg-gray-950">

      {/* ── Main scrollable area ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 pt-6 pb-4 flex flex-col gap-4 flex-1 min-h-0 min-w-0">

          {/* ── Row 1: [Source (flex-1)] [⇄] [Target (flex-1)] [▶ Start/Stop] [⚙️] ── */}
          <div className="flex items-center flex-shrink-0">

            {/* Source language — always auto-detect */}
            <div className="flex-1 min-w-0 overflow-hidden">
              <LiveSourceLangBar
                sourceLang="auto"
                onSourceLangChange={() => {}}
                detectedSourceLang={null}
                isDetectingLang={false}
                langNames={t.lang_names}
              />
            </div>

            {/* Swap button — always disabled for live translate */}
            <button
              type="button"
              disabled
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 text-gray-200 dark:text-gray-700 cursor-not-allowed"
            >
              <SwapIcon className="w-5 h-5" />
            </button>

            {/* Target language selector + Start/Stop + Gear */}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="flex-1 min-w-0 overflow-hidden">
                <LiveTargetLangBar
                  targetLang={targetLang}
                  onTargetLangChange={setTargetLang}
                  langNames={t.lang_names}
                />
              </div>

            {/* ▶ Bắt Đầu / ■ Dừng */}
            <button
              type="button"
              onClick={isActive ? handleStop : () => {
                if ((audioMode === 'system' || audioMode === 'both') && isMac && screenPermission !== 'granted') {
                  setShowScreenPermModal(true)
                } else {
                  handleStart()
                }
              }}
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

            {/* ⚙️ CẤU HÌNH AI NÂNG CAO popup */}
            <div className="relative flex-shrink-0" ref={aiConfigRef}>
              <button
                type="button"
                onClick={() => setShowAIConfig((v) => !v)}
                title={t.translate_ai_config_title}
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-200 cursor-pointer
                            ${showAIConfig
                              ? 'bg-blue-50 border-blue-200 text-blue-500 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'}`}
              >
                <GearIcon className="w-3.5 h-3.5" />
              </button>

              {showAIConfig && (
                <div className="absolute top-full right-0 mt-2 z-50 w-[380px]
                                bg-white dark:bg-gray-900
                                border border-gray-200 dark:border-gray-700
                                rounded-2xl shadow-xl p-4 flex flex-col gap-4">
                  <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {t.translate_ai_config_title}
                  </h2>

                  {/* Model */}
                  <ModelSelector />

                  {/* Divider */}
                  <div className="border-t border-gray-100 dark:border-gray-800" />

                  {/* Nguồn âm thanh */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.65rem] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      {t.live_audio_source_label}
                    </span>
                    <div className="flex items-center rounded-full border border-gray-200 dark:border-gray-700
                                    bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5 select-none w-fit">
                      <button
                        type="button" disabled={isActive} onClick={() => setAudioMode('mic')}
                        title={t.live_audio_mode_mic_title}
                        className={[
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                          audioMode === 'mic'
                            ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-sm'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                          isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                        ].join(' ')}
                      >
                        <MicrophoneIcon className="w-3 h-3" />
                        <span>{t.live_audio_mode_mic}</span>
                      </button>
                      <button
                        type="button" disabled={isActive} onClick={() => setAudioMode('system')}
                        title={t.live_audio_mode_system_title}
                        className={[
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                          audioMode === 'system'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                          isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                        ].join(' ')}
                      >
                        <MonitorIcon className="w-3 h-3" />
                        <span>{t.live_audio_mode_system}</span>
                      </button>
                      <button
                        type="button" disabled={isActive} onClick={() => setAudioMode('both')}
                        title={t.live_audio_mode_both_title}
                        className={[
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                          audioMode === 'both'
                            ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                          isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                        ].join(' ')}
                      >
                        <span className="relative inline-flex items-center w-4 h-3 flex-shrink-0">
                          <MicrophoneIcon className="w-2.5 h-2.5 absolute left-0" />
                          <MonitorIcon className="w-2.5 h-2.5 absolute right-0" />
                        </span>
                        <span>{t.live_audio_mode_both}</span>
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 dark:border-gray-800" />

                  {/* Phụ đề */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.65rem] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      {t.live_subtitles}
                    </span>
                    <div className="flex items-center gap-2 relative">
                      <button
                        type="button"
                        onClick={() => setShowSubtitles(v => !v)}
                        title={showSubtitles ? t.live_subtitles_hide_title : t.live_subtitles_show_title}
                        className={[
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer border',
                          showSubtitles
                            ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
                        ].join(' ')}
                      >
                        <SubtitlesIcon className="w-3.5 h-3.5" />
                        <span>{showSubtitles ? t.live_subtitles_on : t.translate_phonetic_off}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSubtitleConfig(v => !v)}
                        title={t.live_subtitle_config_title}
                        className={[
                          'flex items-center justify-center w-8 h-8 rounded-full border text-xs font-medium transition-all duration-150 cursor-pointer',
                          showSubtitleConfig
                            ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-400 shadow-sm'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
                        ].join(' ')}
                      >
                        <GearIcon className="w-3 h-3" />
                      </button>

                      {/* Subtitle settings nested popup */}
                      {showSubtitleConfig && (
                        <div className="absolute top-full mt-2 left-0 z-50 w-64
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
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-100 dark:border-gray-800" />

                  {/* Transcript actions */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.65rem] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                        {t.live_transcript_label}
                      </span>
                      {wordCount > 0 && (
                        <span className="text-xs text-gray-400 tabular-nums">
                          {wordCount.toLocaleString()} {t.live_words}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!rawTranscript}
                        onClick={() => { handleClear(); setShowAIConfig(false) }}
                        className={[
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150',
                          rawTranscript
                            ? 'text-gray-500 hover:text-red-500 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 cursor-pointer'
                            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed',
                        ].join(' ')}
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                        {t.live_clear}
                      </button>
                      <button
                        type="button"
                        disabled={!rawTranscript}
                        onClick={handleExportTxt}
                        title={t.live_export_txt}
                        className={[
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150',
                          rawTranscript
                            ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed',
                        ].join(' ')}
                      >
                        <DownloadIcon className="w-3.5 h-3.5" />
                        TXT
                      </button>
                      <button
                        type="button"
                        disabled={!segments.length}
                        onClick={handleExportSrt}
                        title={t.live_export_srt}
                        className={[
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150',
                          segments.length
                            ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                            : 'text-gray-300 dark:text-gray-600 cursor-not-allowed',
                        ].join(' ')}
                      >
                        <DownloadIcon className="w-3.5 h-3.5" />
                        SRT
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
          {/* ── End Row 1 ── */}

          {/* Notices */}
          {!hasOpenAIKey && (
            <Notice>
              {t.live_no_openai_key}{' '}
              <button type="button" onClick={() => openSettings()} className="underline font-medium cursor-pointer">
                {t.translate_error_open_settings}
              </button>
            </Notice>
          )}


          {/* ── Two panels: Nguyên Bản | Bản Dịch ── */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

            {/* Left: Nguyên Bản */}
            <div className="flex flex-col h-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              {/* Status indicator bar (only when active) */}
              {isActive && (
                <div className="flex-shrink-0 flex items-center px-4 pt-2 pb-1">
                  <span className="flex items-center gap-1.5 select-none">
                    {isTranscribing ? (
                      <>
                        <SpinnerIcon className="w-2.5 h-2.5 animate-spin text-violet-500 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-violet-500 dark:text-violet-400">{t.voice_transcribing}</span>
                      </>
                    ) : isTranslating ? (
                      <>
                        <SpinnerIcon className="w-2.5 h-2.5 animate-spin text-blue-500 flex-shrink-0" />
                        <span className="text-[10px] font-medium text-blue-500 dark:text-blue-400">{t.live_status_translating}</span>
                      </>
                    ) : pendingText ? (
                      <>
                        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                        </span>
                        <span className="text-[10px] font-medium text-amber-500 dark:text-amber-400">{t.voice_whisper_mode}</span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                        </span>
                        <span className="text-[10px] font-medium text-green-600 dark:text-green-400">{t.live_status_listening}</span>
                      </>
                    )}
                  </span>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
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
                            : t.live_speaker_default}
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
                  <EmptyPanel icon="mic" onClick={hasOpenAIKey && hasAnyKey ? () => {
                    if ((audioMode === 'system' || audioMode === 'both') && isMac && screenPermission !== 'granted') {
                      setShowScreenPermModal(true)
                    } else {
                      handleStart()
                    }
                  } : undefined}>{t.live_empty}</EmptyPanel>
                )}
                <div ref={rawEndRef} />
              </div>

              {/* Left panel footer — Copy icon + word count */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  disabled={!rawTranscript}
                  onClick={() => handleCopy(rawTranscript, setCopiedRaw)}
                  title={t.translate_copy}
                  className={[
                    'flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150',
                    rawTranscript
                      ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800 cursor-pointer'
                      : 'text-gray-200 dark:text-gray-700 cursor-not-allowed',
                    copiedRaw ? '!text-green-500 dark:!text-green-400' : '',
                  ].join(' ')}
                >
                  {copiedRaw ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                </button>
                {wordCount > 0 && (
                  <span className="text-xs text-gray-400 tabular-nums select-none">
                    {wordCount.toLocaleString()} {t.live_words}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Bản Dịch */}
            <div className="flex flex-col h-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              {/* STT provider badge — top-right, only when active */}
              {isActive && (
                <div className="flex-shrink-0 flex items-center justify-end px-4 pt-2 pb-1">
                  <span className={[
                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold select-none',
                    activeSttProvider === 'whisper'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : activeSttProvider === 'gemini'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : activeSttProvider === 'groq'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                  ].join(' ')}>
                    <span className={[
                      'w-1.5 h-1.5 rounded-full flex-shrink-0',
                      activeSttProvider === 'whisper' ? 'bg-emerald-500' :
                      activeSttProvider === 'gemini'  ? 'bg-blue-500' :
                      activeSttProvider === 'groq'    ? 'bg-purple-500' : 'bg-gray-400',
                    ].join(' ')} />
                    {activeSttProvider === 'whisper' ? 'Whisper' :
                     activeSttProvider === 'gemini'  ? 'Gemini' :
                     activeSttProvider === 'groq'    ? 'Groq (free)' :
                     t.live_stt_backend_none}
                  </span>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
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

              {/* Right panel footer — Copy icon + Tổng hợp nội dung button */}
              <div className="flex-shrink-0 flex items-center justify-between px-4 h-12 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  disabled={!translation}
                  onClick={() => handleCopy(translation, setCopiedTx)}
                  title={t.translate_copy}
                  className={[
                    'flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150',
                    translation
                      ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800 cursor-pointer'
                      : 'text-gray-200 dark:text-gray-700 cursor-not-allowed',
                    copiedTx ? '!text-green-500 dark:!text-green-400' : '',
                  ].join(' ')}
                >
                  {copiedTx ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                </button>

                {showSummaryBtn && (
                  <button
                    type="button"
                    onClick={handleOpenSummaryPopup}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold
                               bg-purple-500 hover:bg-purple-600 text-white cursor-pointer
                               transition-all duration-200 shadow-sm select-none"
                  >
                    <LightbulbIcon className="w-3.5 h-3.5" />
                    {t.live_summarize}
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* ── End two panels ── */}

        </div>
      </div>
      {/* ── End main scrollable area ── */}

      {/* ── Summary popup ── */}
      {showSummaryPopup && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop div — keyboard Escape handled by onKeyDown
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowSummaryPopup(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowSummaryPopup(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Popup header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <LightbulbIcon className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.live_summary_title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryPopup(false)}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors duration-150 cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-5 pt-3 pb-1 flex-shrink-0">
              {(['summary', 'actions', 'decisions'] as PostTab[]).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPostTab(tab)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer select-none',
                    postTab === tab
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : 'text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                  ].join(' ')}
                >
                  {tab === 'summary' ? t.live_post_tab_summary : tab === 'actions' ? t.live_post_tab_actions : t.live_post_tab_decisions}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
              {/* ── Tóm tắt ── */}
              {postTab === 'summary' && (
                isSummarizing ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-purple-400 dark:text-purple-600">
                    <SpinnerIcon className="w-6 h-6 animate-spin" />
                    <span className="text-sm">{t.live_summarizing}</span>
                  </div>
                ) : summary ? (
                  <MarkdownText text={summary} className="text-gray-800 dark:text-gray-200" />
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-600 italic py-4 text-center">{t.live_empty_desc}</p>
                )
              )}

              {/* ── Việc cần làm ── */}
              {postTab === 'actions' && (
                isExtractingActionItems ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-amber-400 dark:text-amber-600">
                    <SpinnerIcon className="w-6 h-6 animate-spin" />
                    <span className="text-sm">{t.live_extracting_action_items}</span>
                  </div>
                ) : actionItems ? (
                  <MarkdownText text={actionItems} className="text-gray-800 dark:text-gray-200" />
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-600 italic py-4 text-center">{t.live_empty_desc}</p>
                )
              )}

              {/* ── Quyết định ── */}
              {postTab === 'decisions' && (
                isExtractingDecisions ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-green-400 dark:text-green-600">
                    <SpinnerIcon className="w-6 h-6 animate-spin" />
                    <span className="text-sm">{t.live_extracting_decisions}</span>
                  </div>
                ) : decisions ? (
                  <MarkdownText text={decisions} className="text-gray-800 dark:text-gray-200" />
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-600 italic py-4 text-center">{t.live_empty_desc}</p>
                )
              )}
            </div>

            {/* Popup footer — action buttons */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 gap-2">
              {/* Copy active tab content */}
              {postTab === 'summary' && summary && !isSummarizing && (
                <button
                  type="button"
                  onClick={() => handleCopy(summary, setCopiedSummary)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer
                              ${copiedSummary ? 'text-green-600 dark:text-green-400' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  {copiedSummary ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  {copiedSummary ? t.translate_copied : t.translate_copy}
                </button>
              )}
              {postTab === 'actions' && actionItems && !isExtractingActionItems && (
                <button
                  type="button"
                  onClick={() => handleCopy(actionItems, setCopiedSummary)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer
                              ${copiedSummary ? 'text-green-600 dark:text-green-400' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  {copiedSummary ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  {copiedSummary ? t.translate_copied : t.translate_copy}
                </button>
              )}
              {postTab === 'decisions' && decisions && !isExtractingDecisions && (
                <button
                  type="button"
                  onClick={() => handleCopy(decisions, setCopiedSummary)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 cursor-pointer
                              ${copiedSummary ? 'text-green-600 dark:text-green-400' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  {copiedSummary ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  {copiedSummary ? t.translate_copied : t.translate_copy}
                </button>
              )}
              {/* Spacer if no copy button */}
              {((postTab === 'summary' && (!summary || isSummarizing)) ||
                (postTab === 'actions' && (!actionItems || isExtractingActionItems)) ||
                (postTab === 'decisions' && (!decisions || isExtractingDecisions))) && (
                <div />
              )}

              {/* Right-side action button per tab */}
              <div className="flex items-center gap-2 ml-auto">
                {postTab === 'summary' && !isSummarizing && (
                  <button
                    type="button"
                    onClick={handleSummarize}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                               bg-purple-500 hover:bg-purple-600 text-white cursor-pointer
                               transition-all duration-200 shadow-sm"
                  >
                    <LightbulbIcon className="w-3.5 h-3.5" />
                    {summary ? t.live_summarize_again : t.live_summarize}
                  </button>
                )}
                {postTab === 'actions' && !isExtractingActionItems && (
                  <button
                    type="button"
                    onClick={handleExtractActionItems}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                               bg-amber-500 hover:bg-amber-600 text-white cursor-pointer
                               transition-all duration-200 shadow-sm"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    {actionItems ? t.live_action_items_extract_again : t.live_action_items_extract}
                  </button>
                )}
                {postTab === 'decisions' && !isExtractingDecisions && (
                  <button
                    type="button"
                    onClick={handleExtractDecisions}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                               bg-green-500 hover:bg-green-600 text-white cursor-pointer
                               transition-all duration-200 shadow-sm"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    {decisions ? t.live_decisions_extract_again : t.live_decisions_extract}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen Recording permission modal */}
      {showScreenPermModal && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop div — keyboard Escape handled by onKeyDown
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowScreenPermModal(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowScreenPermModal(false)}
        >
          <div
            className="relative mx-4 w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4"
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                <InfoCircleIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t.live_screen_permission_title}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {t.live_screen_recording_hint.split(/(<strong>.*?<\/strong>)/g).map((part, i) => {
                    const m = part.match(/^<strong>(.*?)<\/strong>$/)
                    // biome-ignore lint/suspicious/noArrayIndexKey: stable index for locale string segments
                    return m ? <strong key={i} className="text-gray-700 dark:text-gray-200">{m[1]}</strong> : part
                  })}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowScreenPermModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 cursor-pointer"
              >
                {t.translate_error_dismiss}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window.api?.openExternal === 'function') {
                    window.api.openExternal(MACOS_SCREEN_RECORDING_PREFS)
                  } else {
                    window.open(MACOS_SCREEN_RECORDING_PREFS)
                  }
                  setShowScreenPermModal(false)
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors duration-150 cursor-pointer shadow-sm"
              >
                <GearIcon className="w-3.5 h-3.5" />
                {t.live_open_system_settings}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* webSpeech fallback toast — shown when user picked Browser Speech API which isn't
          supported in Live Translate (uses Whisper instead). Floating near footer, dismissable. */}
      {sttProvider === 'webSpeech' && (
        <div className="absolute bottom-16 inset-x-0 flex justify-center px-4 z-40 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                          bg-blue-50 dark:bg-blue-950/60
                          border border-blue-200 dark:border-blue-700/60
                          text-blue-600 dark:text-blue-300
                          text-xs font-medium shadow-sm
                          pointer-events-auto">
            <InfoCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t.live_webspeech_not_supported}</span>
            <button
              type="button"
              onClick={() => openSettings()}
              className="underline font-semibold ml-0.5 cursor-pointer hover:text-blue-800 dark:hover:text-blue-100 transition-colors"
            >
              {t.translate_error_open_settings}
            </button>
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

function EmptyPanel({ children, icon, onClick }: { children: React.ReactNode; icon: 'mic' | 'translate'; onClick?: () => void }) {
  const iconEl = icon === 'mic'
    ? <MicrophoneIcon className="w-6 h-6 text-gray-400" />
    : <TranslateIcon className="w-6 h-6 text-blue-300 dark:text-blue-700" />

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 hover:scale-105 active:scale-95"
        >
          {iconEl}
        </button>
      ) : (
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-150">
          {iconEl}
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-600 text-center max-w-[160px]">{children}</p>
    </div>
  )
}
