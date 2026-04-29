import type { IpcMain } from 'electron'
import {
  GEMINI_API_BASE, GEMINI_STT_MODEL,
  GROQ_API_BASE, GROQ_STT_MODEL,
  STT_CONNECTION_ERROR_BAN_MS, STT_HEDGE_DELAY_MS,
  STT_RECOVERY_PROBE_DELAY_MS,
  WHISPER_CONSECUTIVE_FAIL_BAN_MS, WHISPER_MODEL,
  WHISPER_RATE_LIMIT_BAN_MS, WHISPER_TIMEOUT_MS,
} from './ipcConstants'
import { invalidIpcInput, isOptionalString, isRecord, isSafeLanguageCode } from './ipcValidation'
import { withRetry } from './retry'
import { getStoredApiKey, hasStoredApiKey } from './storage'

// ─── Session-level availability cache ────────────────────────────────────────
//
// Problem: In live meetings, speech is continuous. If a provider is unavailable
// (no key, rate-limited, connection error), the 'auto' fallback logic MUST skip
// that provider immediately on every subsequent chunk — not retry it.
//
// Design:
//   • Each provider has its own session availability flag + expiry timestamp.
//   • First failure → mark unavailable + ban for N seconds.
//   • All subsequent chunks → cache hit → skip instantly (zero overhead).
//   • Background probe → after STT_RECOVERY_PROBE_DELAY_MS, silently test the
//     banned provider. Success → reset ban early so the next real chunk uses it.
//   • Ban expiry → natural retry without background probe.
//
// Pre-flight (checkSttProviders) pre-warms Whisper cache on session open.

// ── Whisper cache ─────────────────────────────────────────────────────────────
let whisperSessionAvailable = true
let whisperUnavailableUntilMs = 0

// Counts consecutive Whisper failures with unrecognised error codes (no errorCode).
// After WHISPER_CONSECUTIVE_FAIL_LIMIT failures the session is switched away from
// Whisper for WHISPER_CONSECUTIVE_FAIL_BAN_MS to stop hammering a broken endpoint.
let whisperConsecutiveFailures = 0
const WHISPER_CONSECUTIVE_FAIL_LIMIT = 3

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
 * Mark Whisper as unavailable for this session (or a timed window).
 *
 *   NO_API_KEY / INVALID_KEY → permanent until app restart or key change
 *   RATE_LIMIT / TIMEOUT     → WHISPER_RATE_LIMIT_BAN_MS timed ban
 *   CONNECTION_ERROR         → STT_CONNECTION_ERROR_BAN_MS short ban (30 s)
 *   CONSECUTIVE_FAIL         → WHISPER_CONSECUTIVE_FAIL_BAN_MS short ban (60 s)
 */
function markWhisperUnavailable(errorCode: string): void {
  whisperSessionAvailable = false
  if (errorCode === 'RATE_LIMIT' || errorCode === 'TIMEOUT') {
    const banMs = WHISPER_RATE_LIMIT_BAN_MS
    whisperUnavailableUntilMs = Date.now() + banMs
    console.log(`[transcribe] Whisper marked unavailable for ${banMs / 1000} s (${errorCode})`)
  } else if (errorCode === 'CONNECTION_ERROR') {
    whisperUnavailableUntilMs = Date.now() + STT_CONNECTION_ERROR_BAN_MS
    console.log(`[transcribe] Whisper marked unavailable for ${STT_CONNECTION_ERROR_BAN_MS / 1000} s (CONNECTION_ERROR)`)
  } else if (errorCode === 'CONSECUTIVE_FAIL') {
    whisperUnavailableUntilMs = Date.now() + WHISPER_CONSECUTIVE_FAIL_BAN_MS
    console.log(`[transcribe] Whisper marked unavailable for ${WHISPER_CONSECUTIVE_FAIL_BAN_MS / 1000} s (${errorCode})`)
  } else {
    // NO_API_KEY, INVALID_KEY → permanent
    whisperUnavailableUntilMs = Number.MAX_SAFE_INTEGER
    console.log(`[transcribe] Whisper marked unavailable for session (${errorCode})`)
  }
}

// ── Gemini cache ──────────────────────────────────────────────────────────────
// Mirrors Whisper's session cache so Gemini rate-limit / connection errors also
// skip subsequent chunks instantly instead of retrying on every chunk.

let geminiSessionAvailable = true
let geminiUnavailableUntilMs = 0

function isGeminiAvailableNow(): boolean {
  if (geminiSessionAvailable) return true
  if (Date.now() >= geminiUnavailableUntilMs) {
    geminiSessionAvailable = true
    geminiUnavailableUntilMs = 0
    console.log('[transcribe] Gemini session ban expired — will retry Gemini on next chunk')
  }
  return geminiSessionAvailable
}

/**
 * Mark Gemini STT as unavailable for this session (or a timed window).
 *
 *   NO_API_KEY / INVALID_KEY → permanent until key changes
 *   RATE_LIMIT               → WHISPER_RATE_LIMIT_BAN_MS timed ban (same as Whisper)
 *   CONNECTION_ERROR         → STT_CONNECTION_ERROR_BAN_MS short ban (30 s)
 */
function markGeminiUnavailable(errorCode: string): void {
  geminiSessionAvailable = false
  if (errorCode === 'RATE_LIMIT') {
    geminiUnavailableUntilMs = Date.now() + WHISPER_RATE_LIMIT_BAN_MS
    console.log(`[transcribe] Gemini marked unavailable for ${WHISPER_RATE_LIMIT_BAN_MS / 1000} s (RATE_LIMIT)`)
  } else if (errorCode === 'CONNECTION_ERROR') {
    geminiUnavailableUntilMs = Date.now() + STT_CONNECTION_ERROR_BAN_MS
    console.log(`[transcribe] Gemini marked unavailable for ${STT_CONNECTION_ERROR_BAN_MS / 1000} s (CONNECTION_ERROR)`)
  } else {
    geminiUnavailableUntilMs = Number.MAX_SAFE_INTEGER
    console.log(`[transcribe] Gemini marked unavailable for session (${errorCode})`)
  }
}

// ─── Error codes that trigger fallback behaviour ──────────────────────────────
// CONNECTION_ERROR is now also a PERMANENT code (short timed ban) — in live meeting
// context, retrying on every chunk is wasteful because the same network issue persists.
const PERMANENT_FALLBACK_CODES = new Set(['NO_API_KEY', 'INVALID_KEY', 'RATE_LIMIT', 'TIMEOUT', 'CONNECTION_ERROR'])
// All codes that trigger next-provider fallback on this chunk
const FALLBACK_CODES = new Set(['NO_API_KEY', 'INVALID_KEY', 'RATE_LIMIT', 'CONNECTION_ERROR', 'TIMEOUT'])

// ─── Background recovery probe ────────────────────────────────────────────────
//
// When a provider is banned, we schedule a silent background probe after
// STT_RECOVERY_PROBE_DELAY_MS.  The probe sends a minimal silence WAV — cheap
// enough that it won't consume significant API quota.
//
// If the probe succeeds (or returns any error other than the banning one) the
// session cache is reset so the next real chunk uses that provider again.
// This allows early recovery without blocking live transcription.

/** Generate a minimal WAV buffer of 100 ms of silence at 16 kHz (mono 16-bit). */
function createSilenceWav(): ArrayBuffer {
  const sampleRate = 16_000
  const numSamples = sampleRate / 10   // 100 ms
  const dataSize   = numSamples * 2    // 16-bit PCM = 2 bytes per sample
  const buf        = Buffer.alloc(44 + dataSize, 0)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)               // PCM chunk size
  buf.writeUInt16LE(1, 20)                // format = PCM
  buf.writeUInt16LE(1, 22)                // channels = 1
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)   // byte rate
  buf.writeUInt16LE(2, 32)                // block align
  buf.writeUInt16LE(16, 34)               // bits/sample
  buf.write('data', 36); buf.writeUInt32LE(dataSize, 40)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

/**
 * Schedule a background recovery probe for a banned provider.
 *
 * The probe runs in a setTimeout so it never blocks the calling audio chunk.
 * If the provider responds (success OR any error ≠ the banning errorCode), the
 * session cache is cleared so the very next real chunk can use that provider.
 */
function scheduleRecoveryProbe(provider: 'whisper' | 'gemini', afterMs: number): void {
  setTimeout(async () => {
    const silenceWav = createSilenceWav()
    try {
      if (provider === 'whisper') {
        if (isWhisperAvailableNow()) return  // already recovered via natural expiry
        const result = await transcribeWithWhisper(silenceWav, 'audio/wav', undefined, undefined, false)
        // Treat success OR any non-connectivity error as "provider is back"
        if (result.success || (result.errorCode !== 'CONNECTION_ERROR' && result.errorCode !== 'TIMEOUT')) {
          whisperSessionAvailable   = true
          whisperUnavailableUntilMs = 0
          console.log('[transcribe] Background probe: Whisper recovered → session ban reset')
        }
      } else {
        if (isGeminiAvailableNow()) return  // already recovered
        const geminiKey = await getStoredApiKey('gemini')
        if (!geminiKey) return
        const result = await transcribeWithGeminiSTT(silenceWav, 'audio/wav', undefined, geminiKey)
        if (result.success || (result.errorCode !== 'RATE_LIMIT' && result.errorCode !== 'CONNECTION_ERROR')) {
          geminiSessionAvailable   = true
          geminiUnavailableUntilMs = 0
          console.log('[transcribe] Background probe: Gemini recovered → session ban reset')
        }
      }
    } catch {
      // Probe errors are silently swallowed — never block live transcription
    }
  }, afterMs)
}

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

type ParsedTranscribeParams =
  | { ok: true; value: TranscribeParams }
  | { ok: false; response: { success: false; error: string; errorCode?: string } }

const STT_PROVIDERS = new Set(['auto', 'whisper', 'google', 'groq', 'webSpeech'])
const MAX_PREVIOUS_TEXT_CHARS = 20_000

function parseTranscribeParams(rawParams: unknown): ParsedTranscribeParams {
  if (!isRecord(rawParams)) {
    return { ok: false, response: invalidIpcInput('Transcribe payload must be an object') }
  }

  if (!(rawParams.audioData instanceof ArrayBuffer) || rawParams.audioData.byteLength === 0) {
    return { ok: false, response: invalidIpcInput('Audio data is required') }
  }
  if (typeof rawParams.mimeType !== 'string' || !rawParams.mimeType.startsWith('audio/')) {
    return { ok: false, response: invalidIpcInput('Invalid audio MIME type') }
  }
  if (rawParams.language !== undefined && !isSafeLanguageCode(rawParams.language)) {
    return { ok: false, response: invalidIpcInput('Invalid language') }
  }
  if (!isOptionalString(rawParams.previousText) || (rawParams.previousText?.length ?? 0) > MAX_PREVIOUS_TEXT_CHARS) {
    return { ok: false, response: invalidIpcInput('Invalid previous text') }
  }
  if (rawParams.sttProvider !== undefined && (typeof rawParams.sttProvider !== 'string' || !STT_PROVIDERS.has(rawParams.sttProvider))) {
    return { ok: false, response: invalidIpcInput('Invalid STT provider') }
  }

  return {
    ok: true,
    value: {
      audioData: rawParams.audioData,
      mimeType: rawParams.mimeType,
      language: rawParams.language,
      previousText: rawParams.previousText,
      sttProvider: rawParams.sttProvider as TranscribeParams['sttProvider'],
    },
  }
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

    // In 'auto' mode (useRetry=false) we race the Whisper call against a hard
    // timeout so a stalled/slow endpoint never blocks the real-time pipeline.
    // In explicit 'whisper' mode (useRetry=true) the retry wrapper manages
    // timing, so we let it run without an outer timeout.
    let apiCall: Promise<unknown>
    if (useRetry) {
      apiCall = withRetry(createCall) as Promise<unknown>
    } else {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Whisper request timed out')), WHISPER_TIMEOUT_MS),
      )
      apiCall = Promise.race([createCall() as Promise<unknown>, timeoutPromise])
    }

    const rawResponse = await (apiCall as unknown) as VerboseResponse
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
    // Catch the timeout we inject via Promise.race above
    if (msg.toLowerCase().includes('timed out') || msg.toLowerCase().includes('timeout'))
      return { success: false, error: 'Whisper request timed out — falling back to next STT provider.', errorCode: 'TIMEOUT' }
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

// ─── Hedged request (Whisper + Gemini in parallel) ────────────────────────────
//
// "Hedged request" pattern: start Whisper immediately, then after STT_HEDGE_DELAY_MS
// start Gemini in parallel if Whisper hasn't responded yet.  Use whichever succeeds
// first.  If Whisper fails early, Gemini starts immediately without waiting for the
// hedge timer.
//
// This guarantees that any single slow/failing provider cannot block the pipeline
// for more than ~WHISPER_TIMEOUT_MS (2 s) even in the worst case.
//
// Returns { result, fromWhisper } so the caller can update caches appropriately.

async function transcribeHedged(
  audioData: ArrayBuffer,
  mimeType: string,
  language: string | undefined,
  previousText: string | undefined,
  geminiKey: string,
): Promise<{ result: TranscribeResult; fromWhisper: boolean }> {

  return new Promise(outerResolve => {
    let settled = false
    let geminiLaunched = false
    let geminiResolve: (r: TranscribeResult) => void

    // Deferred Gemini promise — launched on demand
    const geminiDeferred = new Promise<TranscribeResult>(res => { geminiResolve = res })

    const settle = (result: TranscribeResult, fromWhisper: boolean) => {
      if (settled) return
      settled = true
      outerResolve({ result, fromWhisper })
    }

    const launchGemini = () => {
      if (geminiLaunched) return
      geminiLaunched = true
      transcribeWithGeminiSTT(audioData, mimeType, language, geminiKey)
        .then(r => geminiResolve(r))
        .catch(() => geminiResolve({ success: false, error: 'Gemini hedge error', errorCode: 'CONNECTION_ERROR' }))
    }

    // Listen for Gemini result (resolves after launchGemini fires)
    geminiDeferred.then(r => settle(r, false))

    // Start Whisper immediately
    const whisperPromise = transcribeWithWhisper(audioData, mimeType, language, previousText, false)

    // Hedge timer: start Gemini if Whisper hasn't responded in time
    const hedgeTimer = setTimeout(() => {
      if (!settled) {
        console.log('[transcribe] hedge: Whisper slow — starting Gemini in parallel')
        launchGemini()
      }
    }, STT_HEDGE_DELAY_MS)

    whisperPromise.then(r => {
      clearTimeout(hedgeTimer)
      if (r.success) {
        settle(r, true)  // Whisper wins!
      } else {
        // Whisper failed — start Gemini now (hedge may not have fired yet)
        launchGemini()
        // Don't settle yet; wait for Gemini result
        // (geminiDeferred.then(settle) is already registered above)
      }
    }).catch(() => {
      clearTimeout(hedgeTimer)
      launchGemini()
    })
  })
}

// ─── Auto mode: smart routing with session cache ───────────────────────────────

/**
 * Smart routing for 'auto' mode: Whisper → Gemini STT → Groq STT.
 *
 * When both Whisper and Gemini are available, uses a hedged-request strategy:
 *   • Whisper starts immediately.
 *   • After STT_HEDGE_DELAY_MS, Gemini starts in parallel if Whisper is still pending.
 *   • Whichever succeeds first wins — no sequential blocking.
 *
 * When only one provider is available, falls through to that provider directly.
 * Session caches ensure providers that failed previously are skipped instantly.
 */
async function transcribeAuto(
  audioData: ArrayBuffer,
  mimeType: string,
  language?: string,
  previousText?: string,
): Promise<TranscribeResult> {

  const whisperAvail = isWhisperAvailableNow()
  const geminiAvail  = isGeminiAvailableNow()
  const geminiKey    = (geminiAvail) ? await getStoredApiKey('gemini') : null

  // ── Hedged mode: both Whisper and Gemini are available ───────────────────────
  //
  // Fire them in a hedged race — fastest success wins.  This eliminates the
  // sequential Whisper-timeout → fall-to-Gemini delay that breaks real-time
  // performance when Whisper is slow or flaky.
  if (whisperAvail && geminiAvail && geminiKey) {
    const { result, fromWhisper } = await transcribeHedged(
      audioData, mimeType, language, previousText, geminiKey,
    )

    if (result.success) {
      if (fromWhisper) {
        // Whisper won the race → reset consecutive-fail counter + session recovery
        whisperConsecutiveFailures = 0
        if (!whisperSessionAvailable) {
          whisperSessionAvailable   = true
          whisperUnavailableUntilMs = 0
          console.log('[transcribe] auto: Whisper recovered (hedged) — session cache reset')
        }
      } else {
        // Gemini won the hedge race.
        //
        // Important: Gemini winning does NOT mean Whisper is broken — Whisper may
        // simply have been slightly slower (e.g. 1.2 s vs Gemini's 1.0 s).  We must
        // NOT ban Whisper here, otherwise a small latency variance causes Whisper to
        // be excluded from the hedge for 90 s, which defeats the purpose of hedging.
        //
        // The hedge continues on every subsequent chunk and will naturally prefer
        // whichever provider is faster.  Whisper is only banned when it actually
        // returns an error (handled in the "Both failed" branch below).
        console.log('[transcribe] auto: Gemini won hedge race (Whisper was slower) — keeping both in hedge')
        if (!geminiSessionAvailable) {
          geminiSessionAvailable   = true
          geminiUnavailableUntilMs = 0
          console.log('[transcribe] auto: Gemini recovered (hedged) — session cache reset')
        }
      }
      return result
    }

    // Both Whisper and Gemini failed in the hedged race → ban both, fall to Groq
    const code = result.errorCode ?? ''
    console.log(`[transcribe] auto: Hedged race failed (${code}) → Groq STT`)
    if (PERMANENT_FALLBACK_CODES.has(code)) {
      markWhisperUnavailable(code)
      markGeminiUnavailable(code)
      whisperConsecutiveFailures = 0
    }
    // Fall through to Groq
  }

  // ── Single provider: Whisper only ────────────────────────────────────────────
  else if (whisperAvail) {
    const whisperResult = await transcribeWithWhisper(audioData, mimeType, language, previousText, false)

    if (whisperResult.success) {
      whisperConsecutiveFailures = 0
      if (!whisperSessionAvailable) {
        whisperSessionAvailable = true; whisperUnavailableUntilMs = 0
        console.log('[transcribe] auto: Whisper recovered — session cache reset')
      }
      return whisperResult
    }

    const code = whisperResult.errorCode ?? ''
    if (PERMANENT_FALLBACK_CODES.has(code)) {
      markWhisperUnavailable(code); whisperConsecutiveFailures = 0
      if (code === 'CONNECTION_ERROR' || code === 'TIMEOUT') scheduleRecoveryProbe('whisper', STT_RECOVERY_PROBE_DELAY_MS)
    } else if (!FALLBACK_CODES.has(code)) {
      whisperConsecutiveFailures++
      if (whisperConsecutiveFailures >= WHISPER_CONSECUTIVE_FAIL_LIMIT) {
        markWhisperUnavailable('CONSECUTIVE_FAIL'); whisperConsecutiveFailures = 0
        scheduleRecoveryProbe('whisper', STT_RECOVERY_PROBE_DELAY_MS)
      }
    }
    console.log(`[transcribe] auto: Whisper-only failed (${code || 'unknown'}) → Groq STT`)
    // Fall through to Groq (no Gemini key)
  }

  // ── Single provider: Gemini only ─────────────────────────────────────────────
  else if (geminiAvail && geminiKey) {
    const geminiResult = await transcribeWithGeminiSTT(audioData, mimeType, language, geminiKey)

    if (geminiResult.success) {
      if (!geminiSessionAvailable) {
        geminiSessionAvailable = true; geminiUnavailableUntilMs = 0
        console.log('[transcribe] auto: Gemini recovered — session cache reset')
      }
      return geminiResult
    }

    const geminiCode = geminiResult.errorCode ?? ''
    if (FALLBACK_CODES.has(geminiCode)) {
      markGeminiUnavailable(geminiCode)
      if (geminiCode === 'RATE_LIMIT' || geminiCode === 'CONNECTION_ERROR') scheduleRecoveryProbe('gemini', STT_RECOVERY_PROBE_DELAY_MS)
      console.log(`[transcribe] auto: Gemini-only failed (${geminiCode}) → Groq STT`)
    } else {
      return geminiResult  // non-recoverable error
    }
    // Fall through to Groq
  }

  // ── Neither Whisper nor Gemini: log and fall through ─────────────────────────
  else {
    console.log('[transcribe] auto: Whisper + Gemini both unavailable → Groq STT')
  }

  // ── Step 3: Groq STT (free fallback) ─────────────────────────────────────────
  //
  // Groq is the last resort.  If it is also unavailable or fails, there is no
  // further fallback — the session cannot continue and should be stopped so the
  // user sees a clear error rather than silent audio drops.
  const groqKey = await getStoredApiKey('groq')

  if (!groqKey) {
    return {
      success: false,
      errorCode: 'ALL_PROVIDERS_EXHAUSTED',
      error: 'All STT providers exhausted. No Groq API key configured. Add one in Settings → STT (free, no credit card required).',
    }
  }

  const groqResult = await transcribeWithGroq(audioData, mimeType, language, previousText)

  if (!groqResult.success) {
    // Groq also failed → no more fallbacks → signal the UI to stop the session
    console.error('[transcribe] auto: Groq STT also failed — all providers exhausted:', groqResult.error)
    return {
      success: false,
      errorCode: 'ALL_PROVIDERS_EXHAUSTED',
      error: `All STT providers failed. Last error (Groq): ${groqResult.error}`,
    }
  }

  return groqResult
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

  // ── Pre-warm session caches ───────────────────────────────────────────────
  // If a provider is not configured, mark it unavailable so the first real
  // audio chunk goes directly to the next available provider.
  // If a key was added since the last check, reset the ban so it is retried.

  if (!hasOpenAI && whisperSessionAvailable) {
    whisperSessionAvailable   = false
    whisperUnavailableUntilMs = Number.MAX_SAFE_INTEGER
    console.log('[transcribe] pre-flight: no OpenAI key → Whisper pre-marked unavailable for session')
  } else if (hasOpenAI && !whisperSessionAvailable) {
    whisperSessionAvailable   = true
    whisperUnavailableUntilMs = 0
    console.log('[transcribe] pre-flight: OpenAI key present → Whisper session cache reset to available')
  }

  if (!hasGemini && geminiSessionAvailable) {
    geminiSessionAvailable   = false
    geminiUnavailableUntilMs = Number.MAX_SAFE_INTEGER
    console.log('[transcribe] pre-flight: no Gemini key → Gemini pre-marked unavailable for session')
  } else if (hasGemini && !geminiSessionAvailable) {
    // Key was added or a previous ban expired — reset so Gemini is tried next chunk
    geminiSessionAvailable   = true
    geminiUnavailableUntilMs = 0
    console.log('[transcribe] pre-flight: Gemini key present → Gemini session cache reset to available')
  }

  console.log(`[transcribe] pre-flight: primary=${primary} available=[${available.join(', ')}]`)
  return { primary, available }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

export function registerTranscribeHandlers(ipcMain: IpcMain) {
  ipcMain.handle('audio:transcribe', async (_event, rawParams: unknown): Promise<TranscribeResult> => {
    const parsed = parseTranscribeParams(rawParams)
    if (!parsed.ok) return parsed.response
    const params = parsed.value
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
