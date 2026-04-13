import { useCallback, useEffect, useRef, useState } from 'react'
import { LanguageSelector } from '../components/LanguageSelector'
import { MarkdownText } from '../components/MarkdownText'
import { ModelSelector } from '../components/ModelSelector'
import { useAppStore, useT } from '../store/useAppStore'
import type { SubtitleSettings } from '../types'

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
const SPEECH_RMS_THRESHOLD = 6    // sustained sensitivity — slightly above room hum
const PEAK_RMS_THRESHOLD   = 14   // peak gate: at least one sample must reach this
const MIN_SPEECH_SAMPLES   = 4    // 4 × 80 ms = 320 ms sustained speech minimum
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
const MAX_WORDS_PER_SEC    = 7

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
const NO_SPEECH_PROB_MAX    = 0.65
const AVG_LOGPROB_MIN       = -1.0
const COMPRESSION_RATIO_MAX = 2.4

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

  // ── Vietnamese ───────────────────────────────────────────────────────────
  /cảm\s*ơn\s*(các\s*bạn|bạn|quý\s*vị).*xem/i,   // "cảm ơn các bạn đã xem"
  /cảm\s*ơn.*theo\s*dõi/i,
  /đăng\s*ký\s*(kênh|channel)/i,
  /nhấn\s*(like|nút|chuông)/i,
  /bấm\s*(like|đăng\s*ký|theo\s*dõi)/i,
  /like\s*(và|&)\s*đăng\s*ký/i,
  /subscribe.*channel/i,
  /phụ\s*đề.*cung\s*cấp/i,
  /phụ\s*đề.*bởi/i,
  /^xin\s*chào[.!]*$/i,                           // standalone "hello" with nothing else
  /^cảm\s*ơn[.!]*$/i,                             // standalone "thank you"
  /^vâng[,.]?\s*$/i,                              // lone filler "vâng"
  /^ừ[,.]?\s*$/i,                                 // lone filler "ừ"
  /^\(tiếng\s*(nhạc|vỗ\s*tay|cười)\)$/i,          // bracketed sound effects in Vietnamese
  /^\[tiếng\s*(nhạc|vỗ\s*tay|cười)\]$/i,
]

/**
 * Returns true when the text is a known hallucination OR structurally invalid.
 *
 * Checks (in order):
 *   1. Too short (< 4 chars after trimming)
 *   2. Matches a known hallucination pattern
 *   3. Single-character repetition ≥ 4 times covering > 60% of text
 *   4. Word-level n-gram repetition: any bigram or trigram repeating ≥ 3 times
 *      (catches "hello hello hello" or "xin chào xin chào xin chào" style loops)
 */
function isHallucination(text: string): boolean {
  const t = text.trim()
  if (t.length < 4) return true

  if (HALLUCINATION_PATTERNS.some(p => p.test(t))) return true

  // ── Check 3: single-character flooding ───────────────────────────────────
  const charFreq = new Map<string, number>()
  for (const ch of t) charFreq.set(ch, (charFreq.get(ch) ?? 0) + 1)
  const maxCharFreq = Math.max(...charFreq.values())
  if (maxCharFreq >= 4 && maxCharFreq / t.length > 0.6) return true

  // ── Check 4: n-gram word repetition ──────────────────────────────────────
  // Tokenise on whitespace; CJK chars treated as single-char tokens
  const tokens = t
    .replace(/[\u3000-\u9fff\uac00-\ud7ff\u3040-\u30ff]/g, c => ` ${c} `)
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length >= 6) {
    // Check bigrams and trigrams for repetition (≥ 3 occurrences = hallucination)
    for (const n of [2, 3]) {
      const ngFreq = new Map<string, number>()
      for (let i = 0; i <= tokens.length - n; i++) {
        const gram = tokens.slice(i, i + n).join(' ')
        ngFreq.set(gram, (ngFreq.get(gram) ?? 0) + 1)
      }
      for (const count of ngFreq.values()) {
        if (count >= 3) return true
      }
    }
  }

  return false
}

/**
 * Jaccard similarity on word-bag: ratio of shared words to total unique words.
 * Returns 0.0 (no overlap) … 1.0 (identical bags).
 */
function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/\s+/).filter(Boolean))
  const setA = words(a)
  const setB = words(b)
  if (setA.size === 0 && setB.size === 0) return 1
  let intersection = 0
  for (const w of setA) if (setB.has(w)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 1 : intersection / union
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
    addLiveSession, updateLiveSession,
  } = useAppStore()
  const t = useT()

  // 'mic'    = microphone only (getUserMedia)
  // 'system' = system audio (getDisplayMedia) + microphone — mixed
  const [audioMode,      setAudioMode]      = useState<'mic' | 'system'>('mic')

  // macOS Screen Recording permission: null = not checked yet
  const [screenPermission, setScreenPermission] = useState<string | null>(null)

  const [isActive,       setIsActive]       = useState(false)
  const [rawTranscript,  setRawTranscript]  = useState('')
  const [translation,    setTranslation]    = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isTranslating,  setIsTranslating]  = useState(false)
  const [micError,       setMicError]       = useState<string | null>(null)
  const [copiedRaw,      setCopiedRaw]      = useState(false)
  const [copiedTx,       setCopiedTx]       = useState(false)

  // ── Subtitle overlay state ─────────────────────────────────────────────────
  const [showSubtitles,      setShowSubtitles]      = useState(false)
  const [latestSubtitle,     setLatestSubtitle]     = useState('')
  const [showSubtitleConfig, setShowSubtitleConfig] = useState(false)
  const [subtitleSettings,   setSubtitleSettings]   = useState<SubtitleSettings>({
    textColor: '#ffffff',
    fontSize:  18,
    bgOpacity: 84,
  })
  // Ref so processChunk (a stable useCallback) can read current subtitle state
  const showSubtitlesRef = useRef(false)
  useEffect(() => { showSubtitlesRef.current = showSubtitles }, [showSubtitles])

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

  const audioCtxRef        = useRef<AudioContext | null>(null)
  const analyserRef        = useRef<AnalyserNode | null>(null)
  const hasSpeechRef       = useRef(false)
  const speechCountRef     = useRef(0)
  const vadTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  // Counts consecutive chunks where VAD detected no speech.
  // When it hits SILENCE_RESET_CHUNKS, the decoder context is wiped so stale
  // transcript from before a long pause cannot bias the next decode cycle.
  const silentChunkCountRef = useRef(0)

  const rawEndRef        = useRef<HTMLDivElement>(null)
  const txEndRef         = useRef<HTMLDivElement>(null)
  const sessionIdRef     = useRef<string | null>(null)
  const sessionStartRef  = useRef<number>(0)

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

  // Check permission when switching to system mode, and re-check when window regains focus
  useEffect(() => {
    if (audioMode === 'system') {
      checkScreenPermission()
    }
  }, [audioMode, checkScreenPermission])

  useEffect(() => {
    if (audioMode !== 'system' || !isMac) return
    const onFocus = () => checkScreenPermission()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [audioMode, isMac, checkScreenPermission])

  // biome-ignore lint/correctness/useExhaustiveDependencies: rawTranscript.length is the intentional trigger
  useEffect(() => { rawEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [rawTranscript.length])
  // biome-ignore lint/correctness/useExhaustiveDependencies: translation.length is the intentional trigger
  useEffect(() => { txEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [translation.length])

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
    } catch { /* skip */ }
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
    // A CHUNK_DURATION_MS=3s clip cannot physically contain more than
    // MAX_WORDS_PER_CHUNK words of real speech. Anything beyond that is very
    // likely Whisper drifting and filling in content that isn't in the audio.
    const wordCountGuard = newText.split(/\s+/).filter(Boolean).length
    if (wordCountGuard > MAX_WORDS_PER_CHUNK) return

    // ── Words-per-second rate guard ───────────────────────────────────────
    // Independently validates that the density of words is physically possible.
    // MAX_WORDS_PER_SEC=7 is well above the fastest natural speech (~5 w/s).
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
      jaccardSimilarity(normNew, normLast) > 0.82
    )) return
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
        // Speech detected — reset silence counter and queue the chunk
        silentChunkCountRef.current = 0
        queueRef.current = queueRef.current.then(() => processChunk(blob, recMime))
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
    setMicError(null)
    setShowSummaryBtn(false)
    setSummary(null)
    // Generate a new session ID for this recording session
    sessionIdRef.current = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    sessionStartRef.current = Date.now()

    try {
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512

      let captureStream: MediaStream

      if (audioMode === 'system') {
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

      if (result.success && result.reply) {
        setSummary(result.reply)
        // Update the saved session with the summary
        if (sessionIdRef.current) {
          updateLiveSession(sessionIdRef.current, { summary: result.reply })
        }
      }
    } catch { /* ignore */ }
    finally { setIsSummarizing(false) }
  }, [updateLiveSession])

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
      try { audioCtxRef.current?.close() } catch {}
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop()
      }
      // Close the OS subtitle window when leaving the page
      window.api.subtitle.hide()
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
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm cursor-pointer'
              : (!hasOpenAIKey || !hasAnyKey)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm cursor-pointer',
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

      {/* System audio hint — shown when 'System' mode is selected & NOT yet granted permission */}
      {audioMode === 'system' && !isActive && isMac && screenPermission !== 'granted' && (
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
                           transition-all duration-200 shadow-sm flex-shrink-0"
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
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t.live_clear}
          </button>
        )}

        {/* Subtitle toggle + settings */}
        <div className="relative flex items-center gap-1">
          {/* Toggle button */}
          <button
            type="button"
            onClick={() => { setShowSubtitles(v => !v); setShowSubtitleConfig(false) }}
            title={showSubtitles ? 'Ẩn subtitles nổi' : 'Hiện subtitles nổi trên màn hình'}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none',
              showSubtitles
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30',
            ].join(' ')}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <path strokeLinecap="round" d="M7 12h4M7 15h2M13 12h4M13 15h2" />
            </svg>
            Subtitles
          </button>

          {/* Settings gear — only visible when subtitles are on */}
          {showSubtitles && (
            <button
              type="button"
              onClick={() => setShowSubtitleConfig(v => !v)}
              title="Tuỳ chỉnh subtitle"
              className={[
                'p-1.5 rounded-lg transition-all duration-150 cursor-pointer',
                showSubtitleConfig
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
                  : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30',
              ].join(' ')}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {/* Settings popover */}
          {showSubtitleConfig && (
            <div className="absolute bottom-full mb-2 left-0 z-50 w-64
                            bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                            rounded-xl shadow-xl p-3 flex flex-col gap-3 select-none">

              {/* Màu chữ */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">Màu chữ</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'Trắng',  value: '#ffffff' },
                    { label: 'Vàng',   value: '#fde047' },
                    { label: 'Lam',    value: '#22d3ee' },
                    { label: 'Xanh',   value: '#4ade80' },
                    { label: 'Cam',    value: '#fb923c' },
                    { label: 'Hồng',   value: '#f472b6' },
                  ].map(({ label, value }) => (
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

              {/* Kích cỡ chữ */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                  Kích cỡ chữ — {subtitleSettings.fontSize}px
                </p>
                <div className="flex gap-1">
                  {([14, 18, 22, 28, 34] as const).map((size, i) => {
                    const labels = ['S', 'M', 'L', 'XL', '2X']
                    return (
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
                        {labels[i]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Độ mờ nền */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                  Độ mờ nền — {subtitleSettings.bgOpacity}%
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
                  <span>Trong suốt</span>
                  <span>Đục</span>
                </div>
              </div>

              {/* Reset */}
              <button
                type="button"
                onClick={() => setSubtitleSettings({ textColor: '#ffffff', fontSize: 18, bgOpacity: 84 })}
                className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer text-center transition-colors"
              >
                Đặt lại mặc định
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
      <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
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

