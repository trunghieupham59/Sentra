import type { IpcMain } from 'electron'
import { getStoredApiKey } from './storage'

interface TtsParams {
  text: string
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

interface TtsResult {
  success: boolean
  /** base64-encoded audio — safer than ArrayBuffer over Electron IPC */
  audioBase64?: string
  /** MIME type of the audio: 'audio/mpeg' (OpenAI) or 'audio/wav' (Gemini) */
  mimeType?: string
  /** Which provider produced the audio */
  provider?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | string
}

// ─── OpenAI TTS ───────────────────────────────────────────────────────────────

async function ttsWithOpenAI(
  text: string,
  voice: TtsParams['voice'] = 'nova',
  apiKey: string,
): Promise<TtsResult> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })

  const response = await client.audio.speech.create({
    model: 'tts-1',
    voice,
    input: text,
    response_format: 'mp3',
  })

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return { success: true, audioBase64: base64, mimeType: 'audio/mpeg', provider: 'openai' }
}

// ─── Gemini TTS ───────────────────────────────────────────────────────────────

async function ttsWithGemini(text: string, apiKey: string): Promise<TtsResult> {
  // Use the Gemini TTS model via REST API (gemini-2.5-flash-preview-tts)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`

  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Aoede' },
        },
      },
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini TTS HTTP ${response.status}: ${errText}`)
  }

  // biome-ignore lint/suspicious/noExplicitAny: dynamic API response
  const data = (await response.json()) as any
  const part = data?.candidates?.[0]?.content?.parts?.[0]

  if (!part?.inlineData?.data) {
    throw new Error('Gemini TTS: no audio data in response')
  }

  const mimeType: string = part.inlineData.mimeType || 'audio/wav'
  return {
    success: true,
    audioBase64: part.inlineData.data as string,
    mimeType,
    provider: 'gemini',
  }
}

// ─── IPC handler ─────────────────────────────────────────────────────────────

export function registerTtsHandlers(ipcMain: IpcMain) {
  ipcMain.handle('audio:tts', async (_event, params: TtsParams): Promise<TtsResult> => {
    const { text, voice = 'nova' } = params
    console.log('[tts] Request: text length =', text.length, '| voice =', voice)

    // ── 1. Try OpenAI TTS (best quality, natural voices) ──────────────────
    const openaiKey = getStoredApiKey('openai')
    console.log('[tts] OpenAI key available:', !!openaiKey)
    if (openaiKey) {
      try {
        return await ttsWithOpenAI(text, voice, openaiKey)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[tts] OpenAI TTS failed, trying next provider:', msg)

        if (msg.includes('401') || msg.includes('invalid_api_key')) {
          // Key is invalid — don't try fallback, surface the error
          return { success: false, error: 'Invalid OpenAI API key.', errorCode: 'INVALID_KEY' }
        }
        if (msg.includes('429')) {
          return { success: false, error: 'OpenAI rate limit exceeded.', errorCode: 'RATE_LIMIT' }
        }
        // Other errors → fall through to next provider
      }
    }

    // ── 2. Try Gemini TTS (gemini-2.5-flash-preview-tts) ──────────────────
    const geminiKey = getStoredApiKey('gemini')
    if (geminiKey) {
      try {
        return await ttsWithGemini(text, geminiKey)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[tts] Gemini TTS failed:', msg)

        if (msg.includes('401') || msg.includes('403') || msg.includes('API_KEY_INVALID')) {
          return { success: false, error: 'Invalid Gemini API key.', errorCode: 'INVALID_KEY' }
        }
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          return { success: false, error: 'Gemini rate limit exceeded.', errorCode: 'RATE_LIMIT' }
        }
        // Fall through — no more providers to try
      }
    }

    // ── 3. No provider available → return NO_API_KEY ─────────────────────
    // Claude does not have a TTS API, so it is intentionally skipped.
    return {
      success: false,
      error: 'No API key found for any TTS provider (OpenAI or Gemini).',
      errorCode: 'NO_API_KEY',
    }
  })
}
