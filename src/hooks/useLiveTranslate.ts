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
import { MicVAD } from '@ricky0123/vad-web'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSupportedAudioMimeType } from '../constants/audio'
import { LANG_NAMES_FOR_AI } from '../constants/langNames'
import { useAppStore } from '../store/useAppStore'
import type { Provider, SubtitleSettings } from '../types'
import { extractCompleteSentences, isHallucination, jaccardSimilarity, splitSentences } from '../utils/live-translate'
import { float32ToWav } from '../utils/wav-encoder'

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Maximum recording window per chunk.
 *
 * 2000 ms gives Whisper enough audio context to decode words accurately.
 * Combined with VAD early-stop (below), typical chunks finish in 800-1600 ms.
 * Whisper performs better with slightly longer chunks — 2 s is a safe floor.
 */
const CHUNK_DURATION_MS    = 2000

/**
 * STT chunks accumulate into a pending buffer until a sentence boundary is
 * detected (. ! ? 。 ！ ？ etc.).  Only complete sentences are translated —
 * they are then locked and never re-translated.
 *
 * FALLBACK: if MAX_PENDING_CHUNKS STT results arrive with no punctuation
 * (common with Japanese / Whisper), the whole buffer is force-translated so
 * the user is never stuck waiting indefinitely.
 *
 * Reduced from 3 to 2 — force-translate after 3 s of incomplete sentences
 * instead of 4.5 s.
 */
const MAX_PENDING_CHUNKS   = 2

/**
 * Number of recently-completed sentences to send as translation CONTEXT.
 * Gives the AI enough background to understand names, terms, and topic flow
 * without growing the prompt indefinitely.
 */
const CONTEXT_SENTENCES    = 2

/**
 * VAD policy parameters — adapted per source type and online quality metrics.
 * All RMS thresholds are calibrated for the POST-gain signal.
 *
 * ── Audio signal levels AFTER software gain ──────────────────────────────
 *   MIC_GAIN = 4×:
 *     • Pure silence / AC hum  : ~0–16   → rejected by policy.speechRmsThreshold
 *     • Quiet speech           : ~32–60  → accepted
 *     • Normal speech          : ~60–127 → clearly accepted
 *   SYSTEM_AUD_GAIN = 2×:
 *     • Background noise       : ~0–8    → rejected
 *     • Media/music content    : ~8–30   → policy uses higher thresholds to filter
 *     • Speech in call         : ~20–60  → accepted
 *
 * ── State machine ──────────────────────────────────────────────────────────
 *   SILENCE ──(minSpeechSamples consecutive speech frames)──▶ SPEECH
 *   SPEECH  ──(hangoverSamples  consecutive silent  frames)──▶ SILENCE [early stop]
 *
 *   Both counters are RESET on the opposite event (consecutive, not cumulative).
 */
interface VadParams {
  speechRmsThreshold: number   // RMS floor — below this → silence frame
  peakRmsThreshold:   number   // peak RMS that must fire at least once → rules out constant hum
  minSpeechSamples:   number   // consecutive speech frames → start trigger
  hangoverSamples:    number   // consecutive silent frames → end trigger (hangover)
}

/**
 * Source-aware initial VAD policy (Phase 1 of the policy engine).
 *
 * Each audio mode has a different software gain and expected content type:
 *
 *   mic    — 4× gain, real-time conversation → sensitive, low latency optimized.
 *   system — 2× gain, media/video content → more conservative; music/SFX can
 *            trigger VAD so we require more consecutive speech frames and a
 *            longer hangover to avoid spurious segments.
 *   both   — mixed gain/content → intermediate policy.
 */
function getInitialVadPolicy(mode: 'mic' | 'system' | 'both'): VadParams {
  switch (mode) {
    case 'system':
      // 2× gain; media audio often has music/SFX → require 3 consecutive
      // speech frames (240 ms) and 480 ms hangover to reduce false triggers.
      return { speechRmsThreshold: 10, peakRmsThreshold: 18, minSpeechSamples: 3, hangoverSamples: 6 }
    case 'both':
      // Mixed source → intermediate policy.
      return { speechRmsThreshold: 9, peakRmsThreshold: 16, minSpeechSamples: 2, hangoverSamples: 5 }
    default: // mic
      // 4× gain, live conversation → 160 ms start trigger, 400 ms hangover.
      return { speechRmsThreshold: 8, peakRmsThreshold: 15, minSpeechSamples: 2, hangoverSamples: 5 }
  }
}

/**
 * Online VAD quality monitoring (Phase 2 — adaptive parameters).
 *
 * After each recorded chunk we measure the VAD flip rate — the number of
 * SPEECH ↔ SILENCE state transitions within that chunk.
 *
 * High flip rate signals instability (music, noise bursts, clipping) → we
 *   increase the hangover by 1 sample (up to VAD_MAX_HANGOVER_SAMPLES) so the
 *   state machine becomes less sensitive until conditions improve.
 *
 * Low flip rate after a period of instability signals the audio has settled
 *   back to normal → we relax the hangover by 1 sample toward the source default.
 *
 * This avoids the need to hard-code thresholds for every possible environment:
 * the policy self-tunes during the session.
 */
const VAD_SAMPLE_INTERVAL      = 80   // ms per frame
const VAD_MAX_HANGOVER_SAMPLES  = 8    // cap at 8 × 80 ms = 640 ms
const VAD_FLIP_RATE_HIGH        = 10   // flips per chunk above this → increase hangover
const VAD_FLIP_RATE_LOW         = 3    // flips per chunk below this → relax hangover

/**
 * Minimum recording time before an early stop is allowed.
 * Prevents a single noise spike at the start of a chunk from immediately
 * ending the recording before any real speech has been captured.
 */
const MIN_CHUNK_RECORD_MS = 300   // ms

/**
 * Upper bound on words Whisper may return for a single CHUNK_DURATION_MS chunk.
 * Raised for languages with higher token density (Japanese, Chinese).
 */
const MAX_WORDS_PER_CHUNK  = 60   // raised — Japanese/Chinese produce more tokens per second

/**
 * Upper bound on word-per-second rate within a chunk.
 * Raised to accommodate fast speakers and high-token-density languages.
 */
const MAX_WORDS_PER_SEC    = 15   // raised — accommodate fast/dense speech

/**
 * Number of consecutive silent chunks before context reset.
 * Raised to 10 (= 30 s) to reduce over-eager context clearing.
 */
const SILENCE_RESET_CHUNKS = 10   // raised — 30 s of silence before context reset

/**
 * Whisper confidence gate thresholds (from verbose_json segment signals).
 * Relaxed to reduce false rejections — Whisper's own no_speech_prob is
 * the most reliable signal; the others are secondary guards.
 */
const NO_SPEECH_PROB_MAX    = 0.90   // only reject if Whisper is ≥90% sure it's silence
const AVG_LOGPROB_MIN       = -2.0   // accept lower-confidence transcriptions
const COMPRESSION_RATIO_MAX = 3.5    // allow more repetitive output before discarding

/**
 * Software gain applied to the microphone AND system audio signal.
 * Applied to boost quiet/distant speakers above the VAD threshold.
 */
const MIC_GAIN        = 4.0   // mic boost — compensates for quiet/distant speakers
const SYSTEM_AUD_GAIN = 2.0   // system audio boost — remote call audio is often quieter

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

/**
 * Speaker diarization — silence-gap heuristics.
 *
 * MIN_SILENCE_FOR_SPEAKER_CHANGE: raised to 2 chunks (~6 s) so brief pauses
 *   within a turn don't trigger a false speaker switch.
 *
 * MIN_SPEAKER_DURATION_MS: lowered to 2500 ms so rapid back-and-forth
 *   conversations (common in 1:1 calls) can be tracked accurately.
 *
 * LONG_SILENCE_CHUNKS: silence ≥ 4 chunks (~12 s) is a strong signal that
 *   a genuinely new participant started speaking rather than an existing one
 *   returning after a pause.
 *
 * MAX_SPEAKERS: hard cap on distinct speaker labels.  Once reached, the
 *   Least-Recently-Used speaker is recycled instead of creating new labels.
 *
 * SPEAKER_TURN_HISTORY_SIZE: number of past turns kept in memory so the
 *   cycle-back logic can identify the most likely "other" speaker.
 */
const MIN_SILENCE_FOR_SPEAKER_CHANGE = 2     // raised: ~6 s of quiet before switching
const MIN_SPEAKER_DURATION_MS        = 2_500 // lowered: allows faster turn-taking
const LONG_SILENCE_CHUNKS            = 4     // ≥12 s → likely a genuinely new speaker
const MAX_SPEAKERS                   = 6     // cap on distinct labels per session
const SPEAKER_TURN_HISTORY_SIZE      = 10    // recent turns kept for cycle-back logic

/** Default subtitle appearance settings — also used by reset button in LiveTranslatePage */
export const DEFAULT_SUBTITLE_SETTINGS = {
  textColor: '#ffffff',
  fontSize:  18,
  bgOpacity: 84,
} as const satisfies SubtitleSettings

/**
 * Maximum characters sent to the AI for summarization / action items / decisions.
 * Keeps the last N chars of each section (most recent & relevant content).
 * Avoids token-limit errors on long sessions while giving the model enough context.
 */
const MAX_SUMMARIZE_SECTION_CHARS = 10_000

/** How long (ms) a pipeline error toast is shown before auto-dismissing. */
const PIPELINE_ERROR_DISPLAY_MS = 4_000

/**
 * Adaptive VAD — upgrades automatically from energy-based → Silero (ML) VAD
 * when noise metrics indicate the mic environment is too loud for reliable detection.
 *
 * One-way upgrade (energy → Silero, never back) to prevent oscillation.
 * Only applies to mic mode — system/both audio must use the energy-based path.
 *
 * A "noise discard" = chunk where Whisper returned:
 *   • Empty / hallucinated text  (isHallucination = true), OR
 *   • High no-speech probability (noSpeechProb > NO_SPEECH_PROB_MAX)
 */
const ADAPTIVE_VAD_MIN_CHUNKS        = 6     // min speech chunks before evaluating
const ADAPTIVE_VAD_DISCARD_THRESHOLD = 0.40  // 40 % noise-discard rate → upgrade
const ADAPTIVE_VAD_EVAL_WINDOW       = 12    // rolling 12-chunk window

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLiveTranslate() {
  const {
    sourceLang, targetLang, selectedProvider, selectedModels, keyStatus,
    sttProvider,
    addLiveSession, updateLiveSession,
    viewingLiveSessionId, liveSessions, setViewingLiveSession,
    setSelectedProvider, setSelectedModel, setTargetLang,
  } = useAppStore()

  // 'mic'    = microphone only (getUserMedia)
  // 'system' = system audio only (getDisplayMedia), no microphone
  // 'both'   = system audio (getDisplayMedia) + microphone — mixed
  const [audioMode,      setAudioMode]      = useState<'mic' | 'system' | 'both'>('system')

  // macOS Screen Recording permission: null = not checked yet
  const [screenPermission, setScreenPermission] = useState<string | null>(null)

  const [isActive,       setIsActive]       = useState(false)
  const [rawTranscript,  setRawTranscript]  = useState('')
  const [translation,    setTranslation]    = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isTranslating,  setIsTranslating]  = useState(false)
  const [micError,       setMicError]       = useState<string | null>(null)
  const [pipelineError,  setPipelineError]  = useState<string | null>(null)
  /** 'energy' (default) or 'silero' (auto-upgraded when noisy). Exposed for UI indicator. */
  const [vadMode,        setVadMode]        = useState<'energy' | 'silero'>('energy')

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
  /**
   * Ordered history of the last SPEAKER_TURN_HISTORY_SIZE speaker labels assigned.
   * Used by the cycle-back algorithm to identify the most likely "other" speaker
   * without ever incrementing past MAX_SPEAKERS.
   */
  const speakerTurnHistoryRef    = useRef<string[]>([])

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
  const paramsRef = useRef({ sourceLang, targetLang, selectedProvider, selectedModels, sttProvider })
  useEffect(() => {
    paramsRef.current = { sourceLang, targetLang, selectedProvider, selectedModels, sttProvider }
  }, [sourceLang, targetLang, selectedProvider, selectedModels, sttProvider])

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

  /**
   * mountedRef — set to false on component unmount.
   * Guards all async setState calls in processChunk and background translation
   * to prevent "setState on unmounted component" errors and memory leaks
   * when a live session is stopped while translation/STT calls are in-flight.
   */
  const mountedRef = useRef(true)

  const audioCtxRef        = useRef<AudioContext | null>(null)
  const analyserRef        = useRef<AnalyserNode | null>(null)
  const hasSpeechRef       = useRef(false)
  const speechCountRef     = useRef(0)
  const vadTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Silero VAD (mic mode) ─────────────────────────────────────────────────
  // micVadRef       — active MicVAD instance; null when using system/both mode.
  // lastSpeechEndTimeRef — wall-clock timestamp of the last onSpeechEnd event;
  //   used to compute inter-utterance silence for speaker diarization without
  //   a polling timer.
  // biome-ignore lint/suspicious/noExplicitAny: MicVAD type is not re-exported by the library
  const micVadRef            = useRef<any>(null)
  const lastSpeechEndTimeRef = useRef<number>(0)

  // ── Adaptive VAD quality monitor ──────────────────────────────────────────
  const vadModeStateRef    = useRef<'energy' | 'silero'>('energy')
  const adaptiveChunksRef  = useRef(0)
  const adaptiveDiscardRef = useRef(0)
  const upgradeVADRef      = useRef<(() => Promise<void>) | null>(null)

  // Counts consecutive chunks where VAD detected no speech.
  // When it hits SILENCE_RESET_CHUNKS, the decoder context is wiped so stale
  // transcript from before a long pause cannot bias the next decode cycle.
  const silentChunkCountRef = useRef(0)

  // ── VAD policy engine ──────────────────────────────────────────────────────
  // vadPolicyRef: active VAD parameters, adapted online after each chunk.
  //   Initialised from getInitialVadPolicy(audioMode) on session start.
  // vadModeRef:   stores the current audio mode so the policy can reset to
  //   its source-appropriate default when relaxing after a stable period.
  const vadPolicyRef = useRef<VadParams>(getInitialVadPolicy('mic'))
  const vadModeRef   = useRef<'mic' | 'system' | 'both'>('mic')

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
  // useMemo avoids Object.values(...).some() running on every render —
  // keyStatus only changes when the user saves/deletes an API key in Settings.
  const hasAnyKey    = useMemo(() => Object.values(keyStatus).some(Boolean), [keyStatus])
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
  useEffect(() => { segmentsRef.current = segments }, [segments])
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

    // ── Adaptive VAD: count chunk in rolling evaluation window ────────────
    adaptiveChunksRef.current += 1

    const { sourceLang, targetLang, selectedProvider, selectedModels, sttProvider } = paramsRef.current

    // Live Translate uses MediaRecorder (audio chunks) — it cannot use the
    // browser's Web Speech API which requires a real-time stream. If the user
    // chose 'webSpeech', fall back to 'auto' so STT still works here.
    const effectiveSttProvider = sttProvider === 'webSpeech' ? 'auto' : sttProvider

    // ── STT call — keep reference to full result for confidence gate ──────
    setIsTranscribing(true)
    let stt: Awaited<ReturnType<typeof window.api.transcribeAudio>> | null = null
    try {
      const buf = await blob.arrayBuffer()
      stt = await window.api.transcribeAudio({
        audioData:    buf,
        mimeType,
        language:     sourceLang === 'auto' ? undefined : sourceLang,
        // Pass the last successfully transcribed text as Whisper's prompt
        // context.  Whisper treats it as "speech already in progress",
        // maintaining terminology consistency across chunks and preventing
        // the decoder from drifting to a YouTube-caption style opening.
        previousText: lastChunkTextRef.current || undefined,
        sttProvider:  effectiveSttProvider,
      })
    } catch {
      setPipelineError('STT failed — retrying next chunk')
      if (pipelineErrorTimerRef.current) clearTimeout(pipelineErrorTimerRef.current)
      pipelineErrorTimerRef.current = setTimeout(() => setPipelineError(null), PIPELINE_ERROR_DISPLAY_MS)
    }
    finally { setIsTranscribing(false) }

    const newText = stt?.success && stt.text?.trim() ? stt.text.trim() : ''
    if (!newText || isHallucination(newText)) {
      // ── Adaptive VAD: noise-discard (empty / hallucinated output) ────────
      adaptiveDiscardRef.current += 1
      if (vadModeStateRef.current === 'energy') {
        if (adaptiveChunksRef.current >= ADAPTIVE_VAD_MIN_CHUNKS &&
            adaptiveDiscardRef.current / adaptiveChunksRef.current > ADAPTIVE_VAD_DISCARD_THRESHOLD) {
          void upgradeVADRef.current?.()
          adaptiveChunksRef.current  = 0
          adaptiveDiscardRef.current = 0
        } else if (adaptiveChunksRef.current >= ADAPTIVE_VAD_EVAL_WINDOW) {
          adaptiveChunksRef.current  = 0
          adaptiveDiscardRef.current = 0
        }
      }
      return
    }

    // ── Whisper confidence gate (verbose_json segment signals) ────────────
    // These are Whisper's own internal estimates returned via verbose_json.
    // They are the most reliable hallucination indicators available from
    // the OpenAI API and should be treated as mandatory gates.
    //
    //  noSpeechProb    > NO_SPEECH_PROB_MAX    → model is ≥65% sure no speech
    //  avgLogprob      < AVG_LOGPROB_MIN       → model is not confident in tokens
    //  compressionRatio > COMPRESSION_RATIO_MAX → output is anomalously repetitive
    if (typeof stt?.noSpeechProb === 'number' && stt.noSpeechProb > NO_SPEECH_PROB_MAX) {
      // ── Adaptive VAD: Whisper says no speech detected ────────────────────
      adaptiveDiscardRef.current += 1
      if (vadModeStateRef.current === 'energy') {
        if (adaptiveChunksRef.current >= ADAPTIVE_VAD_MIN_CHUNKS &&
            adaptiveDiscardRef.current / adaptiveChunksRef.current > ADAPTIVE_VAD_DISCARD_THRESHOLD) {
          void upgradeVADRef.current?.()
          adaptiveChunksRef.current  = 0
          adaptiveDiscardRef.current = 0
        } else if (adaptiveChunksRef.current >= ADAPTIVE_VAD_EVAL_WINDOW) {
          adaptiveChunksRef.current  = 0
          adaptiveDiscardRef.current = 0
        }
      }
      return
    }
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

    // Append new text and trim to MAX_RAW_TRANSCRIPT_CHARS to prevent unbounded growth
    // for very long sessions (hours). The last N chars are kept — sufficient for summarization.
    const updatedRaw = fullRawForSummaryRef.current
      ? `${fullRawForSummaryRef.current} ${newText}`
      : newText
    fullRawForSummaryRef.current = updatedRaw.length > MAX_RAW_TRANSCRIPT_CHARS
      ? updatedRaw.slice(-MAX_RAW_TRANSCRIPT_CHARS)
      : updatedRaw
    setRawTranscript(fullRawForSummaryRef.current)

    // ── Language-agnostic sentence boundary detection ─────────────────────────
    // Whisper's verbose_json response includes per-segment texts that reflect the
    // model's own internal sentence/phrase segmentation — valid for ALL languages
    // without any language-specific heuristics.
    //
    // Strategy:
    //   • When Whisper returns 2+ segments, process each segment independently
    //     through the pending buffer.  A segment that ends at a natural boundary
    //     (with punctuation) will immediately complete, while a mid-sentence
    //     segment accumulates as usual.
    //   • When only one segment is returned (or segmentTexts is absent), fall back
    //     to the previous single-text accumulation behaviour.
    //
    // This replaces the earlier approach of matching Japanese-only morphemes
    // (よ/ね/ます/etc.) which was language-specific and therefore not optimal.
    const sttExt = stt as { segmentTexts?: string[] }
    const whisperParts: string[] = (sttExt?.segmentTexts?.length ?? 0) > 1
      ? (sttExt.segmentTexts ?? []).map((s: string) => s.trim()).filter(Boolean)
      : [newText]

    // Collect all complete sentences found across the Whisper parts in this chunk
    const completedSentences: string[] = []

    for (const part of whisperParts) {
      const newBuffer = pendingBufferRef.current
        ? `${pendingBufferRef.current} ${part}`
        : part

      // Show growing interim text so the transcript feels live as each part arrives
      setPendingText(newBuffer)

      const { complete: partComplete, pending: partPending } = extractCompleteSentences(newBuffer)

      if (!partComplete) {
        // No sentence boundary yet — accumulate and move to next part
        pendingBufferRef.current = newBuffer
        continue
      }

      // Sentence boundary found — capture complete text, update buffer to remainder
      pendingBufferRef.current = partPending
      setPendingText(partPending)
      completedSentences.push(...splitSentences(partComplete))
    }

    // Handle no-complete-sentence case: increment pending counter, possibly force-flush
    if (completedSentences.length === 0) {
      pendingChunkCountRef.current += 1
      if (pendingChunkCountRef.current >= MAX_PENDING_CHUNKS) {
        // Force-flush: emit the entire accumulated buffer as a translation unit
        const forceText = pendingBufferRef.current
        if (forceText) {
          pendingBufferRef.current = ''
          pendingChunkCountRef.current = 0
          setPendingText('')
          completedSentences.push(...splitSentences(forceText))
        }
      }
      if (completedSentences.length === 0) return
    } else {
      pendingChunkCountRef.current = 0
    }

    // ── VAD-based speaker diarization (smart cycling) ─────────────────────
    // Runs once per chunk — the same speaker label is assigned to all sentences
    // completed within this audio window.
    //
    // Algorithm:
    //   1 known speaker  → any qualifying silence → introduce Speaker 2
    //   2 known speakers → short/medium silence   → alternate between them
    //                    → long silence (≥LONG_SILENCE_CHUNKS) → introduce Speaker 3
    //   3+ speakers      → short/medium gap → return to most-recent other speaker
    //                    → long gap         → introduce new speaker (up to MAX_SPEAKERS)
    //   MAX_SPEAKERS hit → always recycle Least-Recently-Used label
    //
    // This fixes the "speaker count only ever goes up" bug:
    //   Before: Speaker 1 → 2 → 3 → 4 → 5 …  (wrong for 1-on-1 meetings)
    //   After:  Speaker 1 → 2 → 1 → 2 → 1 …  (correct alternating pattern)
    const silenceBefore = silenceBeforeChunkRef.current
    silenceBeforeChunkRef.current = 0  // consume once

    if (
      silenceBefore >= MIN_SILENCE_FOR_SPEAKER_CHANGE &&
      Date.now() - lastSpeakerChangeTimeRef.current > MIN_SPEAKER_DURATION_MS
    ) {
      const prevSpeaker = currentSpeakerRef.current
      const knownCount  = speakerCountRef.current
      const history     = speakerTurnHistoryRef.current
      let nextSpeaker   = prevSpeaker  // default: stay unless a better choice is found

      if (knownCount === 1) {
        // First speaker change ever: introduce Speaker 2
        speakerCountRef.current = 2
        nextSpeaker = 'Speaker 2'
      } else if (knownCount === 2) {
        if (silenceBefore >= LONG_SILENCE_CHUNKS && history.length >= 4) {
          // Very long silence + established 2-speaker pattern → possible 3rd person
          speakerCountRef.current = 3
          nextSpeaker = 'Speaker 3'
        } else {
          // Most common 1:1 meeting pattern: simply alternate between the two speakers
          nextSpeaker = prevSpeaker === 'Speaker 1' ? 'Speaker 2' : 'Speaker 1'
        }
      } else if (knownCount < MAX_SPEAKERS) {
        // 3+ known speakers: prefer the most-recently-active other speaker for short
        // gaps; only introduce a genuinely new label after a very long silence.
        const recentOthers = [...history].reverse().filter(s => s !== prevSpeaker)
        const mostRecentOther = recentOthers[0]
        if (silenceBefore >= LONG_SILENCE_CHUNKS) {
          // Long pause → likely a new participant entering the conversation
          speakerCountRef.current += 1
          nextSpeaker = `Speaker ${speakerCountRef.current}`
        } else if (mostRecentOther) {
          // Short/medium gap → return to the most recently active other speaker
          nextSpeaker = mostRecentOther
        } else {
          speakerCountRef.current += 1
          nextSpeaker = `Speaker ${speakerCountRef.current}`
        }
      } else {
        // MAX_SPEAKERS reached — find and recycle the Least-Recently-Used label
        // so the label pool stays bounded no matter how long the session runs.
        const seen = new Set<string>()
        const lruOrder: string[] = []
        for (const s of [...history].reverse()) {
          if (!seen.has(s)) { seen.add(s); lruOrder.push(s) }
        }
        const allLabels = Array.from({ length: MAX_SPEAKERS }, (_, i) => `Speaker ${i + 1}`)
        // Prefer a label not seen at all in recent history; fall back to oldest in LRU order
        nextSpeaker = allLabels.find(s => !seen.has(s)) ?? lruOrder[lruOrder.length - 1] ?? 'Speaker 1'
      }

      if (nextSpeaker !== prevSpeaker) {
        currentSpeakerRef.current        = nextSpeaker
        lastSpeakerChangeTimeRef.current = Date.now()
      }
    }
    const currentSpeaker = currentSpeakerRef.current
    // Record every finalized turn in the history so future decisions can cycle back correctly
    speakerTurnHistoryRef.current = [...speakerTurnHistoryRef.current, currentSpeaker].slice(-SPEAKER_TURN_HISTORY_SIZE)

    // ── Create one segment per completed sentence ─────────────────────────────
    // Each sentence from completedSentences gets its own row, segment ID, and
    // background translation — no more merged multi-sentence rows.
    for (const sentenceText of completedSentences) {
      // Add segment immediately so it shows in the left panel while translating.
      // Translation runs in the background — the queue is NOT blocked so the next
      // audio chunk can be STT'd immediately without waiting for translation.
      const segId = `seg-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`
      setSegments(prev => [...prev, {
        id: segId,
        rawText: sentenceText,
        translation: '',   // will be filled in when background translation finishes
        speaker: currentSpeaker,
        timestamp: Date.now(),
      }])

      // Update context BEFORE launching background translation so the next sentence
      // has the correct context even while this sentence is still being translated.
      recentSentencesRef.current.push(sentenceText)
      if (recentSentencesRef.current.length > CONTEXT_SENTENCES) recentSentencesRef.current.shift()

      // Fire translation in background (NOT awaited) — allows the STT queue to
      // continue processing the next audio chunk immediately.
      // Capture per-sentence values in IIFE params to avoid closure-over-loop bugs.
      const contextText = recentSentencesRef.current.slice(0, -1).join(' ') // context = previous sentences
      const sourceText  = contextText
        ? `[Context — for reference only, already translated. Do NOT retranslate]:\n"${contextText}"\n\n[Translate to ${targetLang}]:\n${sentenceText}`
        : sentenceText

      // Push the raw sentence to subtitle window so it can show the source text above translation.
      // Also pass segId so the subtitle window can create the entry immediately with a placeholder.
      if (showSubtitlesRef.current) {
        void window.api.subtitle.setSourceText(sentenceText, segId)
      }

      void (async (capturedSegId: string, capturedSourceText: string) => {
        // Guard: skip all setState calls if component was unmounted while this
        // background translation was queued (e.g. user navigated away quickly).
        if (!mountedRef.current) return
        setIsTranslating(true)
        try {
          const batchParams = {
            provider: selectedProvider,
            model: selectedModels[selectedProvider],
            sourceText: capturedSourceText,
            sourceLang,
            targetLang,
            translationStyle: 'general' as const,
            showFurigana: false,
          }

          let txResult: { success: boolean; translatedText?: string }
          let usedStreaming = false

          if (showSubtitlesRef.current) {
            try {
              txResult = await window.api.translateStream({
                provider: selectedProvider,
                model: selectedModels[selectedProvider],
                sourceText: capturedSourceText,
                sourceLang,
                targetLang,
                translationStyle: 'general',
                segId: capturedSegId,
              })
              usedStreaming = txResult.success
            } catch {
              txResult = { success: false }
            }
            if (!txResult.success) {
              txResult = await window.api.translate(batchParams)
            }
          } else {
            txResult = await window.api.translate(batchParams)
          }

          // Re-check mounted after the awaited API calls (can take 1-3 seconds)
          if (!mountedRef.current) return
          if (txResult.success && txResult.translatedText) {
            const newTx = txResult.translatedText.trim()
            setTranslation(prev => prev ? `${prev} ${newTx}` : newTx)
              setLatestSubtitle(newTx)
            fullTxForSummaryRef.current = fullTxForSummaryRef.current
              ? `${fullTxForSummaryRef.current} ${newTx}`
              : newTx
            setSegments(prev => prev.map(seg =>
              seg.id === capturedSegId ? { ...seg, translation: newTx } : seg
            ))
          }
        } catch {
          // Translation failed silently — segment stays with empty translation
        } finally {
          // Guard the finally block: mountedRef may have flipped during the API call
          if (mountedRef.current) setIsTranslating(false)
        }
      })(segId, sourceText)
    }
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

    // ── Capture active policy for this chunk ─────────────────────────────────
    // Read once at chunk start so the policy is stable for the entire chunk
    // even if adaptation fires mid-chunk in a future concurrent scenario.
    const policy = vadPolicyRef.current

    // Peak RMS tracker — tracks the highest RMS seen in this chunk.
    // Required to fire at least once above policy.peakRmsThreshold before speech
    // is confirmed, ruling out constant-level AC hum.
    let chunkPeakRms = 0

    // ── VAD state machine (WebRTC-style hysteresis) ──────────────────────────
    //
    //   consecutiveSpeechSamples — RESETS to 0 on any silence frame.
    //     Only N consecutive speech frames transition SILENCE → SPEECH.
    //
    //   postSpeechSilenceSamples — RESETS to 0 on any speech frame.
    //     Only M consecutive silence frames after confirmed speech trigger
    //     the hangover early-stop.
    //
    //   vadFlipCount — counts total SPEECH ↔ SILENCE state transitions.
    //     Passed to the online quality monitor in recorder.onstop to
    //     detect instability (high flip rate = noisy/music environment).
    let consecutiveSpeechSamples = 0   // consecutive speech frames (start trigger)
    let postSpeechSilenceSamples = 0   // consecutive silence frames after speech (hangover)
    let vadFlipCount = 0               // state transitions this chunk (for adaptation)
    let prevWasSpeech = false          // last frame's speech/silence classification
    const recordStartTime = Date.now()
    if (vadTimerRef.current) clearInterval(vadTimerRef.current)
    vadTimerRef.current = setInterval(() => {
      const analyser = analyserRef.current
      if (!analyser) return
      const data = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(data)
      const rms = Math.sqrt(data.reduce((sum, v) => sum + (v - 128) ** 2, 0) / data.length)
      if (rms > chunkPeakRms) chunkPeakRms = rms

      const isSpeechFrame = rms > policy.speechRmsThreshold
      // Count every SPEECH ↔ SILENCE transition for the quality monitor
      if (isSpeechFrame !== prevWasSpeech) { vadFlipCount++; prevWasSpeech = isSpeechFrame }

      if (isSpeechFrame) {
        // ── Speech frame ────────────────────────────────────────────────────
        consecutiveSpeechSamples += 1
        speechCountRef.current   += 1   // cumulative speech activity
        postSpeechSilenceSamples  = 0   // reset hangover counter

        // Start trigger: N consecutive frames above threshold AND peak confirms
        // genuine speech (not constant-level hum).
        if (
          !hasSpeechRef.current &&
          consecutiveSpeechSamples >= policy.minSpeechSamples &&
          chunkPeakRms >= policy.peakRmsThreshold
        ) {
          hasSpeechRef.current = true
        }
      } else {
        // ── Silence frame ───────────────────────────────────────────────────
        consecutiveSpeechSamples = 0   // RESET — start trigger requires consecutive frames

        if (hasSpeechRef.current) {
          // Hangover: count consecutive silence frames after confirmed speech
          postSpeechSilenceSamples += 1
          if (
            postSpeechSilenceSamples >= policy.hangoverSamples &&
            Date.now() - recordStartTime >= MIN_CHUNK_RECORD_MS &&
            recorder.state === 'recording'
          ) {
            // Sustained post-speech silence → send chunk to Whisper now
            recorder.stop()
          }
        }
      }
    }, VAD_SAMPLE_INTERVAL)

    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }

    recorder.onstop = () => {
      if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }

      const hadSpeech = hasSpeechRef.current
      const recMime   = recorder.mimeType || mimeType || 'audio/webm'
      const blob      = new Blob(audioChunksRef.current, { type: recMime })

      // ── Online VAD quality monitoring & policy adaptation ─────────────────
      // Measure stability via flip rate (SPEECH↔SILENCE transitions per chunk).
      //
      // High flip rate → unstable VAD (music, noise bursts, clipping):
      //   Increase hangover by 1 sample (capped at VAD_MAX_HANGOVER_SAMPLES) so
      //   the state machine becomes less reactive until conditions improve.
      //
      // Low flip rate after instability → audio is stable again:
      //   Relax hangover by 1 sample toward the source-appropriate default.
      //
      // Only the hangover is adapted here; speechRmsThreshold and peakRmsThreshold
      // stay at the source policy default — adapting them online risks masking
      // legitimate quiet speech.
      const defaultHangover = getInitialVadPolicy(vadModeRef.current).hangoverSamples
      if (vadFlipCount > VAD_FLIP_RATE_HIGH) {
        vadPolicyRef.current = {
          ...vadPolicyRef.current,
          hangoverSamples: Math.min(vadPolicyRef.current.hangoverSamples + 1, VAD_MAX_HANGOVER_SAMPLES),
        }
      } else if (vadFlipCount < VAD_FLIP_RATE_LOW && vadPolicyRef.current.hangoverSamples > defaultHangover) {
        vadPolicyRef.current = {
          ...vadPolicyRef.current,
          hangoverSamples: Math.max(vadPolicyRef.current.hangoverSamples - 1, defaultHangover),
        }
      }

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

      // Guard: do NOT restart energy VAD if we upgraded to Silero mid-chunk.
      if (activeRef.current && vadModeStateRef.current === 'energy') startChunk()
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
    setVadMode('energy')
    vadModeStateRef.current    = 'energy'
    adaptiveChunksRef.current  = 0
    adaptiveDiscardRef.current = 0
    upgradeVADRef.current      = null
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
    speakerTurnHistoryRef.current    = []
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
          // Apply software gain to system audio — remote call audio is quieter than mic
          const sysGain = audioCtx.createGain()
          sysGain.gain.value = SYSTEM_AUD_GAIN
          const sysSource = audioCtx.createMediaStreamSource(new MediaStream(sysAudioTracks))
          // ── High-pass filter: cut low-frequency noise ───────────────────
          // Removes AC hum, fan rumble, and wind noise below 80 Hz.
          // These low-frequency components raise the RMS without contributing
          // speech information, causing false-positive VAD frames.
          const highPass = audioCtx.createBiquadFilter()
          highPass.type = 'highpass'
          highPass.frequency.value = 80
          sysSource.connect(highPass)
          highPass.connect(sysGain)
          sysGain.connect(analyser)   // VAD reads filtered + boosted signal
          sysGain.connect(dest)       // Whisper receives filtered + boosted signal
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
        // ── Mic-only mode: Adaptive VAD ───────────────────────────────────────
        //
        // Stage 1 (default) — Energy-based VAD (WebRTC-style RMS detector)
        //   • Zero startup latency, works well in quiet environments
        // Stage 2 (auto-upgrade) — Silero ML VAD
        //   • Triggered when noise-discard rate > ADAPTIVE_VAD_DISCARD_THRESHOLD
        //   • One-way (energy → Silero, never back); reuses the existing mic stream
        const rawMicStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl:  true,
            sampleRate:       { ideal: 16_000 },
            channelCount:     { exact: 1 },
          },
          video: false,
        })
        const rawSource = audioCtx.createMediaStreamSource(rawMicStream)
        const gainNode  = audioCtx.createGain()
        gainNode.gain.value = MIC_GAIN
        rawSource.connect(gainNode)
        gainNode.connect(analyser)
        const micDest = audioCtx.createMediaStreamDestination()
        gainNode.connect(micDest)
        for (const track of rawMicStream.getTracks()) micDest.stream.addTrack(track)
        captureStream = micDest.stream

        // ── Adaptive VAD upgrade function (called by processChunk) ─────────
        upgradeVADRef.current = async () => {
          if (vadModeStateRef.current === 'silero') return
          vadModeStateRef.current = 'silero'
          if (mountedRef.current) setVadMode('silero')
          // Stop energy VAD; onstop guard prevents startChunk() from restarting
          if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }
          if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
          // Reuse existing stream — avoids a second getUserMedia permission prompt
          const existingStream = streamRef.current
          try {
            const micVad = await MicVAD.new({
              baseAssetPath:    './vad/',
              onnxWASMBasePath: './vad/',
              model: 'v5',
              getStream: async () => existingStream
                ?? navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true,
                             autoGainControl: true, sampleRate: { ideal: 16_000 },
                             channelCount: { exact: 1 } },
                    video: false,
                  }),
              positiveSpeechThreshold: 0.50,
              negativeSpeechThreshold: 0.35,
              minSpeechMs:    384,
              preSpeechPadMs: 960,
              redemptionMs:   600,
              onSpeechStart: () => { if (!activeRef.current) return; hasSpeechRef.current = true },
              onSpeechEnd: (samples: Float32Array) => {
                if (!activeRef.current) return
                hasSpeechRef.current = false
                const now = Date.now()
                if (lastSpeechEndTimeRef.current > 0) {
                  const gapMs     = now - lastSpeechEndTimeRef.current
                  const gapChunks = Math.floor(gapMs / CHUNK_DURATION_MS)
                  silenceBeforeChunkRef.current = gapChunks
                  if (gapChunks >= SILENCE_RESET_CHUNKS) {
                    silentChunkCountRef.current  = 0
                    lastChunkTextRef.current     = ''
                    pendingBufferRef.current     = ''
                    pendingChunkCountRef.current = 0
                    recentSentencesRef.current   = []
                  }
                }
                lastSpeechEndTimeRef.current = now
                silentChunkCountRef.current  = 0
                const blob = float32ToWav(samples, 16_000)
                const queuedAt = Date.now()
                queueRef.current = queueRef.current.then(async () => {
                  if (Date.now() - queuedAt > CHUNK_MAX_QUEUE_AGE_MS) return
                  await processChunk(blob, 'audio/wav')
                })
              },
              onVADMisfire: () => { silentChunkCountRef.current += 1 },
            })
            micVad.start()
            micVadRef.current = micVad
          } catch (upgradeErr) {
            console.error('[adaptive-vad] Silero upgrade failed — reverting:', upgradeErr)
            vadModeStateRef.current = 'energy'
            if (mountedRef.current) setVadMode('energy')
            if (activeRef.current) startChunk()
          }
        }
      }

      // ── Shared setup: all audio modes (system / both / mic-energy) ───────
      streamRef.current    = captureStream
      audioCtxRef.current  = audioCtx
      analyserRef.current  = analyser

      // Set the source-appropriate policy before starting the first chunk so
      // every chunk uses the correct thresholds from the very beginning.
      // vadModeRef is kept in sync so the adaptation logic can relax the hangover
      // back to the source default after a period of stability.
      vadModeRef.current   = audioMode
      vadPolicyRef.current = getInitialVadPolicy(audioMode)

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
  }, [startChunk, audioMode, setViewingLiveSession, processChunk])

  const handleStop = useCallback(() => {
    activeRef.current = false
    setIsActive(false)
    setIsTranscribing(false)
    setIsTranslating(false)

    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }

    // ── Silero VAD cleanup (mic mode) ───────────────────────────────────────
    // destroy() stops the AudioWorklet and releases the internal MediaStream.
    // Must be called BEFORE stopping streamRef tracks to avoid double-stop errors.
    if (micVadRef.current) {
      try { micVadRef.current.destroy() } catch {}
      micVadRef.current = null
    }
    lastSpeechEndTimeRef.current = 0
    upgradeVADRef.current        = null
    adaptiveChunksRef.current    = 0
    adaptiveDiscardRef.current   = 0

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
    speakerTurnHistoryRef.current    = []
  }, [])

  /**
   * handleNewSession — triggered by the "Mới" button in the subtitle overlay.
   *
   * Saves the current session to history BEFORE resetting, so the user never
   * loses data when starting a new recording.
   *
   * Behaviour:
   *   • If recording is active → handleStop() auto-saves to history, then clear
   *   • If stopped but has data → save manually to history, then clear
   *   • If no data → just clear (nothing to save)
   */
  const handleNewSession = useCallback(() => {
    if (activeRef.current) {
      // Recording is active → stop it; handleStop auto-saves to history
      handleStop()
    } else {
      // Not recording — save any accumulated data manually before clearing
      const raw = fullRawForSummaryRef.current.trim()
      if (raw && sessionIdRef.current) {
        const wc = raw.replace(/· · ·/g, '').split(/\s+/).filter(Boolean).length
        const { sourceLang, targetLang, selectedProvider, selectedModels } = paramsRef.current
        addLiveSession({
          id: sessionIdRef.current,
          createdAt: sessionStartRef.current || Date.now(),
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
    // Reset UI state for a fresh session
    handleClear()
  }, [handleStop, handleClear, addLiveSession])

  // ── AI Summarize ────────────────────────────────────────────────────────────
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
    const langName = LANG_NAMES_FOR_AI[targetLang] ?? targetLang

    const MAX_AI_INPUT_CHARS = 10_000
    if (raw.length > MAX_AI_INPUT_CHARS) {
      raw = `[…truncated]\n${raw.slice(-MAX_AI_INPUT_CHARS)}`
    }

    try {
      const result = await window.api.chat({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        bypassLengthCheck: true,
        systemPrompt: `You are a meeting assistant. Extract action items from meeting transcripts. IMPORTANT: Always respond in ${langName}, regardless of the transcript language.`,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              `Extract all action items from the following meeting transcript.`,
              `IMPORTANT: Write your response in ${langName} only. Do NOT use the language of the transcript.`,
              'Rules:',
              '- List each action item as a numbered point',
              '- Include: responsible person (if mentioned), task description, deadline (if mentioned)',
              '- If no action items are found, say so clearly',
              '- Be concise and direct',
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
    const langName = LANG_NAMES_FOR_AI[targetLang] ?? targetLang

    const MAX_AI_INPUT_CHARS = 10_000
    if (raw.length > MAX_AI_INPUT_CHARS) {
      raw = `[…truncated]\n${raw.slice(-MAX_AI_INPUT_CHARS)}`
    }

    try {
      const result = await window.api.chat({
        provider: selectedProvider,
        model: selectedModels[selectedProvider],
        bypassLengthCheck: true,
        systemPrompt: `You are a meeting assistant. Extract key decisions made during meetings. IMPORTANT: Always respond in ${langName}, regardless of the transcript language.`,
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: [
              `Extract all key decisions made in the following meeting transcript.`,
              `IMPORTANT: Write your response in ${langName} only. Do NOT use the language of the transcript.`,
              'Rules:',
              '- List each decision as a numbered point',
              '- Include context for each decision (why it was made, if mentioned)',
              '- If no clear decisions are found, say so clearly',
              '- Be concise and direct',
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
  useEffect(() => {
    if (showSubtitles) {
      window.api.subtitle.update(latestSubtitle, isTranslating)
    }
  }, [latestSubtitle, isTranslating, showSubtitles])

  // Apply appearance settings to the subtitle window whenever they change
  useEffect(() => {
    if (showSubtitles) {
      window.api.subtitle.setStyle(subtitleSettings)
    }
  }, [subtitleSettings, showSubtitles])

  // ── Subtitle state push ────────────────────────────────────────────────────
  // cachedSubtitleModelsRef: avoids re-fetching models on every isTranscribing/isTranslating
  // toggle (which happens very frequently). Models are only re-fetched when provider/model
  // selection changes — which is infrequent.
  const cachedSubtitleModelsRef = useRef<{ id: string; name: string }[]>([])

  // Push full state (including model list from API) when stable fields change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedModels reference changes with provider — intentional full sync
  useEffect(() => {
    if (!showSubtitles) return
    const provider  = selectedProvider
    const model     = selectedModels[provider] ?? ''
    const mode = audioMode
    const lang = targetLang
    window.api.fetchModels(provider)
      .then((result) => {
        const availableModels = (result?.models ?? []) as { id: string; name: string }[]
        cachedSubtitleModelsRef.current = availableModels
        void window.api.subtitle.pushState({ selectedProvider: provider, selectedModel: model, isActive, isTranscribing, isTranslating, availableModels, audioMode: mode, targetLang: lang })
      })
      .catch(() => {
        void window.api.subtitle.pushState({ selectedProvider: provider, selectedModel: model, isActive, isTranscribing, isTranslating, availableModels: cachedSubtitleModelsRef.current, audioMode: mode, targetLang: lang })
      })
  }, [showSubtitles, selectedProvider, selectedModels, audioMode, targetLang])

  // Push lightweight status updates without re-fetching models.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable fields read directly, only status changes trigger this
  useEffect(() => {
    if (!showSubtitles) return
    void window.api.subtitle.pushState({
      selectedProvider,
      selectedModel: selectedModels[selectedProvider] ?? '',
      isActive,
      isTranscribing,
      isTranslating,
      availableModels: cachedSubtitleModelsRef.current,
      audioMode,
      targetLang,
    })
  }, [showSubtitles, isActive, isTranscribing, isTranslating])

  // Listen for actions sent FROM the subtitle window (start/stop, provider/model/style changes)
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedProvider needed for setSelectedModel scope
  useEffect(() => {
    const cleanupStart    = window.api.subtitle.onStart(() => { if (!activeRef.current) void handleStart() })
    const cleanupStop     = window.api.subtitle.onStop(() => { if (activeRef.current) handleStop() })
    const cleanupProvider = window.api.subtitle.onSetProvider((provider) => {
      setSelectedProvider(provider as Provider)
    })
    const cleanupModel    = window.api.subtitle.onSetModel((model) => {
      setSelectedModel(selectedProvider as Provider, model)
    })
    const cleanupAudioMode = window.api.subtitle.onSetAudioMode((mode) => {
      setAudioMode(mode as 'mic' | 'system' | 'both')
    })
    const cleanupTargetLang = window.api.subtitle.onSetTargetLang((lang) => {
      setTargetLang(lang)
    })
    const cleanupStyle    = window.api.subtitle.onStyleUpdate((style) => {
      setSubtitleSettings(style)
    })
    // "Mới" button → save current session to history, then reset for a new one
    const cleanupClear    = window.api.subtitle.onClear(() => { handleNewSession() })
    return () => {
      cleanupStart()
      cleanupStop()
      cleanupProvider()
      cleanupModel()
      cleanupAudioMode()
      cleanupTargetLang()
      cleanupStyle()
      cleanupClear()
    }
  }, [handleStart, handleStop, handleClear, handleNewSession, setSelectedProvider, setSelectedModel, selectedProvider, setTargetLang])

  // Cleanup on unmount — stop audio pipeline, mark component as unmounted, close subtitle window.
  // mountedRef.current = false prevents in-flight async callbacks (STT, translation) from
  // calling setState after the component has been removed from the tree.
  useEffect(() => {
    mountedRef.current = true  // reset to true on mount (handles StrictMode double-invoke)
    return () => {
      mountedRef.current = false  // ← guards processChunk + background translation setState calls
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
  // useMemo: rawTranscript can be large (50k chars) — only recount words when the
  // transcript actually changes, not on every render triggered by audio/translation state.
  const wordCount = useMemo(
    () => rawTranscript
      ? rawTranscript.replace(/· · ·/g, '').split(/\s+/).filter(Boolean).length
      : 0,
    [rawTranscript]
  )

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
    // Adaptive VAD mode — 'energy' (default) or 'silero' (auto-upgraded when noisy)
    vadMode,
  }
}
