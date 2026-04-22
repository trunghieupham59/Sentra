/**
 * Text-to-Speech IPC handlers — Electron main process.
 *
 * Provider priority (best-to-worst, auto-ranked):
 *  1. OpenAI tts-1          — high-quality natural voices; requires OpenAI key.
 *  2. Gemini TTS            — good quality, WAV output; requires Gemini key.
 *  3. Edge TTS (Microsoft)  — FREE, no API key needed, Microsoft Neural voices;
 *                             implemented via Rust-style WebSocket DRM proxy in Node.js.
 *  4. ElevenLabs            — premium streaming quality; requires ElevenLabs key.
 *
 * All providers return base64-encoded audio so the renderer can decode it with
 * Web Audio API regardless of format (MP3, WAV, PCM).
 */
import type { IpcMain } from 'electron'
import * as crypto from 'crypto'
import WebSocket from 'ws'
import { getStoredApiKey } from './storage'
import {
  EDGE_TTS_WS_URL,
  EDGE_TTS_TRUSTED_TOKEN,
  EDGE_TTS_CHROMIUM_FULL,
  EDGE_TTS_CHROMIUM_MAJOR,
  EDGE_TTS_WIN_EPOCH,
  EDGE_TTS_DEFAULT_VOICE,
  EDGE_TTS_DEFAULT_RATE,
  EDGE_TTS_TIMEOUT_MS,
  ELEVENLABS_API_BASE,
  ELEVENLABS_TTS_MODEL,
  ELEVENLABS_DEFAULT_VOICE_ID,
  ELEVENLABS_STABILITY,
  ELEVENLABS_SIMILARITY_BOOST,
  ELEVENLABS_STYLE,
  GEMINI_API_BASE,
  GEMINI_TTS_MODEL,
  GEMINI_TTS_VOICE_NAME,
  OPENAI_TTS_MODEL,
} from './ipcConstants'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TtsParams {
  text: string
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
}

interface TtsResult {
  success: boolean
  /** base64-encoded audio — safer than ArrayBuffer over Electron IPC */
  audioBase64?: string
  /** MIME type of the audio: 'audio/mpeg' (OpenAI/Edge/ElevenLabs) */
  mimeType?: string
  /** Which provider produced the audio */
  provider?: string
  error?: string
  errorCode?: 'NO_API_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'NETWORK' | string
}

interface TtsCandidate {
  provider: 'openai' | 'gemini' | 'edge' | 'elevenlabs'
  reason: string
}

// ── Provider ranking ──────────────────────────────────────────────────────────

/**
 * Returns an ordered list of TTS candidates to try, from best to worst.
 *
 *  1. OpenAI tts-1  — if OpenAI key is present: high-quality, reliable.
 *  2. Gemini TTS    — if Gemini key is present: good quality, WAV output.
 *  3. Edge TTS      — ALWAYS available (free, no key); Microsoft Neural voices.
 *  4. ElevenLabs    — if ElevenLabs key is present: premium quality last resort.
 */
function rankTtsCandidates(
  openaiKey: string | null,
  geminiKey: string | null,
  elevenlabsKey: string | null,
): TtsCandidate[] {
  const candidates: TtsCandidate[] = []

  // ── 1. OpenAI tts-1: best quality when key is available ───────────────────
  if (openaiKey) {
    candidates.push({
      provider: 'openai',
      reason: 'tts-1 — high-quality natural voices (primary)',
    })
  }

  // ── 2. Gemini TTS: good quality, uses existing Gemini key ─────────────────
  if (geminiKey) {
    candidates.push({
      provider: 'gemini',
      reason: `${GEMINI_TTS_MODEL} — Aoede voice, WAV output`,
    })
  }

  // ── 3. Edge TTS: always free, no key needed ────────────────────────────────
  // Microsoft Neural TTS via WebSocket; quality ~= OpenAI tts-1 for many languages.
  // Used as the free fallback when no OpenAI key is present.
  candidates.push({
    provider: 'edge',
    reason: 'Microsoft Edge TTS — free, no API key required',
  })

  // ── 4. ElevenLabs: premium quality, last resort ────────────────────────────
  if (elevenlabsKey) {
    candidates.push({
      provider: 'elevenlabs',
      reason: 'eleven_multilingual_v2 — premium quality (last resort)',
    })
  }

  return candidates
}

// ── OpenAI TTS ────────────────────────────────────────────────────────────────

async function ttsWithOpenAI(
  text: string,
  voice: TtsParams['voice'] = 'nova',
  apiKey: string,
): Promise<TtsResult> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })

  const response = await client.audio.speech.create({
    model: OPENAI_TTS_MODEL,
    voice,
    input: text,
    response_format: 'mp3',
  })

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return { success: true, audioBase64: base64, mimeType: 'audio/mpeg', provider: 'openai' }
}

// ── Edge TTS (Microsoft Neural TTS — free) ────────────────────────────────────
//
// Ports the DRM + WebSocket protocol from my-translator's edge_tts.rs to Node.js.
// Microsoft's browser speech service requires a time-based DRM token (Sec-MS-GEC)
// plus specific headers (Origin, User-Agent, Cookie) to accept the connection.

/**
 * Generate the Sec-MS-GEC DRM token value.
 * Algorithm (ported from Python/Rust open-source implementations):
 *   1. Get current Unix timestamp (seconds).
 *   2. Add Windows epoch offset (11,644,473,600) to get Windows file time.
 *   3. Round down to the nearest 5 minutes (ticks % 300 == 0).
 *   4. Multiply by 1e7 to convert seconds → 100-nanosecond intervals.
 *   5. SHA-256 hash of "{ticks_100ns}{TRUSTED_CLIENT_TOKEN}".
 *   6. Return uppercase hex.
 * BigInt arithmetic avoids floating-point precision loss on large values.
 */
function generateSecMsGec(): string {
  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  const winEpoch = BigInt(EDGE_TTS_WIN_EPOCH)
  let ticks = nowSec + winEpoch
  ticks = ticks - (ticks % 300n)            // round down to 5-minute boundary
  const ticks100ns = ticks * 10_000_000n    // seconds → 100-nanosecond intervals
  const payload = `${ticks100ns}${EDGE_TTS_TRUSTED_TOKEN}`
  return crypto.createHash('sha256').update(payload).digest('hex').toUpperCase()
}

/**
 * Synthesize text using Microsoft Edge TTS.
 * Connects via WebSocket, sends a SSML request, collects binary audio chunks,
 * and returns base64-encoded MP3.
 */
async function ttsWithEdge(text: string, voice = EDGE_TTS_DEFAULT_VOICE): Promise<TtsResult> {
  return new Promise((resolve, reject) => {
    const secMsGec = generateSecMsGec()
    const connId = crypto.randomUUID().replace(/-/g, '')
    const muid = crypto.randomBytes(16).toString('hex').toUpperCase()

    const url = [
      `${EDGE_TTS_WS_URL}`,
      `?TrustedClientToken=${EDGE_TTS_TRUSTED_TOKEN}`,
      `&ConnectionId=${connId}`,
      `&Sec-MS-GEC=${secMsGec}`,
      `&Sec-MS-GEC-Version=1-${EDGE_TTS_CHROMIUM_FULL}`,
    ].join('')

    const ws = new WebSocket(url, {
      headers: {
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${EDGE_TTS_CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${EDGE_TTS_CHROMIUM_MAJOR}.0.0.0`,
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: `muid=${muid};`,
      },
    })

    const audioChunks: Buffer[] = []
    let gotTurnEnd = false

    // Safety timeout — close connection if no response within 8 s.
    // Reduced from 30 s so a stale Edge TTS connection fails quickly and
    // the provider fallback chain (Gemini → Edge → ElevenLabs) can kick in
    // without blocking the TTS pipeline for half a minute.
    const timeout = setTimeout(() => {
      ws.terminate()
      reject(new Error('Edge TTS: connection timeout'))
    }, EDGE_TTS_TIMEOUT_MS)

    ws.on('open', () => {
      // 1. Send speech.config
      const ts = new Date().toUTCString()
      const configMsg = [
        `X-Timestamp:${ts}`,
        'Content-Type:application/json; charset=utf-8',
        'Path:speech.config',
        '',
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: {
                  sentenceBoundaryEnabled: 'false',
                  wordBoundaryEnabled: 'false',
                },
                // Lower bitrate: 32 kbps vs 48 kbps — ~33% smaller file, measurably
                // faster to transfer over IPC without noticeable quality loss for TTS.
                outputFormat: 'audio-16khz-32kbitrate-mono-mp3',
              },
            },
          },
        }),
      ].join('\r\n')
      ws.send(configMsg)

      // 2. Send SSML
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      const ssml = [
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>`,
        `<voice name='${voice}'>`,
        `<prosody pitch='+0Hz' rate='${EDGE_TTS_DEFAULT_RATE}' volume='+0%'>${escaped}</prosody>`,
        `</voice></speak>`,
      ].join('')

      const reqId = crypto.randomUUID().replace(/-/g, '')
      const ssmlMsg = [
        `X-RequestId:${reqId}`,
        'Content-Type:application/ssml+xml',
        `X-Timestamp:${new Date().toUTCString()}Z`,
        'Path:ssml',
        '',
        ssml,
      ].join('\r\n')
      ws.send(ssmlMsg)
    })

    ws.on('message', (data: Buffer | string, isBinary: boolean) => {
      if (isBinary) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as unknown as ArrayBuffer)
        // Binary message format: 2-byte big-endian header length + header + audio data
        if (buf.length > 2) {
          const headerLen = buf.readUInt16BE(0)
          const audioStart = 2 + headerLen
          if (buf.length > audioStart) {
            audioChunks.push(buf.slice(audioStart))
          }
        }
      } else {
        const msg = data.toString()
        if (msg.includes('Path:turn.end')) {
          gotTurnEnd = true
          ws.close()
        }
      }
    })

    ws.on('close', () => {
      clearTimeout(timeout)
      if (audioChunks.length > 0 || gotTurnEnd) {
        const combined = Buffer.concat(audioChunks)
        resolve({
          success: true,
          audioBase64: combined.toString('base64'),
          mimeType: 'audio/mpeg',
          provider: 'edge',
        })
      } else {
        reject(new Error('Edge TTS: no audio received'))
      }
    })

    ws.on('error', (err: Error) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

// ── Gemini TTS ────────────────────────────────────────────────────────────────

/**
 * Synthesize text using Google Gemini TTS REST API.
 * Uses gemini-2.5-flash-preview-tts with the Aoede prebuilt voice.
 * Returns base64-encoded WAV audio.
 *
 * Request shape:
 *   POST /v1beta/models/{model}:generateContent?key={apiKey}
 *   { contents: [{parts:[{text}]}], generationConfig: { responseModalities:['AUDIO'],
 *     speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } } }
 *
 * Response shape:
 *   { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
 */
async function ttsWithGemini(text: string, apiKey: string): Promise<TtsResult> {
  const url = `${GEMINI_API_BASE}/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE_NAME },
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    const status = response.status
    if (status === 401 || status === 403) {
      throw Object.assign(new Error('Gemini TTS: invalid API key'), { code: 'INVALID_KEY' })
    }
    if (status === 429) {
      throw Object.assign(new Error('Gemini TTS: rate limit exceeded'), { code: 'RATE_LIMIT' })
    }
    throw new Error(`Gemini TTS HTTP ${status}: ${errText}`)
  }

  // biome-ignore lint/suspicious/noExplicitAny: Gemini REST response shape
  const data: any = await response.json()
  const inlineData = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData
  if (!inlineData?.data) {
    throw new Error('Gemini TTS: no audio data in response')
  }

  return {
    success: true,
    audioBase64: inlineData.data as string,
    mimeType: (inlineData.mimeType as string) ?? 'audio/wav',
    provider: 'gemini',
  }
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────

/**
 * Synthesize text using ElevenLabs REST API.
 * Uses eleven_multilingual_v2 model for best cross-language quality.
 */
async function ttsWithElevenLabs(
  text: string,
  apiKey: string,
  voiceId = ELEVENLABS_DEFAULT_VOICE_ID,
): Promise<TtsResult> {
  const url = `${ELEVENLABS_API_BASE}/v1/text-to-speech/${voiceId}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_TTS_MODEL,
      voice_settings: {
        stability: ELEVENLABS_STABILITY,
        similarity_boost: ELEVENLABS_SIMILARITY_BOOST,
        style: ELEVENLABS_STYLE,
        use_speaker_boost: true,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    const status = response.status
    if (status === 401) throw Object.assign(new Error('ElevenLabs: invalid API key'), { code: 'INVALID_KEY' })
    if (status === 429) throw Object.assign(new Error('ElevenLabs: rate limit exceeded'), { code: 'RATE_LIMIT' })
    throw new Error(`ElevenLabs TTS HTTP ${status}: ${errText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return { success: true, audioBase64: base64, mimeType: 'audio/mpeg', provider: 'elevenlabs' }
}

// ── IPC handler ───────────────────────────────────────────────────────────────

/**
 * Register all Text-to-Speech IPC handlers with the Electron main process.
 *
 * Handler: `audio:tts`
 *   - Params: `{ text: string, voice?: OpenAI voice name }`
 *   - Returns: `{ success, audioBase64?, mimeType?, provider?, error?, errorCode? }`
 *
 * Provider selection (in priority order):
 *  1. OpenAI tts-1  — if OpenAI key is present.
 *  2. Gemini TTS    — if Gemini key is present (reuses existing key, no extra cost).
 *  3. Edge TTS      — always available; Microsoft Neural voices, no key required.
 *  4. ElevenLabs    — if ElevenLabs key is present.
 *
 * Hard failures (invalid key, rate limit) are surfaced immediately.
 * Soft failures (network, temporary) fall through to the next provider.
 * If all fail, the renderer falls back to OS speech synthesis.
 */
export function registerTtsHandlers(ipcMain: IpcMain) {
  ipcMain.handle('audio:tts', async (_event, params: TtsParams): Promise<TtsResult> => {
    const { text, voice = 'nova' } = params
    console.log('[tts] Request: text length =', text.length, '| voice =', voice)

    const openaiKey     = getStoredApiKey('openai')
    const geminiKey     = getStoredApiKey('gemini')
    const elevenlabsKey = getStoredApiKey('elevenlabs')

    const candidates = rankTtsCandidates(openaiKey, geminiKey, elevenlabsKey)

    console.log(
      '[tts] Candidate order:',
      candidates.map((c, i) => `${i + 1}. ${c.provider} — ${c.reason}`).join(' | '),
    )

    for (const candidate of candidates) {
      console.log(`[tts] Trying ${candidate.provider}`)
      try {
        if (candidate.provider === 'openai' && openaiKey) {
          const result = await ttsWithOpenAI(text, voice, openaiKey)
          console.log('[tts] ✓ OpenAI TTS succeeded')
          return result
        }

        if (candidate.provider === 'gemini' && geminiKey) {
          const result = await ttsWithGemini(text, geminiKey)
          console.log('[tts] ✓ Gemini TTS succeeded')
          return result
        }

        if (candidate.provider === 'edge') {
          const result = await ttsWithEdge(text)
          console.log('[tts] ✓ Edge TTS succeeded')
          return result
        }

        if (candidate.provider === 'elevenlabs' && elevenlabsKey) {
          const result = await ttsWithElevenLabs(text, elevenlabsKey)
          console.log('[tts] ✓ ElevenLabs TTS succeeded')
          return result
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // biome-ignore lint/suspicious/noExplicitAny: error code from thrown object
        const code = (err as any)?.code

        console.warn(`[tts] ${candidate.provider} TTS failed:`, msg)

        // Hard failures — surface immediately without trying next provider
        if (
          code === 'INVALID_KEY' ||
          msg.includes('401') ||
          msg.includes('403') ||
          msg.includes('invalid_api_key') ||
          msg.includes('API_KEY_INVALID')
        ) {
          return {
            success: false,
            error: `Invalid ${candidate.provider} API key.`,
            errorCode: 'INVALID_KEY',
          }
        }
        if (
          code === 'RATE_LIMIT' ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED')
        ) {
          return {
            success: false,
            error: `${candidate.provider} rate limit exceeded.`,
            errorCode: 'RATE_LIMIT',
          }
        }

        // Soft failure — try next candidate
        console.warn(`[tts] Soft failure on ${candidate.provider}, falling through to next candidate`)
      }
    }

    // All candidates failed
    return {
      success: false,
      error: 'All TTS providers failed. Check your connection and try again.',
      errorCode: 'NETWORK',
    }
  })
}
