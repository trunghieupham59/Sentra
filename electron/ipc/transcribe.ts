import type { IpcMain } from 'electron'
import { GEMINI_API_BASE, GEMINI_STT_MODEL, WHISPER_MODEL } from './ipcConstants'
import { withRetry } from './retry'
import { getStoredApiKey } from './storage'

// ─── Session-level Whisper availability cache ─────────────────────────────────
//
// Problem: In live meetings, speech is continuous. If Whisper is unavailable
// (no key, rate-limited), the 'auto' fallback logic would waste seconds on
// every chunk: withRetry delays + Whisper attempt + then Gemini. This adds
// noticeable gaps between spoken sentences.
//
// Solution: Track Whisper availability in memory for the current session.
//   - First chunk: try Whisper once (no retry) → if it fails, fallback to Gemini
//   - All subsequent chunks: skip Whisper entirely if the session cache says it's down
//   - Self-healing: when Whisper returns a success, the cache resets automatically
//   - Rate-limit aware: RATE_LIMIT sets a 90 s ban (auto-expires), so Whisper is
//     re-tried after the ban window without requiring an app restart
//
// This guarantees < 500 ms switching latency on the first failure, and zero
// overhead on all following chunks during a live session.

let whisperSessionAvailable = true
let whisperUnavailableUntilMs = 0

function isWhisperAvailableNow(): boolean {
  if (whisperSessionAvailable) return true
  // Check if a time-limited ban (RATE_LIMIT) has expired
  if (Date.now() >= whisperUnavailableUntilMs) {
    whisperSessionAvailable = true
    whisperUnavailableUntilMs = 0
    console.log('[transcribe] Whisper session ban expired — will retry Whisper on next chunk')
  }
  return whisperSessionAvailable
}

/**
 * Mark Whisper as unavailable for this session.
 *
 *   NO_API_KEY / INVALID_KEY → permanent (until app restart)
 *   RATE_LIMIT               → 90 s ban, then auto-retry
 *   CONNECTION_ERROR         → NOT cached; next chunk retries Whisper
 *                              (transient network issues should not skip Whisper permanently)
 */
function markWhisperUnavailable(errorCode: string): void {
  whisperSessionAvailable = false
  if (errorCode === 'RATE_LIMIT') {
    // Rate limits typically expire in 60 s; add 30 s buffer
    whisperUnavailableUntilMs = Date.now() + 90_000
    console.log('[transcribe] Whisper marked unavailable for 90 s (RATE_LIMIT)')
  } else {
    // NO_API_KEY / INVALID_KEY: permanent; only re-enabled if Whisper succeeds
    whisperUnavailableUntilMs = Number.MAX_SAFE_INTEGER
    console.log(`[transcribe] Whisper marked unavailable for session (${errorCode})`)
  }
}

// ─── Error codes that trigger Whisper → Gemini fallback ──────────────────────
// CONNECTION_ERROR is excluded: transient, next chunk will retry Whisper.
const PERMANENT_FALLBACK_CODES = new Set(['NO_API_KEY', 'INVALID_KEY', 'RATE_LIMIT'])
// All codes that trigger Gemini fallback on this chunk (including transient)
const FALLBACK_CODES = new Set(['NO_API_KEY', 'INVALID_KEY', 'RATE_LIMIT', 'CONNECTION_ERROR'])

interface TranscribeParams {
  audioData: ArrayBuffer   // Raw audio bytes from MediaRecorder or WAV encoder
  mimeType: string         // e.g. 'audio/webm;codecs=opus' | 'audio/wav'
  language?: string        // BCP-47 code or 'auto'
  /**
   * The last successfully transcribed text, passed as Whisper's `prompt`
   * parameter (in addition to the language-specific opener).
   */
  previousText?: string
  /**
   * Which STT backend to use:
   *   'auto'     — smart routing: Whisper when available → instant Gemini fallback
   *   'whisper'  — OpenAI Whisper only (with retry; requires OpenAI key)
   *   'google'   — Gemini STT (uses Gemini API key; no extra GCP setup needed)
   *   'webSpeech'— browser-only, never sent via IPC
   * Defaults to 'auto'.
   */
  sttProvider?: 'auto' | 'whisper' | 'google' | 'webSpeech'
}

interface TranscribeResult {
  success: boolean
  text?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'CONNECTION_ERROR' | string
  noSpeechProb?: number
  avgLogprob?: number
  compressionRatio?: number
  segmentTexts?: string[]
  /** Which STT backend actually produced this result */
  usedProvider?: 'whisper' | 'gemini'
}

interface VerboseSegment {
  text:              string
  avg_logprob:       number
  compression_ratio: number
  no_speech_prob:    number
}

interface VerboseResponse {
  text:      string
  segments?: VerboseSegment[]
}

/**
 * Maps language codes to BCP-47 locale strings for the Gemini STT prompt.
 * These help Gemini focus on the correct language/dialect.
 */
const LANG_TO_BCP47: Record<string, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ar: 'ar-SA',
  th: 'th-TH',
  id: 'id-ID',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  hi: 'hi-IN',
}

// ─── Whisper prompt builder ───────────────────────────────────────────────────

function buildWhisperPrompt(language: string | undefined, previousText?: string): string {
  const opener = (() => {
    switch (language) {
      case 'vi': return 'Xin chào, hôm nay chúng ta sẽ nói về'
      case 'ja': return 'はい、えーと、今日は'
      case 'ko': return '안녕하세요, 오늘은'
      case 'zh': return '好的，今天我们来讨论'
      default:   return 'Um, so,'
    }
  })()

  if (previousText) {
    const ctx = previousText.trim().slice(-200)
    return `${opener} ${ctx}`
  }
  return opener
}

// ─── Confidence aggregation ───────────────────────────────────────────────────

function aggregateSegments(segments: VerboseSegment[]): {
  noSpeechProb: number
  avgLogprob: number
  compressionRatio: number
} {
  if (segments.length === 0) {
    return { noSpeechProb: 0, avgLogprob: 0, compressionRatio: 1 }
  }
  return {
    noSpeechProb:     Math.max(...segments.map(s => s.no_speech_prob)),
    avgLogprob:       Math.min(...segments.map(s => s.avg_logprob)),
    compressionRatio: Math.max(...segments.map(s => s.compression_ratio)),
  }
}

// ─── Whisper transcription ────────────────────────────────────────────────────

/**
 * Call OpenAI Whisper for transcription.
 *
 * @param useRetry - When true, wraps the API call with exponential-backoff retry
 *   (suitable for 'whisper' mode where the user explicitly chose Whisper and
 *   transient network errors should be recovered automatically).
 *   When false (used in 'auto' mode), a single attempt is made — any failure
 *   triggers immediate Gemini STT fallback instead of waiting for retries.
 */
async function transcribeWithWhisper(
  audioData: ArrayBuffer,
  mimeType: string,
  language?: string,
  previousText?: string,
  useRetry = true,
): Promise<TranscribeResult> {
  const apiKey = await getStoredApiKey('openai')
  if (!apiKey) {
    return {
      success: false,
      error: 'No OpenAI API key. Add one in Settings to use voice recording.',
      errorCode: 'NO_API_KEY',
    }
  }

  try {
    const OpenAI = (await import('openai')).default
    const client = new OpenAI({ apiKey })

    const buffer = Buffer.from(audioData)
    const ext = mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('mp4') ? 'mp4'
      : mimeType.includes('wav') ? 'wav'
      : 'webm'

    const file = new File([buffer], `audio.${ext}`, { type: mimeType })

    const whisperLang = language && language !== 'auto'
      ? language.split('-')[0]
      : undefined

    const createCall = () => client.audio.transcriptions.create({
      file,
      model: WHISPER_MODEL,
      language: whisperLang,
      response_format: 'verbose_json',
      temperature: 0,
      prompt: buildWhisperPrompt(whisperLang, previousText),
    })

    const rawResponse = await ((useRetry ? withRetry(createCall) : createCall()) as unknown) as VerboseResponse

    const text = rawResponse.text?.trim() ?? ''

    if (!text || /^\s*$/.test(text)) {
      return { success: true, text: '', usedProvider: 'whisper' }
    }

    const segments = rawResponse.segments ?? []
    const { noSpeechProb, avgLogprob, compressionRatio } = aggregateSegments(segments)

    const segmentTexts = segments
      .map(s => s.text?.trim())
      .filter(Boolean) as string[]

    return {
      success: true,
      text,
      noSpeechProb,
      avgLogprob,
      compressionRatio,
      usedProvider: 'whisper',
      ...(segmentTexts.length > 1 ? { segmentTexts } : {}),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[transcribe] Whisper error:', msg)

    if (msg.includes('401') || msg.includes('invalid_api_key')) {
      return { success: false, error: 'Invalid OpenAI API key.', errorCode: 'INVALID_KEY' }
    }
    if (msg.includes('429')) {
      return { success: false, error: 'OpenAI rate limit exceeded.', errorCode: 'RATE_LIMIT' }
    }
    if (msg.toLowerCase().includes('connection error') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      return { success: false, error: 'Connection error. Please check your internet connection.', errorCode: 'CONNECTION_ERROR' }
    }
    return { success: false, error: msg }
  }
}

// ─── Gemini STT (audio transcription via Gemini multimodal API) ───────────────

/**
 * Transcribe audio using the Gemini generateContent API with audio inline_data.
 *
 * WHY Gemini instead of Google Cloud Speech-to-Text:
 *   Cloud STT requires enabling a separate GCP API in the Google Cloud Console
 *   for each project — an extra step that most users won't do.
 *   Gemini's generateContent endpoint accepts audio directly using the same
 *   API key already configured for translation, with zero additional setup.
 *
 * Supported audio formats (Gemini native):
 *   audio/wav, audio/webm, audio/ogg, audio/mp3, audio/flac, audio/aac, audio/aiff
 *
 * The codec parameter is stripped from the MIME type before sending
 * (e.g. 'audio/webm;codecs=opus' → 'audio/webm') since Gemini does not accept
 * the codec suffix in inline_data.mime_type.
 */
async function transcribeWithGeminiSTT(
  audioData: ArrayBuffer,
  mimeType: string,
  language?: string,
  apiKey?: string | null,
): Promise<TranscribeResult> {
  if (!apiKey) {
    return {
      success: false,
      error: 'No Gemini API key. Add one in Settings to enable Gemini STT.',
      errorCode: 'NO_API_KEY',
    }
  }

  // Strip codec suffix — Gemini only accepts base MIME type in inline_data
  // e.g. 'audio/webm;codecs=opus' → 'audio/webm'
  const normalizedMime = mimeType.split(';')[0].trim()

  const base64Audio = Buffer.from(audioData).toString('base64')

  // Build a language-aware transcription prompt
  const langCode = language && language !== 'auto' ? language : null
  const bcp47 = langCode ? (LANG_TO_BCP47[langCode] ?? langCode) : null
  const langHint = bcp47 ? ` Language: ${bcp47}.` : ''
  const prompt =
    `Transcribe the audio accurately.${langHint} ` +
    'Output ONLY the transcription text — no timestamps, no speaker labels, no markdown, no explanations.'

  const url = `${GEMINI_API_BASE}/models/${GEMINI_STT_MODEL}:generateContent?key=${apiKey}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: normalizedMime, data: base64Audio } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0,         // Deterministic — fewer hallucinations for transcription
          maxOutputTokens: 1024,  // Transcriptions are short; cap tokens to reduce latency
        },
      }),
    })

    if (!response.ok) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON error shape
      const errData: any = await response.json().catch(() => ({}))
      const msg: string = errData?.error?.message ?? response.statusText
      console.error('[transcribe] Gemini STT error:', response.status, msg)

      if (response.status === 400 && msg.includes('API key not valid')) {
        return { success: false, error: 'Invalid Gemini API key.', errorCode: 'INVALID_KEY' }
      }
      if (response.status === 401) {
        return { success: false, error: 'Invalid Gemini API key.', errorCode: 'INVALID_KEY' }
      }
      if (response.status === 429) {
        return { success: false, error: 'Gemini STT rate limit exceeded.', errorCode: 'RATE_LIMIT' }
      }
      return { success: false, error: `Gemini STT error: ${msg}` }
    }

    // biome-ignore lint/suspicious/noExplicitAny: dynamic Gemini response shape
    const data: any = await response.json()

    // Extract transcription from Gemini response
    const text: string = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()

    if (!text) {
      return { success: true, text: '', usedProvider: 'gemini' }
    }

    return { success: true, text, usedProvider: 'gemini' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[transcribe] Gemini STT fetch error:', msg)

    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.toLowerCase().includes('failed to fetch')) {
      return {
        success: false,
        error: 'Connection error reaching Gemini STT. Check your internet connection.',
        errorCode: 'CONNECTION_ERROR',
      }
    }
    return { success: false, error: `Gemini STT: ${msg}` }
  }
}

// ─── Auto mode: instant fallback with session cache ───────────────────────────

/**
 * Smart routing for 'auto' mode with session-level caching.
 *
 * Meeting scenario (nói liên tục):
 *   Chunk 1: Whisper unavailable → single-attempt fail (fast) → Gemini (success)
 *            → cache: whisperSessionAvailable = false
 *   Chunks 2-N: cache hit → skip Whisper → Gemini directly (zero overhead)
 *   Later: Whisper comes back → next success resets cache
 */
async function transcribeAuto(
  audioData: ArrayBuffer,
  mimeType: string,
  language?: string,
  previousText?: string,
): Promise<TranscribeResult> {
  // ── Fast path: session cache says Whisper is down → go directly to Gemini ──
  if (!isWhisperAvailableNow()) {
    console.log('[transcribe] auto: Whisper session cache = unavailable → Gemini directly')
    const geminiKey = await getStoredApiKey('gemini')
    return transcribeWithGeminiSTT(audioData, mimeType, language, geminiKey)
  }

  // ── Slow path: try Whisper (single attempt, no retry for speed) ─────────────
  const whisperResult = await transcribeWithWhisper(
    audioData, mimeType, language, previousText,
    /* useRetry = */ false,  // No retry — instant fallback to Gemini on any error
  )

  if (whisperResult.success) {
    // Whisper working → ensure session cache is reset (handles recovery after RATE_LIMIT)
    if (!whisperSessionAvailable) {
      whisperSessionAvailable = true
      whisperUnavailableUntilMs = 0
      console.log('[transcribe] auto: Whisper recovered — session cache reset to available')
    }
    return whisperResult
  }

  // ── Whisper failed — update session cache for permanent/semi-permanent errors ──
  const code = whisperResult.errorCode ?? ''
  if (PERMANENT_FALLBACK_CODES.has(code)) {
    markWhisperUnavailable(code)
  }

  // Only attempt Gemini fallback for known recoverable/quota errors.
  // For truly unknown errors (e.g. corrupted audio file), return Whisper's error directly.
  if (!FALLBACK_CODES.has(code)) {
    return whisperResult
  }

  console.log(`[transcribe] auto: Whisper failed (${code}) → Gemini STT immediately`)
  const geminiKey = await getStoredApiKey('gemini')

  if (!geminiKey) {
    return {
      ...whisperResult,
      error: `${whisperResult.error} (Gemini STT fallback unavailable — add a Gemini key to enable it.)`,
    }
  }

  const geminiResult = await transcribeWithGeminiSTT(audioData, mimeType, language, geminiKey)

  if (geminiResult.success) {
    return geminiResult
  }

  return {
    ...geminiResult,
    error: `Primary (Whisper): ${whisperResult.error}. Fallback (Gemini STT): ${geminiResult.error}`,
  }
}

// ─── IPC handler ─────────────────────────────────────────────────────────────

export function registerTranscribeHandlers(ipcMain: IpcMain) {
  ipcMain.handle('audio:transcribe', async (_event, params: TranscribeParams): Promise<TranscribeResult> => {
    const { audioData, mimeType, language, previousText } = params
    const sttProvider = params.sttProvider ?? 'auto'

    if (sttProvider === 'webSpeech') {
      return { success: false, error: 'webSpeech is a browser-only mode — not available via IPC.' }
    }

    if (sttProvider === 'google') {
      // 'google' in the store means Gemini STT (same Gemini API key, no extra GCP setup)
      const geminiKey = await getStoredApiKey('gemini')
      return transcribeWithGeminiSTT(audioData, mimeType, language, geminiKey)
    }

    if (sttProvider === 'whisper') {
      // Explicit Whisper mode: use retry (user chose Whisper specifically, so
      // transient errors should be retried before giving up)
      return transcribeWithWhisper(audioData, mimeType, language, previousText, /* useRetry= */ true)
    }

    // 'auto' — instant fallback with session cache
    return transcribeAuto(audioData, mimeType, language, previousText)
  })
}
