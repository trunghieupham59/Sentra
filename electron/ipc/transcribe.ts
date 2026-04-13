import type { IpcMain } from 'electron'
import { getStoredApiKey } from './storage'

function getApiKey(provider: string): string | null {
  return getStoredApiKey(provider)
}

interface TranscribeParams {
  audioData: ArrayBuffer   // Raw audio bytes from MediaRecorder
  mimeType: string         // e.g. 'audio/webm;codecs=opus'
  language?: string        // BCP-47 code or 'auto'
}

interface TranscribeResult {
  success: boolean
  text?: string
  error?: string
  errorCode?: 'NO_API_KEY' | string
  // Confidence signals extracted from Whisper's verbose_json response.
  // These are the model's own assessment and are the most reliable
  // hallucination indicators available.
  noSpeechProb?: number
  avgLogprob?: number
  compressionRatio?: number
}

/**
 * Whisper verbose_json segment shape (subset we actually use).
 * The full TranscriptionVerbose type varies across SDK versions so we
 * define a minimal interface to avoid import-path brittleness.
 */
interface VerboseSegment {
  avg_logprob:       number
  compression_ratio: number
  no_speech_prob:    number
}

interface VerboseResponse {
  text:      string
  segments?: VerboseSegment[]
}

/**
 * Build an anti-hallucination prompt for Whisper.
 *
 * Whisper's `prompt` parameter biases the decoder toward a certain style or
 * vocabulary.  Key effects used here:
 *
 *  1. The prompt starts mid-sentence (no channel-intro phrasing) — this
 *     discourages the model from generating YouTube-style openings such as
 *     "Thanks for watching!" or "[Music]" that come from its training data.
 *
 *  2. The prompt ends without terminal punctuation so the decoder treats the
 *     audio as a continuation of natural speech rather than a fresh start.
 *
 *  3. For Vietnamese we include common tonal words so the tokenizer is primed
 *     for diacritics rather than romanised guesses.
 *
 * Reference: https://platform.openai.com/docs/guides/speech-to-text/prompting
 */
function buildWhisperPrompt(language: string | undefined): string {
  switch (language) {
    case 'vi':
      // Prime with natural Vietnamese conversational openers — no channel-like
      // phrases.  The trailing comma signals "speech in progress".
      return 'Xin chào, hôm nay chúng ta sẽ nói về'
    case 'ja':
      return 'はい、えーと、今日は'
    case 'ko':
      return '안녕하세요, 오늘은'
    case 'zh':
      return '好的，今天我们来讨论'
    default:
      // Generic English / unknown: start mid-conversation to avoid intro drift.
      // The "Um," opener is a known trick to prevent Whisper from hallucinating
      // "Thank you for watching" and similar patterns.
      return 'Um, so,'
  }
}

/**
 * Aggregate confidence metrics across all segments.
 *
 * Whisper may split an audio chunk into several segments.  We take the
 * worst-case (most-suspicious) value for each metric so that a single bad
 * segment can trigger rejection.
 *
 *   no_speech_prob   → max  (highest suspicion of silence)
 *   avg_logprob      → min  (lowest confidence)
 *   compression_ratio → max (most repetitive / anomalous output)
 */
function aggregateSegments(segments: VerboseSegment[]): {
  noSpeechProb: number
  avgLogprob: number
  compressionRatio: number
} {
  if (segments.length === 0) {
    return { noSpeechProb: 0, avgLogprob: 0, compressionRatio: 1 }
  }
  return {
    noSpeechProb:    Math.max(...segments.map(s => s.no_speech_prob)),
    avgLogprob:      Math.min(...segments.map(s => s.avg_logprob)),
    compressionRatio: Math.max(...segments.map(s => s.compression_ratio)),
  }
}

export function registerTranscribeHandlers(ipcMain: IpcMain) {
  ipcMain.handle('audio:transcribe', async (_event, params: TranscribeParams): Promise<TranscribeResult> => {
    const { audioData, mimeType, language } = params

    const apiKey = await getApiKey('openai')
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

      // Convert ArrayBuffer → Node Buffer → File for OpenAI SDK
      const buffer = Buffer.from(audioData)
      const ext = mimeType.includes('ogg') ? 'ogg'
        : mimeType.includes('mp4') ? 'mp4'
        : mimeType.includes('wav') ? 'wav'
        : 'webm'

      const file = new File([buffer], `audio.${ext}`, { type: mimeType })

      // Whisper uses ISO 639-1 two-letter codes; strip region suffix (e.g. 'zh-TW' → 'zh')
      const whisperLang = language && language !== 'auto'
        ? language.split('-')[0]
        : undefined

      // ── Request verbose_json to get per-segment confidence signals ────────
      // These signals (no_speech_prob, avg_logprob, compression_ratio) are the
      // most reliable hallucination indicators available from the API.
      // The renderer pipeline uses them as a mandatory confidence gate before
      // accepting any transcript.
      // biome-ignore lint/suspicious/noExplicitAny: SDK type varies by response_format overload
      const rawResponse = await (client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: whisperLang,
        response_format: 'verbose_json',
        // Anti-hallucination prompt: primes the decoder with natural
        // mid-conversation text to stay out of YouTube-caption mode.
        prompt: buildWhisperPrompt(whisperLang),
      }) as unknown) as VerboseResponse

      const text = rawResponse.text?.trim() ?? ''

      // Server-side sanity: reject obviously empty or whitespace-only responses
      if (!text || /^\s*$/.test(text)) {
        return { success: true, text: '' }
      }

      const segments = rawResponse.segments ?? []
      const { noSpeechProb, avgLogprob, compressionRatio } = aggregateSegments(segments)

      return {
        success: true,
        text,
        noSpeechProb,
        avgLogprob,
        compressionRatio,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[transcribe] Whisper error:', msg)

      if (msg.includes('401') || msg.includes('invalid_api_key')) {
        return { success: false, error: 'Invalid OpenAI API key.', errorCode: 'INVALID_KEY' }
      }
      if (msg.includes('429')) {
        return { success: false, error: 'Rate limit exceeded.', errorCode: 'RATE_LIMIT' }
      }
      return { success: false, error: msg }
    }
  })
}
