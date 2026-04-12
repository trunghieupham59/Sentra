import type { IpcMain } from 'electron'

const KEYCHAIN_SERVICE = 'TranslateApp'

async function getApiKey(provider: string): Promise<string | null> {
  try {
    const keytar = await import('keytar')
    return await keytar.default.getPassword(KEYCHAIN_SERVICE, provider)
  } catch {
    return null
  }
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

      const response = await client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: whisperLang,
      })

      return { success: true, text: response.text.trim() }
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
