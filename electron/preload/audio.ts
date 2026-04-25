/**
 * Audio preload API — Text-to-Speech and audio transcription (Whisper STT + Google STT).
 */
import { ipcRenderer } from 'electron'

export const audioSection = {
  /**
   * Audio transcription — routes to Whisper or Google Cloud STT based on `sttProvider`.
   *
   * Provider routing (handled in the main process):
   *   'auto'     — try Whisper first, automatically fall back to Google STT on failure
   *   'whisper'  — OpenAI Whisper only (highest accuracy, requires OpenAI key)
   *   'google'   — Google Cloud STT only (uses Gemini API key, very reliable)
   *   'webSpeech'— browser-only, never sent via IPC (handled in VoiceRecorder.tsx)
   */
  transcribeAudio: (params: {
    audioData: ArrayBuffer
    mimeType: string
    language?: string
    /**
     * Last successfully transcribed text, forwarded to Whisper as prompt context.
     * Keeps terminology consistent across chunks and prevents YouTube-caption drift.
     */
    previousText?: string
    /** Which STT backend to use. Defaults to 'auto' in the main process. */
    sttProvider?: 'auto' | 'whisper' | 'google' | 'webSpeech'
  }) => ipcRenderer.invoke('audio:transcribe', params),

  // AI Text-to-Speech — priority: OpenAI → Gemini → Edge TTS (free) → ElevenLabs
  speakText: (params: {
    text: string
    voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
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
