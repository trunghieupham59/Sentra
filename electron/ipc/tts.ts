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

interface TtsCandidate {
  provider: 'openai' | 'gemini'
  /** Human-readable reason for selection */
  reason: string
}

// ─── Provider ranking ─────────────────────────────────────────────────────────
/**
 * Returns an ordered list of TTS candidates to try, from best to worst.
 *
 * Selection criteria (in priority order):
 *  1. Gemini Flash TTS  — fastest latency, lowest cost per character, excellent
 *                         multilingual quality with the 2.5 Flash model.
 *  2. OpenAI tts-1      — proven natural voices, reliable, moderate cost.
 *                         tts-1-hd is intentionally skipped (slower + 2× costlier
 *                         with negligible quality gain for typical translations).
 *
 * If only one key is present the sole available provider is returned.
 * Both providers fall through to OS speech synthesis in the renderer if they fail.
 */
function rankTtsCandidates(
  openaiKey: string | null,
  geminiKey: string | null,
): TtsCandidate[] {
  const candidates: TtsCandidate[] = []

  // ── Gemini Flash TTS: cheapest + fastest, great multilingual support ──────
  // gemini-2.5-flash-preview-tts is optimised for low-latency, low-cost audio
  // generation — ideal for translation output where speed and cost matter most.
  if (geminiKey) {
    candidates.push({
      provider: 'gemini',
      reason: 'gemini-2.5-flash-preview-tts — lowest cost, fast latency, strong multilingual',
    })
  }

  // ── OpenAI tts-1: reliable fallback with natural English/multilingual voices ─
  if (openaiKey) {
    candidates.push({
      provider: 'openai',
      reason: 'tts-1 — reliable, natural voices, proven quality',
    })
  }

  return candidates
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
  // gemini-2.5-flash-preview-tts: Flash tier = fast + cost-efficient
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

    const openaiKey = getStoredApiKey('openai')
    const geminiKey = getStoredApiKey('gemini')

    // ── Rank available providers and try them in order ────────────────────
    const candidates = rankTtsCandidates(openaiKey, geminiKey)

    if (candidates.length === 0) {
      console.warn('[tts] No TTS provider available (no OpenAI or Gemini key)')
      return {
        success: false,
        error: 'No API key found for any TTS provider (OpenAI or Gemini).',
        errorCode: 'NO_API_KEY',
      }
    }

    console.log(
      '[tts] Candidate order:',
      candidates.map((c, i) => `${i + 1}. ${c.provider} — ${c.reason}`).join(' | '),
    )

    for (const candidate of candidates) {
      console.log(`[tts] Trying ${candidate.provider} (${candidate.reason})`)
      try {
        if (candidate.provider === 'gemini' && geminiKey) {
          const result = await ttsWithGemini(text, geminiKey)
          console.log('[tts] ✓ Gemini TTS succeeded')
          return result
        }

        if (candidate.provider === 'openai' && openaiKey) {
          const result = await ttsWithOpenAI(text, voice, openaiKey)
          console.log('[tts] ✓ OpenAI TTS succeeded')
          return result
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[tts] ${candidate.provider} TTS failed:`, msg)

        // Hard failures — don't try the next provider, surface immediately
        if (msg.includes('401') || msg.includes('403') || msg.includes('invalid_api_key') || msg.includes('API_KEY_INVALID')) {
          return {
            success: false,
            error: `Invalid ${candidate.provider === 'openai' ? 'OpenAI' : 'Gemini'} API key.`,
            errorCode: 'INVALID_KEY',
          }
        }
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          return {
            success: false,
            error: `${candidate.provider === 'openai' ? 'OpenAI' : 'Gemini'} rate limit exceeded.`,
            errorCode: 'RATE_LIMIT',
          }
        }

        // Soft failure (network, temporary error) → try next candidate
        console.warn(`[tts] Soft failure on ${candidate.provider}, falling through to next candidate`)
      }
    }

    // All candidates failed (soft failures only)
    return {
      success: false,
      error: 'All TTS providers failed. Check your connection and try again.',
      errorCode: 'NETWORK',
    }
  })
}
