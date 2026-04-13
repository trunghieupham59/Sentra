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
 *     • AC hum / room noise     : ~3-6
 *     • Quiet breath / rustling : ~6-10
 *     • Quiet speech            : ~10-20
 *     • Normal speech           : ~20-80
 *
 * Gate 2 — sustained speech requirement:
 *   At least MIN_SPEECH_SAMPLES cumulative samples must exceed the threshold
 *   within a 3-second chunk.  With 80 ms intervals, MIN_SPEECH_SAMPLES=3
 *   ≈ 240 ms of actual speech — permissive enough for short utterances.
 *
 * No blob-size fallback: sending silent audio to Whisper always produces
 * hallucinations.  VAD is the single gate — tune the threshold instead.
 */
const SPEECH_RMS_THRESHOLD = 5    // sensitivity: captures even quiet speech
const MIN_SPEECH_SAMPLES   = 2    // 2 × 80 ms = 160 ms — reacts faster
const VAD_SAMPLE_INTERVAL  = 80   // ms between AnalyserNode samples

/**
 * Software gain applied to the microphone signal before recording and VAD.
 * 1.0 = unity, 2.0 = double amplitude, 3.0 = triple.
 * A value of 2.5 lifts quiet/distant voices above the VAD threshold without
 * over-saturating close/loud speech (Web Audio clips at ±1.0 post-GainNode,
 * but the RMS gate still acts on the amplified waveform, so VAD becomes
 * proportionally more sensitive).
 */
const MIC_GAIN = 2.5

// ── Whisper hallucination filter ──────────────────────────────────────────────
/**
 * Whisper hallucinates stock phrases from its training data (YouTube/podcast
 * transcripts) when given silent or near-silent audio.  This filter rejects
 * those known patterns as a second line of defence after VAD.
 *
 * Covers: English, Japanese, Korean common hallucination phrases, as well as
 * structural indicators (bracketed sounds, lone punctuation, repetitions).
 */
const HALLUCINATION_PATTERNS: RegExp[] = [
  // ── English ──────────────────────────────────────────────────────────────
  /thank(s)? (you )?for watching/i,
  /thank(s)? for (your|the)/i,
  /please (like|subscribe|share|follow)/i,
  /don'?t forget to (like|subscribe|hit|click)/i,
  /subtitles? by/i,
  /transcribed by/i,
  /auto-?generated (caption|subtitle)/i,
  /^[\s.…,\-–—]+$/,                    // lone punctuation / whitespace

  // ── Bracketed / parenthesized sound effects ───────────────────────────────
  /^\s*[\[(（【].*[\]）】]\s*$/,          // e.g. [Music], (拍手), 【BGM】
  /\(music\)/i,
  /\[music\]/i,
  /\[applause\]/i,
  /\[laughter\]/i,
  /\[silence\]/i,
  /\[noise\]/i,
  /\[inaudible\]/i,
  /\[crosstalk\]/i,

  // ── Japanese ─────────────────────────────────────────────────────────────
  /ご視聴ありがとうございました/,
  /ご視聴ありがとう/,
  /チャンネル登録/,
  /高評価.*お願い/,
  /字幕.*提供/,
  /字幕.*作成/,
  /^ありがとうございます[。！]*$/,       // standalone "thank you" (no content)
  /^ありがとう[。！]*$/,
  /^どうもありがとう[。！]*$/,
  /^\(拍手\)$/,
  /^\[拍手\]$/,
  /^\(笑\)$/,
  /^\[笑\]$/,
  /^\(音楽\)$/,
  /^\[音楽\]$/,

  // ── Korean ───────────────────────────────────────────────────────────────
  /시청해\s*주셔서\s*감사합니다/,
  /시청해\s*주신\s*여러분/,
  /구독.*좋아요/,
  /좋아요.*구독/,
  /^감사합니다[.]?$/,                   // standalone "thank you"
  /자막.*제공/,
  /자막.*제작/,
]

/**
 * Returns true when the text is a known hallucination OR structurally invalid:
 *   1. Too short (< 4 chars after trimming)
 *   2. Matches a hallucination pattern
 *   3. Made up of a single character repeated ≥ 4 times (e.g. "aaaa", "。。。。")
 *   4. More than 60% of the text is the same single character (noisy repetition)
 */
function isHallucination(text: string): boolean {
  const t = text.trim()
  if (t.length < 4) return true

  if (HALLUCINATION_PATTERNS.some(p => p.test(t))) return true

  // Detect single-character repetition (e.g. "。。。。。" or "はははは")
  const charFreq = new Map<string, number>()
  for (const ch of t) charFreq.set(ch, (charFreq.get(ch) ?? 0) + 1)
  const maxFreq = Math.max(...charFreq.values())
  if (maxFreq >= 4 && maxFreq / t.length > 0.6) return true

  return false
}

// ── Sentence boundary detection ────────────────────────────────────────────────
function extractCompleteSentences(text: string): { complete: string; pending: string } {
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

// ── Deep link to macOS Screen Recording settings ──────────────────────────────
const SCREEN_RECORDING_PREFS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

// ── Component ─────────────────────────────────────────────────────────────────
export function LiveTranslatePage() {
  const {
    sourceLang, targetLang, selectedProvider, selectedModels, keyStatus,
    setSourceLang, setTargetLang, setActivePage,
  } = useAppStore()
  const t = useT()

  // 'mic'    = microphone only (getUserMedia)
  // 'system' = system audio (getDisplayMedia) + microphone — mixed
  const [audioMode,      setAudioMode]      = useState<'mic' | 'system'>('mic')

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

  const pendingBufferRef     = useRef('')
  const pendingChunkCountRef = useRef(0)
  const recentSentencesRef   = useRef<string[]>([])
  const fullRawForSummaryRef = useRef('')
  const fullTxForSummaryRef  = useRef('')
  const lastChunkTextRef     = useRef('')

  const streamRef      = useRef<MediaStream | null>(null)
  const recorderRef    = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const activeRef      = useRef(false)
  const queueRef       = useRef<Promise<void>>(Promise.resolve())

  const audioCtxRef      = useRef<AudioContext | null>(null)
  const analyserRef      = useRef<AnalyserNode | null>(null)
  const hasSpeechRef     = useRef(false)
  const speechCountRef   = useRef(0)
  const vadTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null)

  const rawEndRef = useRef<HTMLDivElement>(null)
  const txEndRef  = useRef<HTMLDivElement>(null)

  const hasOpenAIKey = keyStatus.openai
  const hasAnyKey    = Object.values(keyStatus).some(Boolean)
  const isMac        = window.api.platform === 'darwin'

  // biome-ignore lint/correctness/useExhaustiveDependencies: rawTranscript.length is the intentional trigger
  useEffect(() => { rawEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [rawTranscript.length])
  // biome-ignore lint/correctness/useExhaustiveDependencies: translation.length is the intentional trigger
  useEffect(() => { txEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [translation.length])

  // ── Core pipeline ───────────────────────────────────────────────────────────
  const processChunk = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size < 1000) return

    const { sourceLang, targetLang, selectedProvider, selectedModels } = paramsRef.current

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

    if (!newText || isHallucination(newText)) return

    // Duplicate / near-duplicate detection
    const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const normNew  = normalise(newText)
    const normLast = normalise(lastChunkTextRef.current)
    if (normLast && (normNew === normLast || normLast.includes(normNew) || normNew.includes(normLast))) return
    lastChunkTextRef.current = newText

    const newBuffer = pendingBufferRef.current ? `${pendingBufferRef.current} ${newText}` : newText

    fullRawForSummaryRef.current = fullRawForSummaryRef.current
      ? `${fullRawForSummaryRef.current} ${newText}`
      : newText
    setRawTranscript(fullRawForSummaryRef.current)

    let { complete, pending } = extractCompleteSentences(newBuffer)

    if (!complete) {
      pendingChunkCountRef.current += 1
      if (pendingChunkCountRef.current >= MAX_PENDING_CHUNKS) {
        complete = newBuffer
        pending  = ''
        pendingChunkCountRef.current = 0
      }
    } else {
      pendingChunkCountRef.current = 0
    }

    pendingBufferRef.current = pending
    if (!complete) return

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
        if (speechCountRef.current >= MIN_SPEECH_SAMPLES) hasSpeechRef.current = true
      }
    }, VAD_SAMPLE_INTERVAL)

    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }

    recorder.onstop = () => {
      if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }

      const hadSpeech = hasSpeechRef.current
      const recMime   = recorder.mimeType || mimeType || 'audio/webm'
      const blob      = new Blob(audioChunksRef.current, { type: recMime })

      if (hadSpeech) {
        queueRef.current = queueRef.current.then(() => processChunk(blob, recMime))
      }

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
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512

      let captureStream: MediaStream

      if (audioMode === 'system') {
        // Request screen share + system audio via getDisplayMedia.
        // On macOS the user MUST check "Share audio" in the screen picker.
        const displayStream = await (navigator.mediaDevices as MediaDevices).getDisplayMedia({
          video: { frameRate: 1 } as MediaTrackConstraints,
          audio: true,
        } as DisplayMediaStreamOptions)

        // Stop video tracks — only need audio
        for (const track of displayStream.getVideoTracks()) track.stop()

        const sysAudioTracks = displayStream.getAudioTracks()

        // Also capture mic so both sides of a conversation are heard
        let micStream: MediaStream | null = null
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        } catch { /* mic optional */ }

        const dest = audioCtx.createMediaStreamDestination()

        if (sysAudioTracks.length > 0) {
          const sysSource = audioCtx.createMediaStreamSource(new MediaStream(sysAudioTracks))
          sysSource.connect(dest)
          sysSource.connect(analyser)
          for (const track of sysAudioTracks) dest.stream.addTrack(track)
        } else {
          setMicError('System audio not available — please check "Share audio" in the screen sharing dialog, then try again.')
          audioCtx.close()
          return
        }

        if (micStream) {
          const micSource = audioCtx.createMediaStreamSource(micStream)
          micSource.connect(dest)
          for (const track of micStream.getTracks()) dest.stream.addTrack(track)
        }

        captureStream = dest.stream
      } else {
        // Mic-only mode:
        // • Request autoGainControl so the OS/browser tries to boost quiet mics.
        // • Then apply an additional software GainNode (MIC_GAIN) so the signal
        //   is amplified before both VAD analysis and Whisper recording.
        // • The boosted stream (from MediaStreamDestination) replaces the raw
        //   mic stream so Whisper receives the louder, clearer audio.
        const rawMicStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,   // hardware/OS-level boost
          },
          video: false,
        })

        const rawSource = audioCtx.createMediaStreamSource(rawMicStream)

        // Software gain boost
        const gainNode = audioCtx.createGain()
        gainNode.gain.value = MIC_GAIN

        // Route: rawSource → gain → analyser (for VAD)
        rawSource.connect(gainNode)
        gainNode.connect(analyser)

        // Route: gain → destination stream (for MediaRecorder / Whisper)
        const micDest = audioCtx.createMediaStreamDestination()
        gainNode.connect(micDest)

        // Keep raw tracks in our stream ref so they are stopped on handleStop
        for (const track of rawMicStream.getTracks()) micDest.stream.addTrack(track)

        captureStream = micDest.stream
      }

      streamRef.current    = captureStream
      audioCtxRef.current  = audioCtx
      analyserRef.current  = analyser
      activeRef.current    = true
      setIsActive(true)
      startChunk()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setMicError(audioMode === 'system'
          ? 'Screen Recording permission denied. Enable it in System Settings → Privacy → Screen Recording.'
          : 'Microphone access denied.')
      } else if (!msg.includes('cancelled') && !msg.includes('AbortError')) {
        setMicError(msg)
      }
    }
  }, [startChunk, audioMode])

  const handleStop = useCallback(() => {
    activeRef.current = false
    setIsActive(false)
    setIsTranscribing(false)
    setIsTranslating(false)

    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }

    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop()
      streamRef.current = null
    }

    try { audioCtxRef.current?.close() } catch {}
    audioCtxRef.current = null
    analyserRef.current = null

    if (fullRawForSummaryRef.current.trim()) setShowSummaryBtn(true)
  }, [])

  const handleClear = useCallback(() => {
    pendingBufferRef.current     = ''
    pendingChunkCountRef.current = 0
    recentSentencesRef.current   = []
    fullRawForSummaryRef.current = ''
    fullTxForSummaryRef.current  = ''
    lastChunkTextRef.current     = ''
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

      {/* Language + audio source toggle + Start/Stop bar */}
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

        {/* Audio source toggle: Mic | System — disabled while recording */}
        <div className="flex-shrink-0 flex items-center rounded-full border border-gray-200 dark:border-gray-700
                        bg-gray-50 dark:bg-gray-800 p-0.5 gap-0.5 select-none">
          <button
            type="button"
            disabled={isActive}
            onClick={() => setAudioMode('mic')}
            title="Microphone only"
            className={[
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
              audioMode === 'mic'
                ? 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
              isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            Mic
          </button>
          <button
            type="button"
            disabled={isActive}
            onClick={() => setAudioMode('system')}
            title="System audio + microphone (requires Screen Recording permission on macOS)"
            className={[
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
              audioMode === 'system'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400',
              isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
            ].join(' ')}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path strokeLinecap="round" d="M8 21h8M12 17v4" />
            </svg>
            System
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

      {/* System audio hint — shown when 'System' mode is selected & not yet recording */}
      {audioMode === 'system' && !isActive && isMac && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2
                        bg-blue-50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/40">
          <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs text-blue-600 dark:text-blue-400 flex-1">
            Cần quyền <strong>Screen Recording</strong> và bật <strong>"Share audio"</strong> trong dialog chia sẻ màn hình.
          </span>
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
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Mở System Settings
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
