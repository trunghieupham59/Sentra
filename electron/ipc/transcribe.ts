import type { IpcMain } from 'electron'
import {
  GEMINI_API_BASE, GEMINI_STT_MODEL,
  GROQ_API_BASE, GROQ_STT_MODEL,
  WHISPER_MODEL, WHISPER_RATE_LIMIT_BAN_MS,
} from './ipcConstants'
import { withRetry } from './retry'
import { getStoredApiKey, hasStoredApiKey } from './storage'

// ─── Session-level availability cache ────────────────────────────────────────
//
// Problem: In live meetings, speech is continuous. If a provider is unavailable
// (no key, rate-limited), the 'auto' fallback logic would waste seconds on
// every chunk: withRetry delays + failed attempt + then next provider.
// This adds noticeable gaps between spoken sentences.
//
// Solution: Track each provider's availability in memory for the current session.
//   - First chunk: try provider once (no retry) → if it fails, fallback to next
//   - All subsequent chunks: skip provider if the session cache says it's down
//   - Self-healing: when a provider returns a success, the cache resets
//   - Rate-limit aware: RATE_LIMIT sets a WHISPER_RATE_LIMIT_BAN_MS ban (auto-expires),
//     so Whisper is re-tried after the ban window without requiring an app restart
//
// Pre-flight (checkSttProviders) also pre-warms the cache on session open, so
// the VERY FIRST chunk already goes to the best available backend — zero wasted attempts.

let whisperSessionAvailable = true
let whisperUnavailableUntilMs = 0

function isWhisperAvailableNow(): boolean {
  if (whisperSessionAvailable) return true
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
 *   NO_API_KEY / INVALID_KEY → permanent (until app restart or key change)
 *   RATE_LIMIT               → WHISPER_RATE_LIMIT_BAN_MS ban, then auto-retry
 *   CONNECTION_ERROR         → NOT cached; next chunk retries Whisper
 *                              (transient network issues should not skip Whisper permanently)
 */
function markWhisperUnavailable(errorCode: string): void {
  whisperSessionAvailable = false
  if (errorCode === 'RATE_LIMIT') {
    whisperUnavailableUntilMs = Date.now() + WHISPER_RATE_LIMIT_BAN_MS
    console.log(`[transcribe] Whisper marked unavailable for ${WHISPER_RATE_LIMIT_BAN_MS / 1000} s (RATE_LIMIT)`)
  } else {
    whisperUnavailableUntilMs = Number.MAX_SAFE_INTEGER
    console.log(`[transcribe] Whisper marked unavailable for session (${errorCode})`)
  }
}

// ─── Error codes that trigger fallback behaviour ──────────────────────────────
// CONNECTION_ERROR is excluded from permanent codes: transient, next chunk retries.
const PERMANENT_FALLBACK_CODES = new Set(['NO_API_KEY', 'INVALID_KEY', 'RATE_LIMIT'])
// All codes that trigger next-provider fallback on this chunk (including transient)
const FALLBACK_CODES = new Set(['NO_API_KEY', 'INVALID_KEY', 'RATE_LIMIT', 'CONNECTION_ERROR'])

// ─── Shared types ─────────────────────────────────────────────────────────────

interface TranscribeParams {
  audioData: ArrayBuffer   // Raw audio bytes from MediaRecorder or WAV encoder
  mimeType: string         // e.g. 'audio/webm;codecs=opus' | 'audio/wav'
  language?: string        // BCP-47 code or 'auto'
  /**
   * The last successfully transcribed text, passed as Whisper's `prompt`
   * parameter. Whisper treats it as "speech already in progress", maintaining
   * terminology consistency across chunks and preventing decoder drift.
   */
  previousText?: string
  /**
   * Which STT backend to use:
   *   'auto'      — smart routing: Whisper → Gemini STT → Groq (free) → surface error
   *   'whisper'   — OpenAI Whisper only (with retry; requires OpenAI key)
   *   'google'    — Gemini STT (uses Gemini API key; no extra GCP setup needed)
   *   'webSpeech' — browser-only, never sent via IPC
   * Defaults to 'auto'.
   */
  sttProvider?: 'auto' | 'whisper' | 'google' | 'groq' | 'webSpeech'
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
  usedProvider?: 'whisper' | 'gemini' | 'groq'
}

interface SttProviderCheckResult {
  primary: 'whisper' | 'gemini' | 'groq' | 'none'
  available: Array<'whisper' | 'gemini' | 'groq'>
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

// ─── Language code map (Gemini STT prompt localisation) ───────────────────────
// Maps app language codes → BCP-47 locale strings for the Gemini STT prompt.
// These help Gemini focus on the correct language/dialect.
// Kept as a local constant because this is a main-process file and cannot import
// from the renderer-side src/constants/audio.ts (different bundle).
const LANG_TO_BCP47: Record<string, string> = {
  vi: 'vi-VN', en: 'en-US', zh: 'zh-CN', 'zh-TW': 'zh-TW',
  ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', de: 'de-DE',
  es: 'es-ES', pt: 'pt-BR', ru: 'ru-RU', ar: 'ar-SA',
  th: 'th-TH', id: 'id-ID', it: 'it-IT', nl: 'nl-NL',
  pl: 'pl-PL', tr: 'tr-TR', hi: 'hi-IN',
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

// ─── Confidence aggregation (Whisper verbose_json segments) ──────────────────

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

// ─── Whisper (OpenAI) ─────────────────────────────────────────────────────────

/**
 * Call OpenAI Whisper for transcription.
 *
 * @param useRetry — When true, wraps the call with exponential-backoff retry
 *   (suitable for 'whisper' mode where the user explicitly chose Whisper and
 *   transient errors should be recovered automatically).
 *   When false (used in 'auto' mode), a single attempt is made — any failure
 *   triggers immediate fallback to the next provider.
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
    return { success: false, error: 'No OpenAI API key. Add one in Settings.', errorCode: 'NO_API_KEY' }
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
    const whisperLang = language && language !== 'auto' ? language.split('-')[0] : undefined

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
    const segmentTexts = segments.map(s => s.text?.trim()).filter(Boolean) as string[]

    return {
      success: true, text, noSpeechProb, avgLogprob, compressionRatio,
      usedProvider: 'whisper',
      ...(segmentTexts.length > 1 ? { segmentTexts } : {}),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[transcribe] Whisper error:', msg)
    if (msg.includes('401') || msg.includes('invalid_api_key'))
      return { success: false, error: 'Invalid OpenAI API key.', errorCode: 'INVALID_KEY' }
    if (msg.includes('429'))
      return { success: false, error: 'OpenAI rate limit exceeded.', errorCode: 'RATE_LIMIT' }
    if (msg.toLowerCase().includes('connection error') || msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED'))
      return { success: false, error: 'Connection error.', errorCode: 'CONNECTION_ERROR' }
    return { success: false, error: msg }
  }
}

// ─── Gemini STT ───────────────────────────────────────────────────────────────

/**
 * Transcribe audio using the Gemini generateContent API with audio inline_data.
 *
 * WHY Gemini instead of Google Cloud Speech-to-Text:
 *   Cloud STT requires enabling a separate GCP API in the Google Cloud Console.
 *   Gemini's generateContent endpoint accepts audio directly using the same API key
 *   already configured for translation — zero additional setup.
 *
 * Supported audio formats (Gemini native):
 *   audio/wav, audio/webm, audio/ogg, audio/mp3, audio/flac, audio/aac, audio/aiff
 *
 * The codec parameter is stripped before sending (e.g. 'audio/webm;codecs=opus' → 'audio/webm')
 * since Gemini does not accept the codec suffix in inline_data.mime_type.
 */
async function transcribeWithGeminiSTT(
  audioData: ArrayBuffer,
  mimeType: string,
  language?: string,
  apiKey?: string | null,
): Promise<TranscribeResult> {
  if (!apiKey) {
    return { success: false, error: 'No Gemini API key. Add one in Settings.', errorCode: 'NO_API_KEY' }
  }

  const normalizedMime = mimeType.split(';')[0].trim()
  const base64Audio = Buffer.from(audioData).toString('base64')

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
        generationConfig: { temperature: 0, maxOutputTokens: 1024 },
      }),
    })

    if (!response.ok) {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic JSON error shape
      const errData: any = await response.json().catch(() => ({}))
      const msg: string = errData?.error?.message ?? response.statusText
      console.error('[transcribe] Gemini STT error:', response.status, msg)
      if ((response.status === 400 && msg.includes('API key not valid')) || response.status === 401)
        return { success: false, error: 'Invalid Gemini API key.', errorCode: 'INVALID_KEY' }
      if (response.status === 429)
        return { success: false, error: 'Gemini STT rate limit exceeded.', errorCode: 'RATE_LIMIT' }
      return { success: false, error: `Gemini STT error: ${msg}` }
    }

    // biome-ignore lint/suspicious/noExplicitAny: dynamic Gemini response shape
    const data: any = await response.json()
    const text: string = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
    if (!text) return { success: true, text: '', usedProvider: 'gemini' }
    return { success: true, text, usedProvider: 'gemini' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[transcribe] Gemini STT fetch error:', msg)
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.toLowerCase().includes('failed to fetch'))
      return { success: false, error: 'Connection error reaching Gemini STT.', errorCode: 'CONNECTION_ERROR' }
    return { success: false, error: `Gemini STT: ${msg}` }
  }
}

// ─── Groq STT (free fallback — OpenAI-compatible) ────────────────────────────

/**
 * Transcribe audio using the Groq API (Whisper-compatible endpoint).
 *
 * Groq uses the exact same OpenAI SDK format — only the baseURL and model differ.
 * No new SDK needed: we reuse the openai package already bundled with the app.
 *
 * Free tier: ~28,800 audio seconds / day.  No credit card required.
 * Register at console.groq.com and add the key in Settings → STT.
 *
 * verbose_json is supported and returns the same confidence signals as OpenAI Whisper,
 * so the same confidence gates in processChunk apply without any changes.
 */
async function transcribeWithGroq(
  audioData: ArrayBuffer,
  mimeType: string,
  language?: string,
  previousText?: string,
): Promise<TranscribeResult> {
  const apiKey = await getStoredApiKey('groq')
  if (!apiKey) {
    return { success: false, error: 'No Groq API key configured.', errorCode: 'NO_API_KEY' }
  }

  try {
    const OpenAI = (await import('openai')).default
    // Reuse the OpenAI SDK — only the baseURL changes.
    // apiKey is required by the SDK constructor even though Groq uses bearer auth;
    // the SDK passes it as Authorization: Bearer <apiKey> which Groq accepts.
    const client = new OpenAI({ apiKey, baseURL: GROQ_API_BASE })

    const buffer = Buffer.from(audioData)
    const ext = mimeType.includes('ogg') ? 'ogg'
      : mimeType.includes('mp4') ? 'mp4'
      : mimeType.includes('wav') ? 'wav'
      : 'webm'

    const file = new File([buffer], `audio.${ext}`, { type: mimeType })
    const groqLang = language && language !== 'auto' ? language.split('-')[0] : undefined

    // Single attempt, no retry — used as a fallback, want fast response.
    const rawResponse = await client.audio.transcriptions.create({
      file,
      model: GROQ_STT_MODEL,
      language: groqLang,
      response_format: 'verbose_json',
      temperature: 0,
      prompt: buildWhisperPrompt(groqLang, previousText),
      // biome-ignore lint/suspicious/noExplicitAny: Groq verbose_json not yet typed in openai SDK
    }) as any

    const text: string = (rawResponse.text ?? '').trim()
    if (!text || /^\s*$/.test(text)) {
      return { success: true, text: '', usedProvider: 'groq' }
    }

    const segments: VerboseSegment[] = rawResponse.segments ?? []
    const { noSpeechProb, avgLogprob, compressionRatio } = aggregateSegments(segments)
    const segmentTexts = segments.map((s: VerboseSegment) => s.text?.trim()).filter(Boolean) as string[]

    return {
      success: true, text, noSpeechProb, avgLogprob, compressionRatio,
      usedProvider: 'groq',
      ...(segmentTexts.length > 1 ? { segmentTexts } : {}),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[transcribe] Groq STT error:', msg)
    if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('Unauthorized'))
      return { success: false, error: 'Invalid Groq API key.', errorCode: 'INVALID_KEY' }
    if (msg.includes('429'))
      return { success: false, error: 'Groq rate limit exceeded.', errorCode: 'RATE_LIMIT' }
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.toLowerCase().includes('connection error'))
      return { success: false, error: 'Connection error reaching Groq STT.', errorCode: 'CONNECTION_ERROR' }
    return { success: false, error: `Groq STT: ${msg}` }
  }
}

// ─── Auto mode: smart routing with session cache ───────────────────────────────

/**
 * Smart routing for 'auto' mode: Whisper → Gemini STT → Groq STT.
 *
 * Session cache ensures the first chunk latency is minimal:
 *   - If pre-flight (checkSttProviders) already set whisperSessionAvailable = false,
 *     Gemini or Groq is tried directly without any Whisper attempt.
 *   - If Whisper fails mid-session, the cache is updated and subsequent chunks
 *     skip to the next available provider instantly.
 *
 * Meeting scenario (continuous speech):
 *   Chunk 1: Whisper unavailable → instant fail → Gemini (success)
 *            → cache: whisperSessionAvailable = false
 *   Chunks 2-N: cache hit → skip Whisper → Gemini directly (zero overhead)
 *   Later: Whisper recovers → next success resets cache
 */
async function transcribeAuto(
  audioData: ArrayBuffer,
  mimeType: string,
  language?: string,
  previousText?: string,
): Promise<TranscribeResult> {
  // ── Step 1: Whisper (with session cache) ─────────────────────────────────────
  if (!isWhisperAvailableNow()) {
    console.log('[transcribe] auto: Whisper session cache = unavailable → skip to Gemini')
  } else {
    const whisperResult = await transcribeWithWhisper(
      audioData, mimeType, language, previousText,
      /* useRetry = */ false,  // No retry — instant fallback to next provider on any error
    )

    if (whisperResult.success) {
      // Whisper working → reset cache if it was previously marked down (recovery)
      if (!whisperSessionAvailable) {
        whisperSessionAvailable = true
        whisperUnavailableUntilMs = 0
        console.log('[transcribe] auto: Whisper recovered — session cache reset')
      }
      return whisperResult
    }

    const code = whisperResult.errorCode ?? ''
    if (PERMANENT_FALLBACK_CODES.has(code)) markWhisperUnavailable(code)

    // For unknown errors (e.g. corrupted audio), return Whisper's error directly
    // rather than trying providers that won't help with corrupted data.
    if (!FALLBACK_CODES.has(code)) return whisperResult

    console.log(`[transcribe] auto: Whisper failed (${code}) → Gemini STT`)
  }

  // ── Step 2: Gemini STT ────────────────────────────────────────────────────────
  const geminiKey = await getStoredApiKey('gemini')

  if (geminiKey) {
    const geminiResult = await transcribeWithGeminiSTT(audioData, mimeType, language, geminiKey)
    if (geminiResult.success) return geminiResult

    const geminiCode = geminiResult.errorCode ?? ''
    if (FALLBACK_CODES.has(geminiCode)) {
      console.log(`[transcribe] auto: Gemini STT failed (${geminiCode}) → Groq STT`)
    } else {
      return geminiResult  // non-recoverable error from Gemini
    }
  } else {
    console.log('[transcribe] auto: No Gemini key → skip to Groq STT')
  }

  // ── Step 3: Groq STT (free fallback) ─────────────────────────────────────────
  const groqKey = await getStoredApiKey('groq')

  if (!groqKey) {
    return {
      success: false,
      error: 'All STT providers exhausted. Add a Groq API key (free) in Settings → STT to enable the final fallback.',
    }
  }

  return transcribeWithGroq(audioData, mimeType, language, previousText)
}

// ─── Pre-flight: check provider availability ──────────────────────────────────

/**
 * Check which STT providers are configured and pre-warm the session cache.
 *
 * Called before opening a Live Translate session so the pipeline knows
 * immediately which provider to use on the first audio chunk.
 *
 * Uses `hasStoredApiKey` (checks key existence in keychain metadata without
 * decryption — instant, no API calls, no cost) rather than live API probes.
 * Key validity is discovered naturally on first real transcription call.
 *
 * Side effect: pre-warms `whisperSessionAvailable` so the first audio chunk
 * goes directly to the best available provider without any Whisper attempt.
 */
async function checkSttProviders(): Promise<SttProviderCheckResult> {
  const hasOpenAI = hasStoredApiKey('openai')
  const hasGemini = hasStoredApiKey('gemini')
  const hasGroq   = hasStoredApiKey('groq')

  const available: Array<'whisper' | 'gemini' | 'groq'> = []
  if (hasOpenAI) available.push('whisper')
  if (hasGemini) available.push('gemini')
  if (hasGroq)   available.push('groq')

  const primary = available[0] ?? 'none'

  // ── Pre-warm session cache ────────────────────────────────────────────────
  // If Whisper is not configured, mark it unavailable now so the first real
  // audio chunk goes directly to Gemini/Groq without a wasted Whisper attempt.
  if (!hasOpenAI && whisperSessionAvailable) {
    whisperSessionAvailable   = false
    whisperUnavailableUntilMs = Number.MAX_SAFE_INTEGER
    console.log('[transcribe] pre-flight: no OpenAI key → Whisper pre-marked unavailable for session')
  } else if (hasOpenAI && !whisperSessionAvailable) {
    // Key was added since last check — reset cache so Whisper is retried
    whisperSessionAvailable   = true
    whisperUnavailableUntilMs = 0
    console.log('[transcribe] pre-flight: OpenAI key present → Whisper session cache reset to available')
  }

  console.log(`[transcribe] pre-flight: primary=${primary} available=[${available.join(', ')}]`)
  return { primary, available }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

export function registerTranscribeHandlers(ipcMain: IpcMain) {
  ipcMain.handle('audio:transcribe', async (_event, params: TranscribeParams): Promise<TranscribeResult> => {
    const { audioData, mimeType, language, previousText } = params
    const sttProvider = params.sttProvider ?? 'auto'

    if (sttProvider === 'webSpeech') {
      // webSpeech uses webkitSpeechRecognition in the renderer — never reaches IPC.
      return { success: false, error: 'webSpeech is a browser-only mode — not available via IPC.' }
    }

    if (sttProvider === 'groq') {
      // Explicit Groq mode: route directly to Groq (free, whisper-large-v3-turbo).
      return transcribeWithGroq(audioData, mimeType, language, previousText)
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

    // 'auto' — smart routing with session cache: Whisper → Gemini → Groq
    return transcribeAuto(audioData, mimeType, language, previousText)
  })

  ipcMain.handle('audio:checkSttProviders', async (): Promise<SttProviderCheckResult> => {
    return checkSttProviders()
  })
}
