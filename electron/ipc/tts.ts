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

interface TtsParams {
  text: string
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

interface TtsResult {
  success: boolean
  /** base64-encoded MP3 — safer than ArrayBuffer over Electron IPC */
  audioBase64?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | string
}

export function registerTtsHandlers(ipcMain: IpcMain) {
  ipcMain.handle('audio:tts', async (_event, params: TtsParams): Promise<TtsResult> => {
    const { text, voice = 'nova' } = params

    const apiKey = await getApiKey('openai')
    if (!apiKey) {
      return { success: false, error: 'No OpenAI API key.', errorCode: 'NO_API_KEY' }
    }

    try {
      const OpenAI = (await import('openai')).default
      const client = new OpenAI({ apiKey })

      // tts-1 is fast; tts-1-hd for higher quality (slower)
      const response = await client.audio.speech.create({
        model: 'tts-1',
        voice,
        input: text,
        response_format: 'mp3',
      })

      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      return { success: true, audioBase64: base64 }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[tts] Error:', msg)
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
