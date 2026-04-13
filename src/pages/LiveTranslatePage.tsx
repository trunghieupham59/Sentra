import { useCallback, useEffect, useRef, useState } from 'react'
import { LanguageSelector } from '../components/LanguageSelector'
import { ModelSelector } from '../components/ModelSelector'
import { useAppStore, useT } from '../store/useAppStore'

// ── Constants ──────────────────────────────────────────────────────────────────
const CHUNK_DURATION_MS    = 3000  // record 3-second audio windows

/**
 * STT chunks accumulate into a pending buffer until a sentence boundary is
 * detected (. ! ? 。 ！ ？ etc.).  Only complete sentences are translated —
 * they are then locked and never re-translated.
 *
 * FALLBACK: if MAX_PENDING_CHUNKS STT results arrive with no punctuation
 * (common with Japanese / Whisper), the whole buffer is force-translated so
 * the user is never stuck waiting indefinitely.
 */
const MAX_PENDING_CHUNKS   = 3

/**
 * Number of recently-completed sentences to send as translation CONTEXT.
 * Gives the AI enough background to understand names, terms, and topic flow
 * without growing the prompt indefinitely.
 */
const CONTEXT_SENTENCES    = 2

/**
 * Voice Activity Detection (VAD) — two-gate system:
 *
 * Gate 1 — RMS amplitude threshold:
 *   Web Audio API getByteTimeDomainData() returns 0-255 centered at 128.
 *   RMS of deviation from 128:
 *     • Pure silence            : ~0-3
 *     • AC hum / room noise     : ~3-8
 *     • Quiet breath / rustling : ~8-12
 *     • Quiet speech            : ~12-25
 *     • Normal speech           : ~25-80
 *
 * Gate 2 — sustained speech requirement:
 *   At least MIN_SPEECH_SAMPLES consecutive samples must exceed the threshold.
 *   With 80 ms intervals, MIN_SPEECH_SAMPLES=5 ≈ 400 ms of actual speech.
 *   This eliminates brief noise spikes that fool Gate 1.
 *
 * Both gates must pass before the chunk is sent to Whisper.
 */
const SPEECH_RMS_THRESHOLD = 12   // raised: excludes AC/room noise
const MIN_SPEECH_SAMPLES   = 5    // 5 × 80 ms = 400 ms sustained speech required
const VAD_SAMPLE_INTERVAL  = 80   // ms between AnalyserNode samples

// ── Whisper hallucination filter ──────────────────────────────────────────────
/**
 * Whisper hallucinates stock phrases from its training data (YouTube/podcast
 * transcripts) when given silent or near-silent audio.  This filter rejects
 * those known patterns as a second line of defence after VAD.
 */
const HALLUCINATION_PATTERNS: RegExp[] = [
  /thank(s)? (you )?for watching/i,
  /thank(s)? for (your|the)/i,
  /please (like|subscribe|share|follow)/i,
  /don'?t forget to (like|subscribe|hit|click)/i,
  /\(music\)/i,
  /\[music\]/i,
  /\[applause\]/i,
  /\[laughter\]/i,
  /subtitles? by/i,
  /transcribed by/i,
  /auto-?generated (caption|subtitle)/i,
  // Very short / empty after trim → definitely not real speech
]

function isHallucination(text: string): boolean {
  const t = text.trim()
  if (t.length < 4) return true  // too short to be real speech
  return HALLUCINATION_PATTERNS.some(p => p.test(t))
}

// ── Sentence boundary detection ────────────────────────────────────────────────
/**
 * Split `text` at the last sentence-ending punctuation mark.
 * Returns { complete, pending } where:
 *   complete = everything up to and including the last sentence end
 *   pending  = trailing fragment that hasn't completed yet
 *
 * Handles: English . ! ?  — Japanese 。！？ — ellipsis … — interrobangs ‼ ⁉
 */
function extractCompleteSentences(text: string): { complete: string; pending: string } {
  // Match one or more sentence-ending chars followed by whitespace or end-of-string
  const re = /[.!?。！？‼⁉…]+(?:\s|$)/g
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return { complete: '', pending: text.trim() }
  const last = matches[matches.length - 1]
  const split = (last.index ?? 0) + last[0].length
  return {
    complete: text.slice(0, split).trim(),
    pending:  text.slice(split).trim(),
  }
}

// ── Audio helper ───────────────────────────────────────────────────────────────
function getSupportedMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? ''
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LiveTranslatePage() {
  const {
    sourceLang, targetLang, selectedProvider, selectedModels, keyStatus,
    setSourceLang, setTargetLang, setActivePage,
  } = useAppStore()
  const t = useT()

  const [isActive,       setIsActive]       = useState(false)
  const [rawTranscript,  setRawTranscript]  = useState('')
  const [translation,    setTranslation]    = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isTranslating,  setIsTranslating]  = useState(false)
  const [micError,       setMicError]       = useState<string | null>(null)
  const [copiedRaw,      setCopiedRaw]      = useState(false)
  const [copiedTx,       setCopiedTx]       = useState(false)

  // ── Summary state ──────────────────────────────────────────────────────────
  const [showSummaryBtn,  setShowSummaryBtn]  = useState(false)
  const [summary,         setSummary]         = useState<string | null>(null)
  const [isSummarizing,   setIsSummarizing]   = useState(false)
  const [copiedSummary,   setCopiedSummary]   = useState(false)

  // Stable ref so audio callbacks always read fresh params
  const paramsRef = useRef({ sourceLang, targetLang, selectedProvider, selectedModels })
  useEffect(() => {
    paramsRef.current = { sourceLang, targetLang, selectedProvider, selectedModels }
  }, [sourceLang, targetLang, selectedProvider, selectedModels])

  // Incomplete sentence being accumulated across STT chunks
  const pendingBufferRef     = useRef('')
  // How many chunks have been added to pendingBuffer without a sentence boundary
  const pendingChunkCountRef = useRef(0)
  // Last CONTEXT_SENTENCES complete sentences — sent as reference context for next translation
  const recentSentencesRef   = useRef<string[]>([])
  // Full raw + translated text for the summary (grows forever, never reset)
  const fullRawForSummaryRef = useRef('')
  const fullTxForSummaryRef  = useRef('')

  const streamRef      = useRef<MediaStream | null>(null)
  const recorderRef    = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const activeRef      = useRef(false)
  const queueRef       = useRef<Promise<void>>(Promise.resolve())

  // VAD: Web Audio API refs
  const audioCtxRef      = useRef<AudioContext | null>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const hasSpeechRef     = useRef(false)  // true when MIN_SPEECH_SAMPLES gate passed
  const speechCountRef   = useRef(0)      // consecutive samples above RMS threshold
  const vadTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  const rawEndRef = useRef<HTMLDivElement>(null)
  const txEndRef  = useRef<HTMLDivElement>(null)

  const hasOpenAIKey = keyStatus.openai
  const hasAnyKey    = Object.values(keyStatus).some(Boolean)

  // Auto-scroll panels when text grows
  // biome-ignore lint/correctness/useExhaustiveDependencies: rawTranscript.length is the intentional trigger
  useEffect(() => { rawEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [rawTranscript.length])
  // biome-ignore lint/correctness/useExhaustiveDependencies: translation.length is the intentional trigger
  useEffect(() => { txEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [translation.length])

  // ── Core pipeline ───────────────────────────────────────────────────────────
  const processChunk = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size < 1000) return

    const { sourceLang, targetLang, selectedProvider, selectedModels } = paramsRef.current

    // ── Step 1: STT ────────────────────────────────────────────────────────
    setIsTranscribing(true)
    let newText = ''
    try {
      const buf = await blob.arrayBuffer()
      const stt = await window.api.transcribeAudio({
        audioData: buf,
        mimeType,
        language: sourceLang === 'auto' ? undefined : sourceLang,
      })
      if (stt.success && stt.text?.trim()) newText = stt.text.trim()
    } catch { /* skip */ }
    finally { setIsTranscribing(false) }

    // Reject empty or known Whisper hallucination strings
    if (!newText || isHallucination(newText)) return

    // ── Buffer accumulation ────────────────────────────────────────────────
    const newBuffer = pendingBufferRef.current
      ? `${pendingBufferRef.current} ${newText}`
      : newText

    // Show raw transcript immediately (display = completed + pending)
    fullRawForSummaryRef.current = fullRawForSummaryRef.current
      ? `${fullRawForSummaryRef.current} ${newText}`
      : newText
    setRawTranscript(fullRawForSummaryRef.current)

    // ── Sentence boundary detection ────────────────────────────────────────
    let { complete, pending } = extractCompleteSentences(newBuffer)

    if (!complete) {
      // No sentence boundary yet — check the fallback counter
      pendingChunkCountRef.current += 1
      if (pendingChunkCountRef.current >= MAX_PENDING_CHUNKS) {
        // Too many chunks without punctuation (e.g. Japanese) → force translate
        complete = newBuffer
        pending  = ''
        pendingChunkCountRef.current = 0
      }
    } else {
      pendingChunkCountRef.current = 0
    }

    pendingBufferRef.current = pending

    if (!complete) return // still accumulating — wait for more speech

    // ── Step 2: Translate the completed sentence(s) ────────────────────────
    // Only called when we have a semantically complete unit — never re-translates.
    setIsTranslating(true)
    try {
      const contextText = recentSentencesRef.current.join(' ')
      const sourceText  = contextText
        ? `[Context — for reference only, already translated. Do NOT retranslate]:\n"${contextText}"\n\n[Translate to ${targetLang}]:\n${complete}`
        : complete

      const txResult = await window.api.translate({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        sourceText,
        sourceLang,
        targetLang,
        translationStyle: 'neutral',
        showFurigana: false,
      })

      if (txResult.success && txResult.translatedText) {
        const newTx = txResult.translatedText.trim()
        setTranslation(prev => prev ? `${prev} ${newTx}` : newTx)
        fullTxForSummaryRef.current = fullTxForSummaryRef.current
          ? `${fullTxForSummaryRef.current} ${newTx}`
          : newTx
      }
    } catch { /* keep existing */ }
    finally { setIsTranslating(false) }

    // Update rolling sentence context (for next translation's reference)
    recentSentencesRef.current.push(complete)
    if (recentSentencesRef.current.length > CONTEXT_SENTENCES) recentSentencesRef.current.shift()
  }, [])

  // ── Recorder cycling with VAD ─────────────────────────────────────────────────
  const startChunk = useCallback(() => {
    if (!streamRef.current || !activeRef.current) return
    const mimeType = getSupportedMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)
    } catch {
      recorder = new MediaRecorder(streamRef.current)
    }
    audioChunksRef.current = []
    recorderRef.current = recorder

    // ── VAD: two-gate check every VAD_SAMPLE_INTERVAL ms ──────────────────
    hasSpeechRef.current   = false
    speechCountRef.current = 0
    if (vadTimerRef.current) clearInterval(vadTimerRef.current)
    vadTimerRef.current = setInterval(() => {
      const analyser = analyserRef.current
      if (!analyser) return
      const data = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(data)
      const rms = Math.sqrt(data.reduce((sum, v) => sum + (v - 128) ** 2, 0) / data.length)
      if (rms > SPEECH_RMS_THRESHOLD) {
        speechCountRef.current += 1
        // Gate 2: cumulative across the whole 3s window (NOT consecutive).
        // Natural speech has gaps between words — resetting on silence would
        // prevent the count from ever reaching the threshold.
        if (speechCountRef.current >= MIN_SPEECH_SAMPLES) hasSpeechRef.current = true
      }
      // No reset on silence — count is cumulative total for this chunk
    }, VAD_SAMPLE_INTERVAL)

    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }

    recorder.onstop = () => {
      // Stop VAD sampler
      if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }

      const hadSpeech = hasSpeechRef.current
      const recMime   = recorder.mimeType || mimeType || 'audio/webm'
      const blob      = new Blob(audioChunksRef.current, { type: recMime })

      if (hadSpeech) {
        // Speech detected → send to Whisper + translate
        queueRef.current = queueRef.current.then(() => processChunk(blob, recMime))
      }
      // Silent chunk → skip entirely (prevents Whisper hallucinations)

      // Always start next chunk immediately regardless
      if (activeRef.current) startChunk()
    }

    recorder.start()
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, CHUNK_DURATION_MS)
  }, [processChunk])

  // ── Session start / stop ────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setMicError(null)
    setShowSummaryBtn(false)
    setSummary(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      // ── Set up Web Audio API analyser for VAD ──
      const audioCtx = new AudioContext()
      const source   = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512  // 512 samples for reasonable frequency resolution
      source.connect(analyser)
      audioCtxRef.current  = audioCtx
      analyserRef.current  = analyser

      activeRef.current = true
      setIsActive(true)
      startChunk()
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }, [startChunk])

  const handleStop = useCallback(() => {
    activeRef.current = false
    setIsActive(false)
    setIsTranscribing(false)
    setIsTranslating(false)

    // Stop VAD sampler
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }

    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }

    // Close audio context
    try { audioCtxRef.current?.close() } catch {}
    audioCtxRef.current = null
    analyserRef.current = null

    // Show summarize button if there's content
    if (fullRawForSummaryRef.current.trim()) setShowSummaryBtn(true)
  }, [])

  const handleClear = useCallback(() => {
    pendingBufferRef.current     = ''
    pendingChunkCountRef.current = 0
    recentSentencesRef.current   = []
    fullRawForSummaryRef.current = ''
    fullTxForSummaryRef.current  = ''
    setRawTranscript('')
    setTranslation('')
    setSummary(null)
    setShowSummaryBtn(false)
  }, [])

  // ── AI Summarize ────────────────────────────────────────────────────────────
  const handleSummarize = useCallback(async () => {
    const raw = fullRawForSummaryRef.current
    const tx  = fullTxForSummaryRef.current
    if (!raw) return

    setIsSummarizing(true)
    setSummary(null)

    const { targetLang, selectedProvider, selectedModels } = paramsRef.current

    try {
      const result = await window.api.chat({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        systemPrompt: `You are a professional meeting summarizer. Write clear, concise summaries in ${targetLang} using bullet points.`,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              `Summarize the following live meeting transcript in ${targetLang}.`,
              'Include: key topics, important decisions, and action items (if any).',
              'Be concise. Use bullet points.',
              '',
              '[Original Speech]:',
              raw,
              '',
              '[Translation]:',
              tx,
            ].join('\n'),
          }],
        }],
      })

      if (result.success && result.reply) setSummary(result.reply)
    } catch { /* ignore */ }
    finally { setIsSummarizing(false) }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false
      if (vadTimerRef.current) clearInterval(vadTimerRef.current)
      try { audioCtxRef.current?.close() } catch {}
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop()
      }
    }
  }, [])

  const handleCopy = async (text: string, setFlag: (v: boolean) => void) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setFlag(true)
    setTimeout(() => setFlag(false), 1500)
  }

  const wordCount = rawTranscript
    ? rawTranscript.replace(/· · ·/g, '').split(/\s+/).filter(Boolean).length
    : 0

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1 min-w-0 overflow-hidden"><ModelSelector /></div>
      </div>

      {/* Language + Start/Stop bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5
                      bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="flex-1">
          <LanguageSelector value={sourceLang} onChange={setSourceLang} includeAuto />
        </div>
        <svg className="flex-shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="flex-1">
          <LanguageSelector value={targetLang} onChange={setTargetLang} includeAuto={false} />
        </div>
        <button
          type="button"
          onClick={isActive ? handleStop : handleStart}
          disabled={!hasOpenAIKey || !hasAnyKey}
          className={[
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold flex-shrink-0 transition-all duration-200 select-none',
            isActive
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-red-900/50 cursor-pointer'
              : (!hasOpenAIKey || !hasAnyKey)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/50 cursor-pointer',
          ].join(' ')}
        >
          {isActive ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
              </svg>
              {t.live_stop}
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
              </svg>
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
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              STT…
            </span>
          )}
          {isTranslating && !isTranscribing && (
            <span className="text-xs text-blue-400 flex items-center gap-1 ml-2">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
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
        <div className="flex-1 basis-0 flex flex-col min-w-0 bg-blue-50/30 dark:bg-blue-950/5">
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
                  <svg className="inline w-3 h-3 animate-spin ml-1 text-blue-300 dark:text-blue-700 align-middle" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
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
          {/* Summary header + button */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
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
                           transition-all duration-200 shadow-sm shadow-purple-200 dark:shadow-purple-900/50 flex-shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {summary ? t.live_summarize_again : t.live_summarize}
              </button>
            )}
          </div>

          {/* Summary content */}
          {(summary || isSummarizing) && (
            <div className="px-4 pb-4 max-h-44 overflow-y-auto">
              {isSummarizing ? (
                <div className="flex items-center gap-2 text-sm text-purple-400 dark:text-purple-600">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t.live_summarizing}
                </div>
              ) : summary ? (
                <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed whitespace-pre-wrap">
                  {summary}
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 h-11
                      border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        {/* Clear button — left side, with trash icon, red hover so it's easy to find */}
        {rawTranscript && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                       text-gray-500 hover:text-red-500 hover:bg-red-50
                       dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-950/30
                       transition-colors duration-150 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t.live_clear}
          </button>
        )}
        {/* Word count — pushed to the right */}
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
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{children}</span>
    </div>
  )
}

function EmptyPanel({ children, icon }: { children: React.ReactNode; icon: 'mic' | 'translate' }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200
                      dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
        {icon === 'mic' ? (
          <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" />
            <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-blue-300 dark:text-blue-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-600 text-center max-w-[160px]">{children}</p>
    </div>
  )
}
