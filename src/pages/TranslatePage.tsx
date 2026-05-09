import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { useTranslate } from '../hooks/useTranslate'
import { useAppStore, useT } from '../store/useAppStore'
import ModelSelector from '../components/ModelSelector'
import {
  IconSwap, IconCopy, IconCheck, IconSpeaker, IconStop,
  IconSparkle, IconClose, IconTranslate, IconChevronDown,
  IconSearch, IconMic, IconPaperclip,
} from '../components/icons/AppIcons'

const LANG_CODES = ['auto','en','vi','zh','zh-TW','ja','ko','fr','de','es','pt','ru','ar','th','id','it','nl','pl','tr','hi'] as const
const STYLES = ['general','formal','casual','business','technical','natural'] as const
const PHONETIC_MODES = ['off','standard','phonetic'] as const

// ── Searchable language picker dropdown ───────────────────────────────────────
function LanguagePicker({ langs, selected, onChange, align = 'left' }: {
  langs: { code: string; label: string }[]
  selected: string
  onChange: (code: string) => void
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedLabel = useMemo(
    () => langs.find((l) => l.code === selected)?.label ?? selected,
    [langs, selected]
  )
  const filtered = useMemo(() => {
    if (!query.trim()) return langs
    const q = query.toLowerCase()
    return langs.filter((l) => l.label.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q))
  }, [langs, query])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
    else setQuery('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 8,
          background: open ? 'var(--glass-bg-hover)' : 'transparent', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', transition: 'background 0.12s', maxWidth: 210,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <IconChevronDown size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', [align === 'right' ? 'right' : 'left']: 0,
          zIndex: 400, width: 230, borderRadius: 12,
          background: 'var(--surface-elevated)', border: '1px solid var(--glass-border-strong)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden', animation: 'slideUp 0.15s ease-out',
        }}>
          <div style={{ padding: '8px 8px 0' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', display: 'flex' }}>
                <IconSearch size={12} />
              </span>
              <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
                style={{ fontSize: 12, paddingLeft: 30, width: '100%' }}
              />
            </div>
          </div>
          <div className="scroll-area" style={{ maxHeight: 240, padding: '4px 4px 8px' }}>
            {filtered.length > 0 ? filtered.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`nav-item${selected === l.code ? ' active' : ''}`}
                onClick={() => { onChange(l.code); setOpen(false) }}
                style={{ border: 'none', width: '100%', textAlign: 'left', fontSize: 12, borderRadius: 7 }}
              >
                {l.label}
              </button>
            )) : (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0', margin: 0 }}>No results</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Phonetic text renderer ────────────────────────────────────────────────────
function PhoneticText({ text }: { text: string }) {
  type Segment = { kind: 'plain'; value: string } | { kind: 'ruby'; word: string; reading: string }

  const segments = useMemo<Segment[]>(() => {
    const result: Segment[] = []
    const regex = /\{([^|{}]+)\|([^{}]+)\}/g
    let last = 0
    let m: RegExpExecArray | null

    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) result.push({ kind: 'plain', value: text.slice(last, m.index) })
      result.push({ kind: 'ruby', word: m[1].trim(), reading: m[2].trim() })
      last = m.index + m[0].length
    }
    if (last < text.length) result.push({ kind: 'plain', value: text.slice(last) })
    return result
  }, [text])

  const hasAnnotations = segments.some((s) => s.kind === 'ruby')

  if (!hasAnnotations) {
    return (
      <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
        {text}
      </p>
    )
  }

  return (
    <div style={{ margin: '12px 0 0', lineHeight: 2.6, wordBreak: 'break-word' }}>
      {segments.map((seg, i) =>
        seg.kind === 'plain' ? (
          <span key={i} style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{seg.value}</span>
        ) : (
          <ruby key={i} style={{ display: 'inline', verticalAlign: 'bottom' }}>
            <span style={{ fontSize: 14, color: 'var(--text-primary)' }}>{seg.word}</span>
            <rt style={{ fontSize: '0.62em', color: 'var(--accent)', fontStyle: 'normal', fontWeight: 400, letterSpacing: '-0.01em', textAlign: 'center' }}>
              {seg.reading}
            </rt>
          </ruby>
        )
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TranslatePage() {
  const t = useT()
  const sttProvider = useAppStore((s) => s.sttProvider)

  const {
    sourceText, translatedText, phoneticText,
    sourceLang, targetLang,
    isTranslating, translateError,
    autoTranslate, phoneticMode, translationStyle,
    copied, isRewriting,
    speakingPanel,
    isVoiceActive, isVoiceInterim,
    detectedSourceLang,
    charCount,
    imageAttachment, isDraggingOver,
    handleTranslate, handleSwapLanguages, handleCopy,
    handleSpeak, handleDismissError,
    handleSourceChange, handleClearSource,
    handleRewrite,
    handleVoiceRecordingChange, handleVoiceTranscript,
    fileInputRef, handleFileInputChange,
    handleRemoveImage,
    handleSourcePanelPaste, handleSourcePanelDragOver,
    handleSourcePanelDragLeave, handleSourcePanelDrop,
    setTargetLang, setPhoneticMode, setTranslationStyle, setAutoTranslate,
  } = useTranslate()

  const sourceLangStore = useAppStore((s) => s.sourceLang)
  const setSourceLang   = useAppStore((s) => s.setSourceLang)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  // ── Voice recording state machine ─────────────────────────────────────────
  const [voiceRecState, setVoiceRecState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const mediaRecRef  = useRef<MediaRecorder | null>(null)
  const audioChunks  = useRef<Blob[]>([])

  const handleMicClick = useCallback(async () => {
    if (voiceRecState === 'recording') { mediaRecRef.current?.stop(); return }
    if (voiceRecState !== 'idle') return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      mediaRecRef.current = rec
      audioChunks.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setVoiceRecState('processing')
        handleVoiceRecordingChange(false)
        try {
          const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
          const ab   = await blob.arrayBuffer()
          const res  = await window.api?.transcribeAudio?.({
            audioData: ab, mimeType: 'audio/webm',
            language: sourceLangStore === 'auto' ? undefined : sourceLangStore,
            sttProvider,
          })
          if (res?.success && res.text) handleVoiceTranscript(res.text, true)
        } catch { /* STT unavailable */ }
        finally { setVoiceRecState('idle') }
      }
      setVoiceRecState('recording')
      handleVoiceRecordingChange(true)
      rec.start()
    } catch { setVoiceRecState('idle') }
  }, [voiceRecState, sourceLangStore, sttProvider, handleVoiceRecordingChange, handleVoiceTranscript])

  // ── Computed ──────────────────────────────────────────────────────────────
  const langs = useMemo(
    () => LANG_CODES.map((code) => ({ code, label: t.lang_names[code] ?? code })),
    [t]
  )
  const sourceLangs = langs
  const targetLangs = useMemo(() => langs.filter((l) => l.code !== 'auto'), [langs])

  const styleLabels = useMemo<Record<typeof STYLES[number], string>>(() => ({
    general: t.translate_style_general, formal: t.translate_style_formal,
    casual: t.translate_style_casual, business: t.translate_style_business,
    technical: t.translate_style_technical, natural: t.translate_style_natural,
  }), [t])

  const phoneticLabels = useMemo(() => ({
    off: t.translate_phonetic_no, standard: t.translate_phonetic_standard, phonetic: t.translate_phonetic_ipa,
  }), [t])

  const detectedLabel = useMemo(
    () => detectedSourceLang ? (langs.find((l) => l.code === detectedSourceLang)?.label ?? detectedSourceLang) : null,
    [langs, detectedSourceLang]
  )

  const handleSourceScroll = useCallback(() => {
    if (!sourceRef.current || !resultRef.current) return
    const ratio = sourceRef.current.scrollTop / (sourceRef.current.scrollHeight - sourceRef.current.clientHeight || 1)
    resultRef.current.scrollTop = ratio * (resultRef.current.scrollHeight - resultRef.current.clientHeight)
  }, [])

  const [isSwapping, setIsSwapping] = useState(false)
  const handleSwap = useCallback(() => {
    setIsSwapping(true)
    handleSwapLanguages()
    setTimeout(() => setIsSwapping(false), 380)
  }, [handleSwapLanguages])

  const micIsRecording  = voiceRecState === 'recording' || isVoiceActive
  const micIsProcessing = voiceRecState === 'processing'

  return (
    <div className="page-container" style={{ gap: 10 }}>
      {/* Hidden file input for image attachment */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <ModelSelector />
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2 }}>
          {STYLES.map((s) => (
            <button
              key={s} type="button" className="btn btn-ghost"
              onClick={() => setTranslationStyle(s)}
              style={{
                padding: '4px 9px', fontSize: 11, border: 'none',
                background: translationStyle === s ? 'var(--glass-bg-active)' : 'transparent',
                color: translationStyle === s ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
            >
              {styleLabels[s]}
            </button>
          ))}
        </div>
        <div className="tab-bar">
          {PHONETIC_MODES.map((m) => (
            <button
              key={m} type="button"
              className={`tab-item${phoneticMode === m ? ' active' : ''}`}
              onClick={() => setPhoneticMode(m)}
              style={{ border: 'none', fontSize: 11 }}
            >
              {phoneticLabels[m]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`btn ${autoTranslate ? 'btn-primary' : 'btn-glass'}`}
          onClick={() => setAutoTranslate(!autoTranslate)}
          style={{
            padding: '5px 12px', fontSize: 12,
            border: autoTranslate ? '1px solid transparent' : undefined,
          }}
        >
          {t.translate_mode_auto}
        </button>
      </div>

      {/* ── Error banner ── */}
      {translateError && (
        <div style={{
          background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)',
          borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center',
          gap: 10, fontSize: 12, color: 'var(--danger)', flexShrink: 0,
        }}>
          <span style={{ flex: 1 }}>{translateError}</span>
          <button type="button" className="btn-icon" onClick={handleDismissError} style={{ color: 'var(--danger)' }}>
            <IconClose size={13} />
          </button>
        </div>
      )}

      {/* ── Panels ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div className="panel-grid" style={{ height: '100%' }}>

          {/* ── Source panel ── */}
          <div
            className="panel glass"
            style={{
              borderRadius: 16,
              outline: isDraggingOver ? '2px solid var(--accent)' : 'none',
              transition: 'outline 0.15s',
            }}
            onDragOver={handleSourcePanelDragOver}
            onDragLeave={handleSourcePanelDragLeave}
            onDrop={handleSourcePanelDrop}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '7px 10px 5px 8px',
              borderBottom: '1px solid var(--glass-border)', flexShrink: 0,
            }}>
              <LanguagePicker langs={sourceLangs} selected={sourceLangStore} onChange={setSourceLang} />
              {detectedLabel && sourceLangStore === 'auto' && (
                <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 2, whiteSpace: 'nowrap' }}>
                  — {detectedLabel}
                </span>
              )}
              <div style={{ flex: 1 }} />
              {(isVoiceActive || isVoiceInterim) && (
                <div className="voice-wave" style={{ marginRight: 6 }}>
                  {[1,2,3,4,5].map((i) => <div key={i} className="voice-bar" />)}
                </div>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{charCount}</span>
              {(sourceText || imageAttachment) && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={imageAttachment ? handleRemoveImage : handleClearSource}
                  data-tooltip={t.translate_clear}
                  style={{ marginLeft: 2 }}
                >
                  <IconClose size={13} />
                </button>
              )}
            </div>

            {/* Content: image preview or textarea */}
            {imageAttachment ? (
              <div style={{ flex: 1, padding: '12px 14px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={imageAttachment.previewDataUrl}
                  alt="Source"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
                />
              </div>
            ) : (
              <textarea
                ref={sourceRef}
                className="scroll-area"
                value={sourceText}
                onChange={(e) => handleSourceChange(e.target.value)}
                onScroll={handleSourceScroll}
                onPaste={handleSourcePanelPaste}
                placeholder={isDraggingOver ? t.image_translate_upload_hint : t.translate_placeholder}
                style={{
                  flex: 1, width: '100%', background: 'transparent', border: 'none',
                  outline: 'none', resize: 'none', padding: '12px 14px',
                  color: isVoiceInterim ? 'var(--text-secondary)' : 'var(--text-primary)',
                  fontSize: 14, lineHeight: 1.6, fontFamily: 'inherit',
                  fontStyle: isVoiceInterim ? 'italic' : 'normal', transition: 'color 0.15s',
                }}
              />
            )}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <button
                type="button"
                className="btn-icon"
                onClick={() => handleSpeak(sourceText, sourceLangStore, 'source')}
                data-tooltip={speakingPanel === 'source' ? t.translate_speak_stop : t.translate_speak}
                disabled={!sourceText}
              >
                {speakingPanel === 'source' ? <IconStop size={15} /> : <IconSpeaker size={15} />}
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => void handleMicClick()}
                data-tooltip={micIsRecording ? t.voice_stop : micIsProcessing ? t.voice_transcribing : t.voice_record}
                disabled={micIsProcessing}
                style={{ color: micIsRecording ? 'var(--danger)' : undefined, position: 'relative' }}
              >
                {micIsRecording
                  ? <IconStop size={15} />
                  : micIsProcessing
                  ? <span style={{ width: 12, height: 12, border: '2px solid var(--text-tertiary)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  : <IconMic size={15} />
                }
                {micIsRecording && (
                  <span style={{ position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: 'var(--danger)', animation: 'dotBounce 1s ease-in-out infinite' }} />
                )}
              </button>
              <button
                type="button"
                className="btn-icon"
                onClick={() => fileInputRef.current?.click()}
                data-tooltip={t.image_translate_btn}
                style={{ color: imageAttachment ? 'var(--accent)' : undefined }}
              >
                <IconPaperclip size={15} />
              </button>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTranslate}
                disabled={autoTranslate || isTranslating || (!sourceText && !imageAttachment)}
                style={{
                  padding: '6px 16px', fontSize: 12, gap: 6,
                  opacity: autoTranslate ? 0 : 1,
                  pointerEvents: autoTranslate ? 'none' : 'auto',
                  transition: 'opacity 0.18s',
                }}
              >
                {isTranslating ? (
                  <>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    {t.translate_btn_loading}
                  </>
                ) : (
                  <>
                    <IconTranslate size={13} />
                    {t.translate_btn}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Result panel ── */}
          <div className="panel glass" style={{ borderRadius: 16 }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '7px 10px 5px 8px',
              borderBottom: '1px solid var(--glass-border)', flexShrink: 0,
            }}>
              <LanguagePicker langs={targetLangs} selected={targetLang} onChange={setTargetLang} />
              <div style={{ flex: 1 }} />
              {isTranslating && (
                <span style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: '2px solid var(--accent)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              )}
            </div>

            {/* Result text */}
            <div
              ref={resultRef}
              className="scroll-area"
              style={{ flex: 1, padding: '12px 14px', fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', overflowY: 'auto' }}
            >
              {translatedText ? (
                <div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{translatedText}</p>
                  {phoneticText && phoneticMode !== 'off' && (
                    <PhoneticText text={phoneticText} />
                  )}
                </div>
              ) : (
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                  {isTranslating ? t.translate_btn_loading : t.translate_result_placeholder}
                </span>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <button
                type="button"
                className="btn-icon"
                onClick={() => handleSpeak(translatedText, targetLang, 'translated')}
                data-tooltip={speakingPanel === 'translated' ? t.translate_speak_stop : t.translate_speak}
                disabled={!translatedText}
              >
                {speakingPanel === 'translated' ? <IconStop size={15} /> : <IconSpeaker size={15} />}
              </button>
              <div style={{ flex: 1 }} />
              {translatedText && (
                <>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => handleRewrite('translated')}
                    data-tooltip={isRewriting ? t.translate_rewriting : t.translate_rewrite}
                    disabled={!!isRewriting}
                    style={{ color: isRewriting ? 'var(--accent)' : undefined }}
                  >
                    {isRewriting
                      ? <span style={{ width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      : <IconSparkle size={15} />
                    }
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={handleCopy}
                    data-tooltip={copied ? t.translate_copied : t.translate_copy}
                  >
                    {copied ? <IconCheck size={15} style={{ color: 'var(--success)' }} /> : <IconCopy size={15} />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Swap button temporarily removed */}
      </div>
    </div>
  )
}
