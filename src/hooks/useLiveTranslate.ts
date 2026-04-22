/**
 * useLiveTranslate — encapsulates all business logic for the Live Translate pipeline.
 *
 * Extracted from LiveTranslatePage to separate concerns:
 *  - Audio capture (mic / system) & VAD (Voice Activity Detection, three-gate)
 *  - STT → Whisper confidence gates → hallucination filters
 *  - Translation pipeline with sentence-boundary buffering + context
 *  - Subtitle overlay IPC integration
 *  - AI summarization
 *  - Session auto-save to history
 *
 * The page component owns only UI-copy state (`copiedRaw`, `copiedTx`,
 * `copiedSummary`) and pure render logic.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupportedAudioMimeType } from '../constants/audio'
import { useAppStore } from '../store/useAppStore'
import type { SubtitleSettings } from '../types'
import { extractCompleteSentences, isHallucination, jaccardSimilarity } from '../utils/live-translate'

// ── Constants ──────────────────────────────────────────────────────────────────
const CHUNK_DURATION_MS    = 3000  // record 3-second audio windows — Whisper quality degrades below 3 s

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
 * Voice Activity Detection (VAD) — three-gate system:
 *
 * Gate 1 — RMS amplitude threshold (sustained):
 *   Web Audio API getByteTimeDomainData() returns 0-255 centered at 128.
 *   RMS of deviation from 128:
 *     • Pure silence            : ~0-3
 *     • AC hum / room noise     : ~3-6
 *     • Quiet breath / rustling : ~6-10
 *     • Quiet speech            : ~10-20
 *     • Normal speech           : ~20-80
 *
 * Gate 2 — sustained speech requirement:
 *   At least MIN_SPEECH_SAMPLES cumulative samples must exceed SPEECH_RMS_THRESHOLD
 *   within a 3-second chunk.  With 80 ms intervals, MIN_SPEECH_SAMPLES=4
 *   ≈ 320 ms of sustained audio — filters transient pops/clicks.
 *
 * Gate 3 — peak RMS confirmation:
 *   The highest single-sample RMS in the chunk must exceed PEAK_RMS_THRESHOLD.
 *   This rules out AC hum (steady low-amplitude noise) that could accumulate
 *   enough samples to pass Gate 2 while never reaching speech levels.
 *
 * No blob-size fallback: sending silent audio to Whisper always produces
 * hallucinations.  VAD is the primary gate — tune the thresholds instead.
 */
const SPEECH_RMS_THRESHOLD = 4    // sustained sensitivity — lowered to catch quieter/distant speech
const PEAK_RMS_THRESHOLD   = 8    // peak gate: lowered so quiet mics still pass
const MIN_SPEECH_SAMPLES   = 2    // 2 × 80 ms = 160 ms minimum — faster detection, less dropout
const VAD_SAMPLE_INTERVAL  = 80   // ms between AnalyserNode samples

/**
 * Upper bound on words Whisper may return for a single CHUNK_DURATION_MS chunk.
 * Human speech tops out at ~5 words/second; 3 s × 5 × 2.5 safety margin = 37.
 * Outputs exceeding this are overwhelmingly drift/hallucination ("output more
 * than the audio contains") and are discarded.
 */
const MAX_WORDS_PER_CHUNK  = 40

/**
 * Upper bound on word-per-second rate within a chunk.
 * Very fast speech peaks at ~5 words/sec; 7 is a generous safety margin.
 * If Whisper returns more words per second than this, the output almost
 * certainly contains fabricated content not present in the audio.
 */
const MAX_WORDS_PER_SEC    = 10   // raised — Japanese/fast speakers produce more tokens/sec

/**
 * Number of consecutive silent chunks (chunks where VAD found no speech)
 * after which the session context is fully reset.
 *
 * At CHUNK_DURATION_MS=3000 ms, 5 chunks ≈ 15 seconds of silence.
 * After a pause this long, the previous transcript is stale context that
 * may cause the decoder to continue a sentence that no longer exists.
 * Resetting prevents "context-conditioned hallucination drift".
 */
const SILENCE_RESET_CHUNKS = 5

/**
 * Whisper confidence gate thresholds (from verbose_json segment signals).
 *
 *   NO_SPEECH_PROB_MAX   : Whisper's own estimate that no speech is present.
 *                          0.65 means "model is ≥65% sure this is silence".
 *   AVG_LOGPROB_MIN      : Average log-probability of generated tokens.
 *                          Below −1.0 the model is not confident in any token.
 *   COMPRESSION_RATIO_MAX: Ratio of raw bytes to compressed bytes for the text.
 *                          High values indicate repetitive or anomalous output.
 */
const NO_SPEECH_PROB_MAX    = 0.75   // raised — accept chunks unless Whisper is very sure it's silence
const AVG_LOGPROB_MIN       = -1.4   // lowered — accept lower-confidence transcriptions
const COMPRESSION_RATIO_MAX = 2.8    // raised — allow slightly more repetitive output

/**
 * Software gain applied to the microphone signal before recording and VAD.
 * 1.0 = unity, 2.0 = double amplitude, 3.0 = triple.
 * A value of 2.5 lifts quiet/distant voices above the VAD threshold without
 * over-saturating close/loud speech (Web Audio clips at ±1.0 post-GainNode,
 * but the RMS gate still acts on the amplified waveform, so VAD becomes
 * proportionally more sensitive).
 */
const MIC_GAIN = 4.0   // raised — captures quiet/distant speakers; Web Audio clips at ±1.0 so headroom is safe

/**
 * Maximum number of characters to retain in the raw transcript ref for
 * long-running sessions. Keeping the last 50,000 chars (~10-15 minutes of speech)
 * is more than sufficient for AI summarization while preventing unbounded memory growth.
 */
const MAX_RAW_TRANSCRIPT_CHARS = 50_000

/**
 * Maximum age (ms) a queued audio chunk may wait before being discarded.
 * If the processing queue falls behind (e.g. slow API), chunks older than
 * this threshold are dropped to prevent latency stacking — the live
 * translation stays near real-time even under heavy load.
 */
const CHUNK_MAX_QUEUE_AGE_MS = 10_000 // 10 s


/**
 * A single translated segment with speaker label.
 * Segments are built in real-time as speech is transcribed + translated.
 * Speaker labels are inferred from silence pauses between speakers (VAD-based diarization).
 */
export interface LiveSegment {
  id: string
  rawText: string
  translation: string
  speaker: string    // e.g. 'Speaker 1', 'Speaker 2'
  timestamp: number
}

/** Minimum silent chunks before considering a speaker change (1 chunk = 2 s). */
const MIN_SILENCE_FOR_SPEAKER_CHANGE = 1
/** Minimum ms between speaker changes — prevents rapid toggling. */
const MIN_SPEAKER_DURATION_MS = 4_000

/** Default subtitle appearance settings — also used by reset button in LiveTranslatePage */
export const DEFAULT_SUBTITLE_SETTINGS = {
  textColor: '#ffffff',
  fontSize:  18,
  bgOpacity: 84,
} as const satisfies SubtitleSettings

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveTranslate() {
  const {
    sourceLang, targetLang, selectedProvider, selectedModels, keyStatus,
    addLiveSession, updateLiveSession,
    viewingLiveSessionId, liveSessions, setViewingLiveSession,
  } = useAppStore()

  // 'mic'    = microphone only (getUserMedia)
  // 'system' = system audio only (getDisplayMedia), no microphone
  // 'both'   = system audio (getDisplayMedia) + microphone — mixed
  const [audioMode,      setAudioMode]      = useState<'mic' | 'system' | 'both'>('mic')

  // macOS Screen Recording permission: null = not checked yet
  const [screenPermission, setScreenPermission] = useState<string | null>(null)

  const [isActive,       setIsActive]       = useState(false)
  const [rawTranscript,  setRawTranscript]  = useState('')
  const [translation,    setTranslation]    = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isTranslating,  setIsTranslating]  = useState(false)
  const [micError,       setMicError]       = useState<string | null>(null)
  const [pipelineError,  setPipelineError]  = useState<string | null>(null)

  // ── Subtitle overlay state ─────────────────────────────────────────────────
  const [showSubtitles,      setShowSubtitles]      = useState(false)
  const [latestSubtitle,     setLatestSubtitle]     = useState('')
  const [showSubtitleConfig, setShowSubtitleConfig] = useState(false)
  const [subtitleSettings,   setSubtitleSettings]   = useState<SubtitleSettings>({ ...DEFAULT_SUBTITLE_SETTINGS })
  // Ref so processChunk (a stable useCallback) can read current subtitle state
  const showSubtitlesRef = useRef(false)
  useEffect(() => { showSubtitlesRef.current = showSubtitles }, [showSubtitles])

  // ── Realtime segments (speaker-labeled transcript) ─────────────────────────
  const [segments,    setSegments]    = useState<LiveSegment[]>([])
  // Interim text: accumulated but not yet sentence-complete (shown in gray)
  const [pendingText, setPendingText] = useState('')

  // Speaker tracking refs — stable refs readable in processChunk useCallback
  const currentSpeakerRef        = useRef('Speaker 1')
  const speakerCountRef          = useRef(1)
  const silenceBeforeChunkRef    = useRef(0)   // silent chunks captured before last speech chunk
  const lastSpeakerChangeTimeRef = useRef(0)

  // ── Summary + Speaker analysis state ──────────────────────────────────────
  const [showSummaryBtn,       setShowSummaryBtn]       = useState(false)
  const [summary,              setSummary]              = useState<string | null>(null)
  const [isSummarizing,        setIsSummarizing]        = useState(false)
  const [speakerAnalysis,      setSpeakerAnalysis]      = useState<string | null>(null)
  const [isAnalyzingSpeakers,  setIsAnalyzingSpeakers]  = useState(false)

  // ── Action Items + Decisions state ────────────────────────────────────────
  const [actionItems,             setActionItems]             = useState<string | null>(null)
  const [decisions,               setDecisions]               = useState<string | null>(null)
  const [isExtractingActionItems, setIsExtractingActionItems] = useState(false)
  const [isExtractingDecisions,   setIsExtractingDecisions]   = useState(false)

  // ── Speaker name map + session start time ─────────────────────────────────
  /** Maps original speaker labels (e.g. 'Speaker 1') to user-assigned names */
  const [speakerNameMap,   setSpeakerNameMap]   = useState<Record<string, string>>({})
  const [sessionStartTime, setSessionStartTime] = useState<number>(0)

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

  const audioCtxRef        = useRef<AudioContext | null>(null)
  const analyserRef        = useRef<AnalyserNode | null>(null)
  const hasSpeechRef       = useRef(false)
  const speechCountRef     = useRef(0)
  const vadTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  // Counts consecutive chunks where VAD detected no speech.
  // When it hits SILENCE_RESET_CHUNKS, the decoder context is wiped so stale
  // transcript from before a long pause cannot bias the next decode cycle.
  const silentChunkCountRef = useRef(0)

  // Timer ref for auto-clearing pipelineError — avoids stale closures in processChunk
  const pipelineErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rawEndRef        = useRef<HTMLDivElement>(null)
  const txEndRef         = useRef<HTMLDivElement>(null)
  const sessionIdRef     = useRef<string | null>(null)
  const sessionStartRef  = useRef<number>(0)
  // Mirror refs for segments + speakerNameMap — readable from stable useCallbacks
  const segmentsRef       = useRef<LiveSegment[]>([])
  const speakerNameMapRef = useRef<Record<string, string>>({})

  const hasOpenAIKey = keyStatus.openai
  const hasAnyKey    = Object.values(keyStatus).some(Boolean)
  const isMac        = window.api.platform === 'darwin'

  // ── Check Screen Recording permission ────────────────────────────────────────
  const checkScreenPermission = useCallback(async () => {
    if (!isMac) { setScreenPermission('granted'); return }
    try {
      const status = await window.api.checkScreenPermission()
      setScreenPermission(status)
    } catch {
      setScreenPermission('unknown')
    }
  }, [isMac])

  // Check permission when switching to system / both mode, and re-check when window regains focus
  useEffect(() => {
    if (audioMode === 'system' || audioMode === 'both') {
      checkScreenPermission()
    }
  }, [audioMode, checkScreenPermission])

  useEffect(() => {
    if ((audioMode !== 'system' && audioMode !== 'both') || !isMac) return
    const onFocus = () => checkScreenPermission()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [audioMode, isMac, checkScreenPermission])

  // Keep mirror refs in sync for stable useCallback access
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref assignment never needs to retrigger
  useEffect(() => { segmentsRef.current = segments }, [segments])
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref assignment never needs to retrigger
  useEffect(() => { speakerNameMapRef.current = speakerNameMap }, [speakerNameMap])

  // biome-ignore lint/correctness/useExhaustiveDependencies: rawTranscript.length is the intentional trigger
  useEffect(() => { rawEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [rawTranscript.length])
  // biome-ignore lint/correctness/useExhaustiveDependencies: translation.length is the intentional trigger
  useEffect(() => { txEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [translation.length])

  // ── Restore historical session when navigating from history ───────────────
  // When the user clicks "Xem" on a live history item, viewingLiveSessionId is
  // set in the store before navigating here.  This effect detects that change,
  // finds the matching session, and pre-populates the UI state so the user can
  // read the transcript, translation, and summary without starting a new recording.
  // biome-ignore lint/correctness/useExhaustiveDependencies: liveSessions intentionally omitted — only re-run when the target session ID changes
  useEffect(() => {
    if (!viewingLiveSessionId) return
    const session = liveSessions.find((s) => s.id === viewingLiveSessionId)
    if (!session) return

    setRawTranscript(session.rawTranscript)
    setTranslation(session.translation)
    setSummary(session.summary ?? null)
    setSpeakerAnalysis(session.speakerAnalysis ?? null)
    setActionItems(session.actionItems ?? null)
    setDecisions(session.decisions ?? null)
    setSpeakerNameMap(session.speakerNameMap ?? {})
    if (session.segments?.length) setSegments(session.segments)
    setShowSummaryBtn(!!session.rawTranscript)
    fullRawForSummaryRef.current = session.rawTranscript
    fullTxForSummaryRef.current  = session.translation
    sessionIdRef.current         = session.id
  }, [viewingLiveSessionId])

  // ── Core pipeline ───────────────────────────────────────────────────────────
  const processChunk = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size < 1000) return

    const { sourceLang, targetLang, selectedProvider, selectedModels } = paramsRef.current

    // ── STT call — keep reference to full result for confidence gate ──────
    setIsTranscribing(true)
    let stt: Awaited<ReturnType<typeof window.api.transcribeAudio>> | null = null
    try {
      const buf = await blob.arrayBuffer()
      stt = await window.api.transcribeAudio({
        audioData: buf,
        mimeType,
        language: sourceLang === 'auto' ? undefined : sourceLang,
      })
    } catch {
      setPipelineError('STT failed — retrying next chunk')
      if (pipelineErrorTimerRef.current) clearTimeout(pipelineErrorTimerRef.current)
      pipelineErrorTimerRef.current = setTimeout(() => setPipelineError(null), 4000)
    }
    finally { setIsTranscribing(false) }

    const newText = stt?.success && stt.text?.trim() ? stt.text.trim() : ''
    if (!newText || isHallucination(newText)) return

    // ── Whisper confidence gate (verbose_json segment signals) ────────────
    // These are Whisper's own internal estimates returned via verbose_json.
    // They are the most reliable hallucination indicators available from
    // the OpenAI API and should be treated as mandatory gates.
    //
    //  noSpeechProb    > NO_SPEECH_PROB_MAX    → model is ≥65% sure no speech
    //  avgLogprob      < AVG_LOGPROB_MIN       → model is not confident in tokens
    //  compressionRatio > COMPRESSION_RATIO_MAX → output is anomalously repetitive
    if (typeof stt?.noSpeechProb === 'number'    && stt.noSpeechProb    > NO_SPEECH_PROB_MAX)    return
    if (typeof stt?.avgLogprob === 'number'      && stt.avgLogprob      < AVG_LOGPROB_MIN)       return
    if (typeof stt?.compressionRatio === 'number' && stt.compressionRatio > COMPRESSION_RATIO_MAX) return

    // ── Max-words-per-chunk guard ─────────────────────────────────────────
    const wordCountGuard = newText.split(/\s+/).filter(Boolean).length
    if (wordCountGuard > MAX_WORDS_PER_CHUNK) return

    // ── Words-per-second rate guard ───────────────────────────────────────
    const wordsPerSec = wordCountGuard / (CHUNK_DURATION_MS / 1000)
    if (wordsPerSec > MAX_WORDS_PER_SEC) return

    // ── Duplicate / near-duplicate detection (enhanced) ───────────────────
    // 1. Exact / substring match (fast path)
    // 2. Jaccard similarity on word bags (catches paraphrase duplicates)
    const normalise = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const normNew  = normalise(newText)
    const normLast = normalise(lastChunkTextRef.current)
    if (normLast && (
      normNew === normLast ||
      normLast.includes(normNew) ||
      normNew.includes(normLast) ||
      jaccardSimilarity(normNew, normLast) > 0.92   // raised — less aggressive dedup, fewer dropped chunks
    )) return
    lastChunkTextRef.current = newText

    const newBuffer = pendingBufferRef.current ? `${pendingBufferRef.current} ${newText}` : newText

    // ── Show interim (gray) text immediately after each STT chunk ─────────
    // This updates the UI before sentence extraction, making the transcript
    // feel "live" — text appears in gray as Whisper returns each chunk,
    // then turns solid white/dark once the sentence is finalized & translated.
    setPendingText(newBuffer)

    // Append new text and trim to MAX_RAW_TRANSCRIPT_CHARS to prevent unbounded growth
    // for very long sessions (hours). The last N chars are kept — sufficient for summarization.
    const updatedRaw = fullRawForSummaryRef.current
      ? `${fullRawForSummaryRef.current} ${newText}`
      : newText
    fullRawForSummaryRef.current = updatedRaw.length > MAX_RAW_TRANSCRIPT_CHARS
      ? updatedRaw.slice(-MAX_RAW_TRANSCRIPT_CHARS)
      : updatedRaw
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

    // Sentence is complete — update interim to show only the remaining pending part
    setPendingText(pending)

    // ── VAD-based speaker detection ───────────────────────────────────────
    // When speech resumes after a pause (silence captured in silenceBeforeChunkRef),
    // and enough time has passed since the last speaker change, increment the speaker.
    const silenceBefore = silenceBeforeChunkRef.current
    silenceBeforeChunkRef.current = 0  // consume once
    if (
      silenceBefore >= MIN_SILENCE_FOR_SPEAKER_CHANGE &&
      Date.now() - lastSpeakerChangeTimeRef.current > MIN_SPEAKER_DURATION_MS
    ) {
      speakerCountRef.current++
      currentSpeakerRef.current      = `Speaker ${speakerCountRef.current}`
      lastSpeakerChangeTimeRef.current = Date.now()
    }
    const currentSpeaker = currentSpeakerRef.current

    setIsTranslating(true)
    try {
      const contextText = recentSentencesRef.current.join(' ')
      const sourceText  = contextText
        ? `[Context — for reference only, already translated. Do NOT retranslate]:\n"${contextText}"\n\n[Translate to ${targetLang}]:\n${complete}`
        : complete

      const batchParams = {
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        sourceText,
        sourceLang,
        targetLang,
        translationStyle: 'neutral' as const,
        showFurigana: false,
      }

      let txResult: { success: boolean; translatedText?: string }
      let usedStreaming = false

      if (showSubtitlesRef.current) {
        // Subtitle active → try streaming first; each token is pushed directly
        // to the subtitle window by the main process in real-time.
        try {
          txResult = await window.api.translateStream({
            provider: selectedProvider,
            model: selectedModels[selectedProvider],
            sourceText,
            sourceLang,
            targetLang,
            translationStyle: 'neutral',
          })
          usedStreaming = txResult.success
        } catch {
          // Streaming unavailable or failed — fall through to batch
          txResult = { success: false }
        }

        // Fall back to batch translate if streaming failed
        if (!txResult.success) {
          txResult = await window.api.translate(batchParams)
        }
      } else {
        txResult = await window.api.translate(batchParams)
      }

      if (txResult.success && txResult.translatedText) {
        const newTx = txResult.translatedText.trim()
        setTranslation(prev => prev ? `${prev} ${newTx}` : newTx)
        // Update subtitle via non-streaming fallback path only
        // (streaming already sent tokens to the subtitle window directly)
        if (!usedStreaming) setLatestSubtitle(newTx)
        fullTxForSummaryRef.current = fullTxForSummaryRef.current
          ? `${fullTxForSummaryRef.current} ${newTx}`
          : newTx
        // Push realtime segment with speaker label
        setSegments(prev => [...prev, {
          id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
          rawText: complete,
          translation: newTx,
          speaker: currentSpeaker,
          timestamp: Date.now(),
        }])
      }
    } catch {
      setPipelineError('Translation failed — will retry')
      if (pipelineErrorTimerRef.current) clearTimeout(pipelineErrorTimerRef.current)
      pipelineErrorTimerRef.current = setTimeout(() => setPipelineError(null), 4000)
    }
    finally { setIsTranslating(false) }

    recentSentencesRef.current.push(complete)
    if (recentSentencesRef.current.length > CONTEXT_SENTENCES) recentSentencesRef.current.shift()
  }, [])

  // ── Recorder cycling with VAD ─────────────────────────────────────────────────
  const startChunk = useCallback(() => {
    if (!streamRef.current || !activeRef.current) return
    // Use the shared audio MIME type helper from constants/audio — single source of truth
    const mimeType = getSupportedAudioMimeType()
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
    // Peak RMS tracker for Gate 3 — reset each chunk
    let chunkPeakRms = 0
    if (vadTimerRef.current) clearInterval(vadTimerRef.current)
    vadTimerRef.current = setInterval(() => {
      const analyser = analyserRef.current
      if (!analyser) return
      const data = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(data)
      const rms = Math.sqrt(data.reduce((sum, v) => sum + (v - 128) ** 2, 0) / data.length)
      if (rms > chunkPeakRms) chunkPeakRms = rms
      if (rms > SPEECH_RMS_THRESHOLD) {
        speechCountRef.current += 1
        // Gate 2 + Gate 3: must have enough sustained samples AND at least one
        // sample above the peak threshold to confirm real speech (not AC hum).
        if (speechCountRef.current >= MIN_SPEECH_SAMPLES && chunkPeakRms >= PEAK_RMS_THRESHOLD) {
          hasSpeechRef.current = true
        }
      }
    }, VAD_SAMPLE_INTERVAL)

    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }

    recorder.onstop = () => {
      if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }

      const hadSpeech = hasSpeechRef.current
      const recMime   = recorder.mimeType || mimeType || 'audio/webm'
      const blob      = new Blob(audioChunksRef.current, { type: recMime })

      if (hadSpeech) {
        // Capture silence count before reset — used by processChunk for speaker detection
        if (silentChunkCountRef.current > 0) {
          silenceBeforeChunkRef.current = silentChunkCountRef.current
        }
        // Speech detected — reset silence counter and queue the chunk.
        // Capture the enqueue timestamp so stale chunks can be discarded if the
        // queue falls behind — prevents latency stacking during slow API responses.
        silentChunkCountRef.current = 0
        const queuedAt = Date.now()
        queueRef.current = queueRef.current.then(async () => {
          if (Date.now() - queuedAt > CHUNK_MAX_QUEUE_AGE_MS) return // discard stale chunk
          await processChunk(blob, recMime)
        })
      } else {
        // No speech — increment counter; reset decoder context on long silence
        silentChunkCountRef.current += 1
        if (silentChunkCountRef.current >= SILENCE_RESET_CHUNKS) {
          // ≥15 s of consecutive silence: wipe all context so the next
          // decode cycle starts fresh and can't drift on stale text.
          silentChunkCountRef.current  = 0
          lastChunkTextRef.current     = ''
          pendingBufferRef.current     = ''
          pendingChunkCountRef.current = 0
          recentSentencesRef.current   = []
        }
      }

      if (activeRef.current) startChunk()
    }

    recorder.start()
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, CHUNK_DURATION_MS)
  }, [processChunk])

  // ── Session start / stop ────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    // Clear any historical session being viewed — start fresh
    setViewingLiveSession(null)
    setRawTranscript('')
    setTranslation('')
    pendingBufferRef.current     = ''
    pendingChunkCountRef.current = 0
    recentSentencesRef.current   = []
    fullRawForSummaryRef.current = ''
    fullTxForSummaryRef.current  = ''
    lastChunkTextRef.current     = ''

    setMicError(null)
    setShowSummaryBtn(false)
    setSummary(null)
    setSpeakerAnalysis(null)
    setIsAnalyzingSpeakers(false)
    setActionItems(null)
    setDecisions(null)
    setIsExtractingActionItems(false)
    setIsExtractingDecisions(false)
    setSpeakerNameMap({})
    setSegments([])
    setPendingText('')
    currentSpeakerRef.current        = 'Speaker 1'
    speakerCountRef.current          = 1
    silenceBeforeChunkRef.current    = 0
    lastSpeakerChangeTimeRef.current = 0
    const now = Date.now()
    sessionIdRef.current    = `live-${now}-${Math.random().toString(36).slice(2, 8)}`
    sessionStartRef.current = now
    setSessionStartTime(now)

    try {
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512

      let captureStream: MediaStream

      if (audioMode === 'system' || audioMode === 'both') {
        // Request screen share + system audio via getDisplayMedia.
        // On macOS the user MUST check "Share audio" in the screen picker.
        // Note: Electron's setDisplayMediaRequestHandler overrides the source,
        // so we keep video constraints minimal (just `true`) to avoid
        // "Invalid capture constraints" errors from Chromium's constraint validator.
        const displayStream = await (navigator.mediaDevices as MediaDevices).getDisplayMedia({
          video: true,
          audio: true,
        } as DisplayMediaStreamOptions)

        // Stop video tracks — only need audio
        for (const track of displayStream.getVideoTracks()) track.stop()

        const sysAudioTracks = displayStream.getAudioTracks()

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

        // 'both' mode: also mix in microphone so both speakers are captured
        if (audioMode === 'both') {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            const micSource = audioCtx.createMediaStreamSource(micStream)
            micSource.connect(dest)
            for (const track of micStream.getTracks()) dest.stream.addTrack(track)
          } catch { /* mic optional in both mode */ }
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
  }, [startChunk, audioMode, setViewingLiveSession])

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

    const raw = fullRawForSummaryRef.current.trim()
    if (raw) {
      setShowSummaryBtn(true)
      // Auto-save session to history
      const wc = raw.replace(/· · ·/g, '').split(/\s+/).filter(Boolean).length
      const { sourceLang, targetLang, selectedProvider, selectedModels } = paramsRef.current
      if (sessionIdRef.current) {
        addLiveSession({
          id: sessionIdRef.current,
          createdAt: sessionStartRef.current,
          sourceLang,
          targetLang,
          provider: selectedProvider,
          model: selectedModels[selectedProvider],
          rawTranscript: raw,
          translation: fullTxForSummaryRef.current.trim(),
          wordCount: wc,
          segments: segmentsRef.current,
          speakerNameMap: Object.keys(speakerNameMapRef.current).length > 0
            ? speakerNameMapRef.current
            : undefined,
        })
      }
    }
  }, [addLiveSession])

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
    setSpeakerAnalysis(null)
    setIsAnalyzingSpeakers(false)
    setActionItems(null)
    setDecisions(null)
    setIsExtractingActionItems(false)
    setIsExtractingDecisions(false)
    setSpeakerNameMap({})
    setSegments([])
    setPendingText('')
    currentSpeakerRef.current        = 'Speaker 1'
    speakerCountRef.current          = 1
    silenceBeforeChunkRef.current    = 0
    lastSpeakerChangeTimeRef.current = 0
  }, [])

  // ── AI Summarize ────────────────────────────────────────────────────────────
  /**
   * Maximum characters sent to the AI for summarization.
   * Keeps the last N chars of each section (most recent & relevant content).
   * Avoids token-limit errors on long sessions while giving the model enough context.
   */
  const MAX_SUMMARIZE_SECTION_CHARS = 10_000

  const handleSummarize = useCallback(async () => {
    let raw = fullRawForSummaryRef.current
    let tx  = fullTxForSummaryRef.current
    if (!raw) return

    setIsSummarizing(true)
    setSummary(null)

    const { targetLang, selectedProvider, selectedModels } = paramsRef.current

    // Truncate each section to the last N chars so the AI receives the most recent,
    // relevant content without exceeding model context / cost limits.
    const wasTruncated = raw.length > MAX_SUMMARIZE_SECTION_CHARS || tx.length > MAX_SUMMARIZE_SECTION_CHARS
    if (raw.length > MAX_SUMMARIZE_SECTION_CHARS) {
      raw = `[…truncated for length]\n${raw.slice(-MAX_SUMMARIZE_SECTION_CHARS)}`
    }
    if (tx.length > MAX_SUMMARIZE_SECTION_CHARS) {
      tx = `[…truncated for length]\n${tx.slice(-MAX_SUMMARIZE_SECTION_CHARS)}`
    }
    if (wasTruncated) {
      console.log('[summarize] Input truncated to last', MAX_SUMMARIZE_SECTION_CHARS, 'chars per section')
    }

    try {
      const result = await window.api.chat({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        // Bypass the chat UI 3k-char limit — summarize needs to send full transcripts.
        bypassLengthCheck: true,
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

      if (result.success && result.reply) {
        setSummary(result.reply)
        if (sessionIdRef.current) {
          updateLiveSession(sessionIdRef.current, { summary: result.reply })
        }
      } else {
        // Surface backend errors instead of silently failing
        const errMsg = result.error ?? 'Summarization failed. Please try again.'
        console.error('[summarize] Backend error:', errMsg)
        setSummary(`❌ ${errMsg}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[summarize] Exception:', msg)
      setSummary(`❌ ${msg}`)
    } finally {
      setIsSummarizing(false)
    }
  }, [updateLiveSession])

  // ── AI Speaker Analysis ─────────────────────────────────────────────────────
  /**
   * Post-session speaker diarization via LLM.
   * Sends the transcript to the AI which labels each speaking turn as
   * [Speaker 1], [Speaker 2], etc. based on conversation patterns.
   * Follows the approach recommended in docs/tts.md: LLM-based analysis
   * is practical for turn-taking meetings (people speaking in turns).
   */
  const handleAnalyzeSpeakers = useCallback(async () => {
    let raw = fullRawForSummaryRef.current
    if (!raw) return

    setIsAnalyzingSpeakers(true)
    setSpeakerAnalysis(null)

    const { targetLang, selectedProvider, selectedModels } = paramsRef.current

    // Truncate to prevent token limit errors
    const MAX_SPEAKER_INPUT_CHARS = 8_000
    if (raw.length > MAX_SPEAKER_INPUT_CHARS) {
      raw = `[…truncated for length]\n${raw.slice(-MAX_SPEAKER_INPUT_CHARS)}`
    }

    try {
      const result = await window.api.chat({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        bypassLengthCheck: true,
        systemPrompt: [
          'You are a meeting transcript analyst specializing in speaker diarization.',
          'Analyze conversation patterns to identify distinct speakers.',
          'Label each speaking turn clearly as [Speaker 1], [Speaker 2], etc.',
          `Output language: ${targetLang}`,
        ].join(' '),
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              'Analyze the following meeting transcript and label each distinct speaker.',
              '',
              'Rules:',
              '- Identify speaker changes based on: conversation turn-taking, topic shifts, question/answer patterns',
              '- Use labels: [Speaker 1], [Speaker 2], [Speaker 3], etc.',
              '- Keep the original text intact, only add speaker labels',
              '- If the entire transcript is one person, label everything as [Speaker 1]',
              '',
              'Format exactly as:',
              '[Speaker 1]: <their text>',
              '[Speaker 2]: <their text>',
              '[Speaker 1]: <their text>',
              '...',
              '',
              '[Transcript]:',
              raw,
            ].join('\n'),
          }],
        }],
      })

      if (result.success && result.reply) {
        setSpeakerAnalysis(result.reply)
        if (sessionIdRef.current) {
          updateLiveSession(sessionIdRef.current, { speakerAnalysis: result.reply })
        }
      } else {
        const errMsg = result.error ?? 'Speaker analysis failed. Please try again.'
        console.error('[speaker-analysis] Backend error:', errMsg)
        setSpeakerAnalysis(`❌ ${errMsg}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[speaker-analysis] Exception:', msg)
      setSpeakerAnalysis(`❌ ${msg}`)
    } finally {
      setIsAnalyzingSpeakers(false)
    }
  }, [updateLiveSession])

  // ── AI Action Items extraction ──────────────────────────────────────────────
  const handleExtractActionItems = useCallback(async () => {
    let raw = fullRawForSummaryRef.current
    if (!raw) return

    setIsExtractingActionItems(true)
    setActionItems(null)

    const { targetLang, selectedProvider, selectedModels } = paramsRef.current

    const MAX_AI_INPUT_CHARS = 10_000
    if (raw.length > MAX_AI_INPUT_CHARS) {
      raw = `[…truncated]\n${raw.slice(-MAX_AI_INPUT_CHARS)}`
    }

    try {
      const result = await window.api.chat({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        bypassLengthCheck: true,
        systemPrompt: `You are a meeting assistant. Extract action items from meeting transcripts clearly. Output in ${targetLang}.`,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              `Extract all action items from the following meeting transcript.`,
              'Rules:',
              '- List each action item as a numbered point',
              '- Include: responsible person (if mentioned), task description, deadline (if mentioned)',
              '- If no action items are found, say so clearly',
              '- Be concise and direct',
              `- Output in ${targetLang}`,
              '',
              '[Transcript]:',
              raw,
            ].join('\n'),
          }],
        }],
      })

      if (result.success && result.reply) {
        setActionItems(result.reply)
        if (sessionIdRef.current) {
          updateLiveSession(sessionIdRef.current, { actionItems: result.reply })
        }
      } else {
        const errMsg = result.error ?? 'Failed to extract action items.'
        console.error('[action-items] Backend error:', errMsg)
        setActionItems(`❌ ${errMsg}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[action-items] Exception:', msg)
      setActionItems(`❌ ${msg}`)
    } finally {
      setIsExtractingActionItems(false)
    }
  }, [updateLiveSession])

  // ── AI Decisions extraction ─────────────────────────────────────────────────
  const handleExtractDecisions = useCallback(async () => {
    let raw = fullRawForSummaryRef.current
    if (!raw) return

    setIsExtractingDecisions(true)
    setDecisions(null)

    const { targetLang, selectedProvider, selectedModels } = paramsRef.current

    const MAX_AI_INPUT_CHARS = 10_000
    if (raw.length > MAX_AI_INPUT_CHARS) {
      raw = `[…truncated]\n${raw.slice(-MAX_AI_INPUT_CHARS)}`
    }

    try {
      const result = await window.api.chat({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        bypassLengthCheck: true,
        systemPrompt: `You are a meeting assistant. Extract key decisions made during meetings. Output in ${targetLang}.`,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              `Extract all key decisions made in the following meeting transcript.`,
              'Rules:',
              '- List each decision as a numbered point',
              '- Include context for each decision (why it was made, if mentioned)',
              '- If no clear decisions are found, say so clearly',
              '- Be concise and direct',
              `- Output in ${targetLang}`,
              '',
              '[Transcript]:',
              raw,
            ].join('\n'),
          }],
        }],
      })

      if (result.success && result.reply) {
        setDecisions(result.reply)
        if (sessionIdRef.current) {
          updateLiveSession(sessionIdRef.current, { decisions: result.reply })
        }
      } else {
        const errMsg = result.error ?? 'Failed to extract decisions.'
        console.error('[decisions] Backend error:', errMsg)
        setDecisions(`❌ ${errMsg}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[decisions] Exception:', msg)
      setDecisions(`❌ ${msg}`)
    } finally {
      setIsExtractingDecisions(false)
    }
  }, [updateLiveSession])

  // ── Speaker rename ─────────────────────────────────────────────────────────
  /** Maps a speaker's original label to a user-assigned display name. */
  const handleRenameSpeaker = useCallback((originalLabel: string, newName: string) => {
    if (!newName.trim()) return
    setSpeakerNameMap(prev => ({ ...prev, [originalLabel]: newName.trim() }))
  }, [])

  // ── Subtitle IPC integration ───────────────────────────────────────────────
  // Register onClosed listener once so the button syncs when user clicks ✕ in the OS window
  useEffect(() => {
    const cleanup = window.api.subtitle.onClosed(() => setShowSubtitles(false))
    return cleanup
  }, [])

  // Open / close the OS subtitle window whenever the toggle changes
  useEffect(() => {
    if (showSubtitles) {
      window.api.subtitle.show()
    } else {
      window.api.subtitle.hide()
    }
  }, [showSubtitles])

  // Push latest translation text to the subtitle window whenever it changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: latestSubtitle + isTranslating are the intentional triggers
  useEffect(() => {
    if (showSubtitles) {
      window.api.subtitle.update(latestSubtitle, isTranslating)
    }
  }, [latestSubtitle, isTranslating, showSubtitles])

  // Apply appearance settings to the subtitle window whenever they change
  // biome-ignore lint/correctness/useExhaustiveDependencies: subtitleSettings is the intentional trigger
  useEffect(() => {
    if (showSubtitles) {
      window.api.subtitle.setStyle(subtitleSettings)
    }
  }, [subtitleSettings, showSubtitles])

  // Cleanup on unmount — also close the subtitle window if it was open
  useEffect(() => {
    return () => {
      activeRef.current = false
      if (vadTimerRef.current) clearInterval(vadTimerRef.current)
      if (pipelineErrorTimerRef.current) clearTimeout(pipelineErrorTimerRef.current)
      try { audioCtxRef.current?.close() } catch {}
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop()
      }
      // Close the OS subtitle window when leaving the page
      window.api.subtitle.hide()
    }
  }, [])

  // ── Computed ──────────────────────────────────────────────────────────────
  const wordCount = rawTranscript
    ? rawTranscript.replace(/· · ·/g, '').split(/\s+/).filter(Boolean).length
    : 0

  return {
    // Audio mode
    audioMode,
    setAudioMode,
    screenPermission,
    // Core state
    isActive,
    rawTranscript,
    translation,
    isTranscribing,
    isTranslating,
    micError,
    pipelineError,
    // Subtitle state
    showSubtitles,
    setShowSubtitles,
    latestSubtitle,
    showSubtitleConfig,
    setShowSubtitleConfig,
    subtitleSettings,
    setSubtitleSettings,
    // Realtime segments + interim text
    segments,
    pendingText,
    // Summary state
    showSummaryBtn,
    summary,
    isSummarizing,
    // Speaker analysis state
    speakerAnalysis,
    isAnalyzingSpeakers,
    // Action items + decisions
    actionItems,
    isExtractingActionItems,
    decisions,
    isExtractingDecisions,
    // Speaker name map + session start time
    speakerNameMap,
    sessionStartTime,
    // Handlers
    handleStart,
    handleStop,
    handleClear,
    handleSummarize,
    handleAnalyzeSpeakers,
    handleExtractActionItems,
    handleExtractDecisions,
    handleRenameSpeaker,
    // DOM refs
    rawEndRef,
    txEndRef,
    // Computed
    wordCount,
    isMac,
    hasOpenAIKey,
    hasAnyKey,
  }
}
