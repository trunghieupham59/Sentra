/**
 * Audio preload API — Text-to-Speech and audio transcription (Whisper STT).
 */
import { ipcRenderer } from 'electron'

export const audioSection = {
  // Audio transcription via OpenAI Whisper (avoids Google Speech API dependency)
  transcribeAudio: (params: {
    audioData: ArrayBuffer
    mimeType: string
    language?: string
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
