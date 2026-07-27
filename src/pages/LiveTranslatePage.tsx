import { useEffect, useRef, useState } from 'react'
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
  SubtitlesIcon,
  TranslateIcon,
  TrashIcon,
  XIcon,} from '../components/ui/icons'
import { COPY_FEEDBACK_DURATION_MS, DEFAULT_SEGMENT_DURATION_MS, MIN_SEGMENT_DURATION_MS } from '../constants/ui'
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

  const [copiedRaw,       setCopiedRaw]       = useState(false)
  const [copiedTx,        setCopiedTx]        = useState(false)
  const [copiedSummary,   setCopiedSummary]   = useState(false)
  const [copiedActions,   setCopiedActions]   = useState(false)
  const [copiedDecisions, setCopiedDecisions] = useState(false)
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

  // ── Global Escape handler for open modals ──
  // Backdrop-level onKeyDown only fires when the backdrop or its descendants
  // have focus; in practice the user's focus stays on the trigger button, so
  // Escape would do nothing without this document listener.
  useEffect(() => {
    if (!showSummaryPopup && !showScreenPermModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showSummaryPopup) setShowSummaryPopup(false)
      if (showScreenPermModal) setShowScreenPermModal(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showSummaryPopup, showScreenPermModal])

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
    <div className="app-page relative">

      {/* ── Main area ── */}
      <div className="app-workspace">
        <div className="glass-panel flex-1 min-h-0 flex flex-col overflow-hidden">

          {/* Controls: source lang | target lang + start/stop + settings */}
          <div className="translate-panel-header">

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

            {/* No swap control — source is always auto-detected. */}

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
                'btn-sm flex-shrink-0',
                isActive
                  ? 'btn-danger'
                  : (!hasOpenAIKey || !hasAnyKey)
                    ? 'btn-secondary'
                    : 'btn-primary',
              ].join(' ')}
            >
              {isActive ? (
                <><StopIcon className="w-3.5 h-3.5" />{t.live_stop}</>
              ) : (
                <><MicrophoneIcon className="w-3.5 h-3.5" />{t.live_start}</>
              )}
            </button>

            {/* Advanced AI config popup */}
            <div className="relative flex-shrink-0" ref={aiConfigRef}>
              <button
                type="button"
                onClick={() => setShowAIConfig((v) => !v)}
                title={t.translate_ai_config_title}
                className={`toolbar-icon-button ai-config-button cursor-pointer ${showAIConfig ? 'toolbar-icon-button-active' : ''}`}
              >
                <GearIcon className="w-3.5 h-3.5" />
              </button>

              {showAIConfig && (
                <div className="floating-panel ai-config-panel absolute top-full right-0 mt-2 z-50 w-[440px] max-w-[calc(100vw-2rem)] p-4 flex flex-col gap-4">
                  <h2 className="popover-title">
                    {t.translate_ai_config_title}
                  </h2>

                  {/* Model */}
                  <ModelSelector />

                  {/* Divider */}
                  <div className="border-t border-gray-100 dark:border-gray-800" />

                  {/* Nguồn âm thanh */}
                  <div className="flex flex-col gap-2">
                    <span className="ui-kicker">
                      {t.live_audio_source_label}
                    </span>
                    <div className="inline-flex w-fit items-center gap-2">
                      <button
                        type="button" disabled={isActive} onClick={() => setAudioMode('mic')}
                        title={t.live_audio_mode_mic_title}
                        className={[
                          'btn-segment min-h-10 rounded-lg border border-transparent px-3 shadow-none',
                          audioMode === 'mic'
                            ? 'btn-segment-active border-[var(--vzn-accent-border)]'
                            : 'bg-transparent hover:bg-[var(--vzn-surface-hover)]',
                          isActive ? 'opacity-50' : '',
                        ].join(' ')}
                      >
                        <MicrophoneIcon className="w-3 h-3" />
                        <span>{t.live_audio_mode_mic}</span>
                      </button>
                      <button
                        type="button" disabled={isActive} onClick={() => setAudioMode('system')}
                        title={t.live_audio_mode_system_title}
                        className={[
                          'btn-segment min-h-10 rounded-lg border border-transparent px-3 shadow-none',
                          audioMode === 'system'
                            ? 'btn-segment-active border-[var(--vzn-accent-border)]'
                            : 'bg-transparent hover:bg-[var(--vzn-surface-hover)]',
                          isActive ? 'opacity-50' : '',
                        ].join(' ')}
                      >
                        <MonitorIcon className="w-3 h-3" />
                        <span>{t.live_audio_mode_system}</span>
                      </button>
                      <button
                        type="button" disabled={isActive} onClick={() => setAudioMode('both')}
                        title={t.live_audio_mode_both_title}
                        className={[
                          'btn-segment min-h-10 rounded-lg border border-transparent px-3 shadow-none',
                          audioMode === 'both'
                            ? 'btn-segment-active border-[var(--vzn-accent-border)]'
                            : 'bg-transparent hover:bg-[var(--vzn-surface-hover)]',
                          isActive ? 'opacity-50' : '',
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
                    <span className="ui-kicker">
                      {t.live_subtitles}
                    </span>
                    <div className="flex items-center gap-2 relative">
                      <button
                        type="button"
                        onClick={() => setShowSubtitles(v => !v)}
                        title={showSubtitles ? t.live_subtitles_hide_title : t.live_subtitles_show_title}
                        className={[
                          showSubtitles ? 'btn-primary' : 'btn-secondary',
                          'btn-sm',
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
                          'btn-icon',
                          showSubtitleConfig ? 'btn-active' : '',
                        ].join(' ')}
                      >
                        <GearIcon className="w-3 h-3" />
                      </button>

                      {/* Subtitle settings nested popup */}
                      {showSubtitleConfig && (
                        <div className="floating-panel absolute top-full mt-2 left-0 z-50 w-64 p-3 flex flex-col gap-3 select-none">
                          <div>
                            <p className="ui-kicker mb-1.5">
                              {t.live_subtitle_text_color}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {subtitleColors.map(({ label, value }) => (
                                <button
                                  key={value} type="button" title={label}
                                  onClick={() => setSubtitleSettings(s => ({ ...s, textColor: value }))}
                                  className={[
                                    'btn-swatch',
                                    subtitleSettings.textColor === value ? 'btn-swatch-active' : '',
                                  ].join(' ')}
                                  style={{ background: value }}
                                  aria-label={label}
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="ui-kicker mb-1.5">
                              {t.live_subtitle_font_size} — {subtitleSettings.fontSize}px
                            </p>
                            <div className="segmented-control">
                              {SUBTITLE_FONT_SIZES.map(({ size, label }) => (
                                <button
                                  key={size} type="button"
                                  onClick={() => setSubtitleSettings(s => ({ ...s, fontSize: size }))}
                                  className={[
                                    'btn-segment flex-1',
                                    subtitleSettings.fontSize === size ? 'btn-segment-active' : '',
                                  ].join(' ')}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="ui-kicker mb-1.5">
                              {t.live_subtitle_bg_opacity} — {subtitleSettings.bgOpacity}%
                            </p>
                            <input
                              type="range" min={0} max={100} step={5}
                              value={subtitleSettings.bgOpacity}
                              onChange={e => setSubtitleSettings(s => ({ ...s, bgOpacity: Number(e.target.value) }))}
                              className="w-full accent-gray-500 cursor-pointer"
                            />
                            <div className="ui-micro mt-0.5 flex justify-between text-gray-300 dark:text-gray-600">
                              <span>{t.live_subtitle_transparent}</span>
                              <span>{t.live_subtitle_opaque}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSubtitleSettings({ ...DEFAULT_SUBTITLE_SETTINGS })}
                            className="btn-link btn-xs justify-center"
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
                      <span className="ui-kicker">
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
                          'btn-danger btn-xs',
                          rawTranscript ? '' : 'opacity-45',
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
                          'btn-secondary btn-xs',
                          rawTranscript ? '' : 'opacity-45',
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
                          'btn-secondary btn-xs',
                          segments.length ? '' : 'opacity-45',
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
          {/* ── End controls ── */}

          {/* ── Body: notices + panels ── */}
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 gap-2">

          {/* Notices */}
          {!hasOpenAIKey && (
            <Notice>
              {t.live_no_openai_key}{' '}
              <button type="button" onClick={() => openSettings()} className="btn-link">
                {t.translate_error_open_settings}
              </button>
            </Notice>
          )}


          {/* ── Two panels: Nguyên Bản | Bản Dịch ── */}
          <div className="app-panel-grid">

            {/* Left: Nguyên Bản */}
            <div className="glass-panel h-full flex flex-col">
              {/* Status indicator bar (only when active) */}
              {isActive && (
                <div className="flex-shrink-0 flex items-center px-4 pt-2 pb-1">
                  <span className="flex items-center gap-1.5 select-none">
                    {isTranscribing ? (
                      <>
                        <span className="flex-shrink-0" style={{color:'var(--vzn-text-muted)'}}><SpinnerIcon className="w-2.5 h-2.5 animate-spin" /></span>
                        <span className="ui-micro font-medium" style={{color:'var(--vzn-text-muted)'}}>{t.voice_transcribing}</span>
                      </>
                    ) : isTranslating ? (
                      <>
                        <span className="flex-shrink-0" style={{color:'var(--vzn-text-muted)'}}><SpinnerIcon className="w-2.5 h-2.5 animate-spin" /></span>
                        <span className="ui-micro font-medium" style={{color:'var(--vzn-text-muted)'}}>{t.live_status_translating}</span>
                      </>
                    ) : pendingText ? (
                      <>
                        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{background:'var(--vzn-text-soft)'}} />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{background:'var(--vzn-text-muted)'}} />
                        </span>
                        <span className="ui-micro font-medium" style={{color:'var(--vzn-text-muted)'}}>{t.voice_whisper_mode}</span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{background:'var(--vzn-text-soft)'}} />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{background:'var(--vzn-text-muted)'}} />
                        </span>
                        <span className="ui-micro font-medium" style={{color:'var(--vzn-text-muted)'}}>{t.live_status_listening}</span>
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
                        <span className="ui-badge-xs mt-0.5 flex-shrink-0" style={{color:'var(--vzn-text-muted)'}}>
                          {segments.length > 0
                            ? (speakerNameMap[segments[segments.length - 1].speaker] || segments[segments.length - 1].speaker)
                            : t.live_speaker_default}
                        </span>
                        <span className="ui-reader-text italic" style={{color:'var(--vzn-text-muted)'}}>
                          {pendingText}
                          <span className="not-italic inline-block ml-0.5 w-0.5 h-4 animate-pulse align-middle" style={{background:'var(--vzn-text-soft)'}} />
                        </span>
                      </div>
                    )}
                    {isActive && !pendingText && (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="inline-block w-0.5 h-4 animate-pulse" style={{background:'var(--vzn-text-soft)'}} />
                      </div>
                    )}
                  </>
                ) : rawTranscript ? (
                  <p className="ui-reader-text whitespace-pre-wrap p-1">
                    {rawTranscript}
                    {isActive && <span className="inline-block ml-0.5 w-0.5 h-4 animate-pulse align-middle" style={{background:'var(--vzn-text-soft)'}} />}
                  </p>
                ) : (
                  <EmptyPanel
                    icon="mic"
                    label={t.live_start}
                    onClick={hasOpenAIKey && hasAnyKey ? () => {
                      if ((audioMode === 'system' || audioMode === 'both') && isMac && screenPermission !== 'granted') {
                        setShowScreenPermModal(true)
                      } else {
                        handleStart()
                      }
                    } : undefined}
                  >{t.live_empty}</EmptyPanel>
                )}
                <div ref={rawEndRef} />
              </div>

              {/* Left panel footer — Copy icon + word count */}
              <div className="surface-footer">
                <button
                  type="button"
                  disabled={!rawTranscript}
                  onClick={() => handleCopy(rawTranscript, setCopiedRaw)}
                  title={t.translate_copy}
                  className={[
                    'btn-icon',
                    copiedRaw ? 'btn-active' : '',
                  ].join(' ')}
                >
                  {copiedRaw ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                </button>
                {wordCount > 0 && (
                  <span className="text-xs tabular-nums select-none" style={{color:'var(--vzn-text-muted)'}}>
                    {wordCount.toLocaleString()} {t.live_words}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Bản Dịch */}
            <div className="glass-panel h-full flex flex-col">
              {/* STT provider badge — top-right, only when active */}
              {isActive && (
                <div className="flex-shrink-0 flex items-center justify-end px-4 pt-2 pb-1">
                  <span className="ui-badge-xs gap-1.5 select-none" style={{background:'var(--vzn-surface-muted)',color:'var(--vzn-text-soft)'}}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:'var(--vzn-text-muted)'}} />
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
                        <span style={{color:'var(--vzn-text-muted)'}}><SpinnerIcon className="w-3 h-3 animate-spin" /></span>
                        <span className="text-xs italic" style={{color:'var(--vzn-text-muted)'}}>{t.live_status_translating}</span>
                      </div>
                    )}
                    {isActive && !isTranslating && (
                      <div className="flex items-center gap-2 pl-1">
                        <span className="inline-block w-0.5 h-4 animate-pulse" style={{background:'var(--vzn-border)'}} />
                      </div>
                    )}
                  </>
                ) : translation ? (
                  <p className="ui-reader-text font-medium whitespace-pre-wrap p-1">
                    {translation}
                  </p>
                ) : (
                  <EmptyPanel icon="translate">{t.live_empty_desc}</EmptyPanel>
                )}
                <div ref={txEndRef} />
              </div>

              {/* Right panel footer — Copy icon + Tổng hợp nội dung button */}
              <div className="surface-footer">
                <button
                  type="button"
                  disabled={!translation}
                  onClick={() => handleCopy(translation, setCopiedTx)}
                  title={t.translate_copy}
                  className={[
                    'btn-icon',
                    copiedTx ? 'btn-active' : '',
                  ].join(' ')}
                >
                  {copiedTx ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                </button>

                {showSummaryBtn && (
                  <button
                    type="button"
                    onClick={handleOpenSummaryPopup}
                    className="btn-primary btn-sm"
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
          {/* ── End body ── */}
        </div>
        {/* ── End surface panel ── */}
      </div>
      {/* ── End main area ── */}

      {/* ── Summary popup ── */}
      {showSummaryPopup && (
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop div — keyboard Escape handled by onKeyDown
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowSummaryPopup(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowSummaryPopup(false)}
        >
          <div
            className="modal-surface relative w-full max-w-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Popup header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <LightbulbIcon className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.live_summary_title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSummaryPopup(false)}
                className="btn-icon btn-icon-sm"
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
                    'btn-segment whitespace-nowrap',
                    postTab === tab ? 'btn-segment-active' : '',
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
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-400 dark:text-gray-600">
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
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-400 dark:text-gray-600">
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
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-gray-400 dark:text-gray-600">
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
                  className={`btn-secondary btn-xs ${copiedSummary ? 'btn-active' : ''}`}
                >
                  {copiedSummary ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  {copiedSummary ? t.translate_copied : t.translate_copy}
                </button>
              )}
              {postTab === 'actions' && actionItems && !isExtractingActionItems && (
                <button
                  type="button"
                  onClick={() => handleCopy(actionItems, setCopiedActions)}
                  className={`btn-secondary btn-xs ${copiedActions ? 'btn-active' : ''}`}
                >
                  {copiedActions ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  {copiedActions ? t.translate_copied : t.translate_copy}
                </button>
              )}
              {postTab === 'decisions' && decisions && !isExtractingDecisions && (
                <button
                  type="button"
                  onClick={() => handleCopy(decisions, setCopiedDecisions)}
                  className={`btn-secondary btn-xs ${copiedDecisions ? 'btn-active' : ''}`}
                >
                  {copiedDecisions ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  {copiedDecisions ? t.translate_copied : t.translate_copy}
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
                    className="btn-primary btn-sm"
                  >
                    <LightbulbIcon className="w-3.5 h-3.5" />
                    {summary ? t.live_summarize_again : t.live_summarize}
                  </button>
                )}
                {postTab === 'actions' && !isExtractingActionItems && (
                  <button
                    type="button"
                    onClick={handleExtractActionItems}
                    className="btn-primary btn-sm"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    {actionItems ? t.live_action_items_extract_again : t.live_action_items_extract}
                  </button>
                )}
                {postTab === 'decisions' && !isExtractingDecisions && (
                  <button
                    type="button"
                    onClick={handleExtractDecisions}
                    className="btn-primary btn-sm"
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
            className="modal-surface relative mx-4 w-full max-w-sm p-6 flex flex-col gap-4"
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-950/40 flex items-center justify-center">
                <InfoCircleIcon className="w-5 h-5 text-gray-500" />
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
                className="btn-secondary btn-sm"
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
                className="btn-primary btn-sm"
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
                          bg-gray-50 dark:bg-gray-950/60
                          border border-gray-200 dark:border-gray-700/60
                          text-gray-600 dark:text-gray-300
                          text-xs font-medium shadow-sm
                          pointer-events-auto">
            <InfoCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t.live_webspeech_not_supported}</span>
            <button
              type="button"
              onClick={() => openSettings()}
              className="btn-link ml-0.5 text-xs"
            >
              {t.translate_error_open_settings}
            </button>
          </div>
        </div>
      )}

      {/* Pipeline error toast */}
      {pipelineError && (
        <div className="pointer-events-none absolute bottom-14 inset-x-0 flex justify-center px-4 z-50">
          <div className="ui-error-box flex items-center gap-2 text-xs font-medium shadow-md
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
function Notice({ children }: { children: React.ReactNode; variant?: 'warning' | 'error' }) {
  const cls = 'ui-error-box'
  return (
    <div className={`flex-shrink-0 flex items-start gap-2 p-3 rounded-lg border text-sm ${cls}`}>
      <AlertTriangleIcon className="ui-error-icon mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function EmptyPanel({ children, icon, onClick, label }: { children: React.ReactNode; icon: 'mic' | 'translate'; onClick?: () => void; label?: string }) {
  const iconEl = icon === 'mic'
    ? <MicrophoneIcon className="w-6 h-6 text-gray-400" />
    : <TranslateIcon className="w-6 h-6 text-gray-300 dark:text-gray-700" />

  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={label ?? (icon === 'mic' ? 'Start recording' : 'Translate')}
          className="btn-icon btn-icon-2xl"
        >
          {iconEl}
        </button>
      ) : (
        <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-150">
          {iconEl}
        </div>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-600 text-center max-w-[160px]">{children}</p>
    </div>
  )
}
