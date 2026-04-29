/**
 * Audio preload API — Text-to-Speech and audio transcription (STT).
 *
 * STT routing (handled in the main process, 'auto' mode):
 *   Whisper (OpenAI) → Gemini STT → Groq STT (free fallback)
 *
 * Provider priority is configured in Settings → Speech-to-Text.
 * webSpeech (Browser Speech API) is handled entirely in the renderer via
 * webkitSpeechRecognition — it never reaches IPC.
 */
import { ipcRenderer } from 'electron'

// ── Types (mirrored from src/types to keep electron code self-contained) ──────
type SttProvider = 'auto' | 'whisper' | 'google' | 'groq' | 'webSpeech'
type SttBackend = 'whisper' | 'gemini' | 'groq'
type TtsMode = 'free' | 'auto' | 'premium'

interface SttProviderCheckResult {
  primary: SttBackend | 'none'
  available: SttBackend[]
}

interface TranscribeResult {
  success: boolean
  text?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | string
  noSpeechProb?: number
  avgLogprob?: number
  compressionRatio?: number
  provider?: string
}

export const audioSection = {
  /**
   * Audio transcription — routes to the appropriate STT backend based on `sttProvider`.
   *
   * Provider routing (handled in the main process):
   *   'auto'      — Whisper → Gemini STT → Groq STT; session cache skips unavailable providers
   *   'whisper'   — OpenAI Whisper only (highest accuracy, requires OpenAI key)
   *   'google'    — Gemini STT only (uses Gemini API key, no extra GCP setup needed)
   *   'webSpeech' — browser-only, never sent via IPC (handled in VoiceRecorder.tsx)
   */
  transcribeAudio: (params: {
    audioData: ArrayBuffer
    mimeType: string
    language?: string
    /**
     * Last successfully transcribed text, forwarded to Whisper/Groq as prompt context.
     * Keeps terminology consistent across chunks and prevents YouTube-caption drift.
     */
    previousText?: string
    /** Which STT backend to use. Defaults to 'auto' in the main process. */
    sttProvider?: SttProvider
  }): Promise<TranscribeResult> => ipcRenderer.invoke('audio:transcribe', params),

  /**
   * Pre-flight STT availability check — call before starting a Live Translate session.
   *
   * Checks which STT keys are configured (instant, no API call, no decryption) and
   * pre-warms the session cache so the very first audio chunk goes directly to the
   * best available backend — zero wasted attempts on unavailable providers.
   *
   * Returns the best available provider and the full ordered list.
   */
  checkSttProviders: (): Promise<SttProviderCheckResult> =>
    ipcRenderer.invoke('audio:checkSttProviders'),

  // AI Text-to-Speech — default free-first; paid providers are used only when requested by mode.
  speakText: (params: {
    text: string
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    mode?: TtsMode
    lang?: string
  }) => ipcRenderer.invoke('audio:tts', params) as Promise<{
    success: boolean
    audioBase64?: string
    /** 'audio/mpeg' (OpenAI / Edge / ElevenLabs) | 'audio/wav' (Gemini) */
    mimeType?: string
    /** Which provider produced the audio */
    provider?: string
    error?: string
    errorCode?: string
  }>,
}
