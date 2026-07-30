// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TranscribeAudioParams } from '../../../shared/audioTranscription'

const providerMocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  groqCreate: vi.fn(),
  openAiCreate: vi.fn(),
}))

vi.mock('electron', () => ({ IpcMain: class {} }))

vi.mock('../storage', () => ({
  getStoredApiKey: vi.fn(),
  hasStoredApiKey: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    audio: { transcriptions: { create: typeof providerMocks.openAiCreate } }

    // biome-ignore lint/suspicious/noExplicitAny: provider SDK constructor test double
    constructor(options: any) {
      this.audio = {
        transcriptions: {
          create: options.baseURL ? providerMocks.groqCreate : providerMocks.openAiCreate,
        },
      }
    }
  },
}))

import { getStoredApiKey, hasStoredApiKey } from '../storage'
import { MAX_TRANSCRIPTION_AUDIO_BYTES, registerTranscribeHandlers } from '../transcribe'
import { buildMockIpcMain } from './helpers/mockIpcMain'

function makeParams(overrides: Partial<TranscribeAudioParams> = {}): TranscribeAudioParams {
  return {
    requestId: 'voice-request-1',
    purpose: 'dictation',
    audioData: new ArrayBuffer(1_000),
    mimeType: 'audio/webm;codecs=opus',
    language: undefined,
    previousText: undefined,
    sttProvider: 'auto',
    ...overrides,
  }
}

describe('audio transcription IPC', () => {
  let invoke: ReturnType<typeof buildMockIpcMain>['invoke']

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', providerMocks.fetch)
    vi.mocked(getStoredApiKey).mockReturnValue(null)
    vi.mocked(hasStoredApiKey).mockReturnValue(false)
    providerMocks.openAiCreate.mockResolvedValue({ text: 'hello', segments: [] })
    providerMocks.groqCreate.mockResolvedValue({ text: 'hello from Groq', segments: [] })
    providerMocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'hello from Gemini' }] } }] }),
    })

    const mock = buildMockIpcMain()
    // biome-ignore lint/suspicious/noExplicitAny: focused IPC test helper
    registerTranscribeHandlers(mock.ipcMain as any)
    invoke = mock.invoke
  })

  it('rejects malformed request IDs at the main-process boundary', async () => {
    const result = await invoke('audio:transcribe', makeParams({ requestId: '../unsafe' }))

    expect(result).toEqual({ success: false, errorCode: 'INVALID_INPUT', retryable: false })
  })

  it('rejects unsupported normalized audio MIME types', async () => {
    const result = await invoke('audio:transcribe', makeParams({ mimeType: 'audio/x-unknown' }))

    expect(result).toEqual({ success: false, errorCode: 'UNSUPPORTED_FORMAT', retryable: false })
  })

  it('rejects dictation recordings below the minimum payload size', async () => {
    const result = await invoke('audio:transcribe', makeParams({ audioData: new ArrayBuffer(999) }))

    expect(result).toEqual({ success: false, errorCode: 'AUDIO_TOO_SHORT', retryable: false })
  })

  it('rejects audio payloads above the 10 MiB hard cap', async () => {
    const result = await invoke('audio:transcribe', makeParams({
      audioData: new ArrayBuffer(MAX_TRANSCRIPTION_AUDIO_BYTES + 1),
    }))

    expect(result).toEqual({ success: false, errorCode: 'AUDIO_TOO_LARGE', retryable: false })
  })

  it('normalizes codec MIME suffixes and returns a discriminated success result', async () => {
    vi.mocked(getStoredApiKey).mockImplementation(provider => provider === 'openai' ? 'openai-key' : null)

    const result = await invoke('audio:transcribe', makeParams({ sttProvider: 'whisper' }))

    expect(result).toMatchObject({ success: true, text: 'hello', usedProvider: 'whisper' })
    expect(providerMocks.openAiCreate).toHaveBeenCalledOnce()
  })

  it('uses sequential dictation fallback and sends the Gemini key in a header', async () => {
    vi.mocked(getStoredApiKey).mockImplementation(provider => {
      if (provider === 'openai') return 'openai-key'
      if (provider === 'gemini') return 'gemini-key'
      if (provider === 'groq') return 'groq-key'
      return null
    })
    providerMocks.openAiCreate.mockRejectedValueOnce(new Error('401 invalid_api_key raw detail'))

    const result = await invoke('audio:transcribe', makeParams())

    expect(result).toEqual({ success: true, text: 'hello from Gemini', usedProvider: 'gemini' })
    expect(providerMocks.openAiCreate).toHaveBeenCalledOnce()
    expect(providerMocks.fetch).toHaveBeenCalledOnce()
    expect(providerMocks.groqCreate).not.toHaveBeenCalled()
    const [url, options] = providerMocks.fetch.mock.calls[0]
    expect(url).not.toContain('gemini-key')
    expect(options.headers).toMatchObject({ 'x-goog-api-key': 'gemini-key' })
  })

  it('never exposes raw provider error messages to the renderer', async () => {
    vi.mocked(getStoredApiKey).mockImplementation(provider => provider === 'openai' ? 'bad-key' : null)
    providerMocks.openAiCreate.mockRejectedValueOnce(new Error('401 raw-secret-provider-detail'))

    const result = await invoke('audio:transcribe', makeParams({ sttProvider: 'whisper' }))

    expect(result).toEqual({ success: false, errorCode: 'INVALID_KEY', retryable: false })
    expect(result).not.toHaveProperty('error')
    expect(JSON.stringify(result)).not.toContain('raw-secret-provider-detail')
  })

  it('distinguishes an unconfigured auto route from provider failures', async () => {
    const result = await invoke('audio:transcribe', makeParams())

    expect(result).toEqual({
      success: false,
      errorCode: 'ALL_PROVIDERS_EXHAUSTED',
      retryable: false,
    })
  })

  it('cancels an in-flight provider request by request ID', async () => {
    vi.mocked(getStoredApiKey).mockImplementation(provider => provider === 'openai' ? 'openai-key' : null)
    providerMocks.openAiCreate.mockImplementation((_body, options: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        const rejectAsAborted = () => {
          const error = new Error('request aborted')
          error.name = 'AbortError'
          reject(error)
        }
        if (options.signal.aborted) rejectAsAborted()
        else options.signal.addEventListener('abort', rejectAsAborted, { once: true })
      }))

    const pendingResult = invoke('audio:transcribe', makeParams({ sttProvider: 'whisper' }))
    await vi.waitFor(() => expect(providerMocks.openAiCreate).toHaveBeenCalledOnce())

    const cancelResult = await invoke('audio:cancelTranscription', { requestId: 'voice-request-1' })

    expect(cancelResult).toEqual({ success: true, cancelled: true })
    await expect(pendingResult).resolves.toEqual({
      success: false,
      errorCode: 'CANCELLED',
      retryable: false,
    })
  })
})
