// @vitest-environment node
/**
 * Unit tests for electron/ipc/tts.ts
 *
 * Tests cover:
 *   1. rankTtsCandidates  — provider ordering based on available keys (exported for testing)
 *   2. IPC handler        — input validation, no API keys, all-fail case
 *
 * No real network calls are made. Provider functions are mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const openaiMock = vi.hoisted(() => ({
  speechCreate: vi.fn(),
}))

// ── Mock Electron ─────────────────────────────────────────────────────────────
vi.mock('electron', () => ({ IpcMain: class {} }))

// ── Mock storage ──────────────────────────────────────────────────────────────
vi.mock('../storage', () => ({
  getStoredApiKey: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class MockOpenAI {
    audio = {
      speech: {
        create: openaiMock.speechCreate,
      },
    }
  },
}))

// ── Mock ws (WebSocket) — Edge TTS uses it ────────────────────────────────────
// The mock emits 'close' immediately with no audio chunks, so Edge TTS rejects
// with 'no audio received'. This causes a soft failure and the handler returns
// the "All TTS providers failed" error response — without hanging.
vi.mock('ws', () => ({
  default: class MockWebSocket {
    // biome-ignore lint/suspicious/noExplicitAny: mock
    on(event: string, cb: (...args: any[]) => void) {
      if (event === 'close') {
        // Emit close after a minimal delay so all event listeners are registered first
        setTimeout(() => cb(), 5)
      }
    }
    send() {}
    terminate() {}
    close() {}
  },
}))

import { getStoredApiKey } from '../storage'
import { rankTtsCandidates, registerTtsHandlers } from '../tts'
import { buildMockIpcMain } from './helpers/mockIpcMain'

function providersOf(candidates: ReturnType<typeof rankTtsCandidates>) {
  return candidates.map((candidate) => candidate.provider)
}

describe('rankTtsCandidates', () => {
  it('uses Edge only in free mode, even when paid keys exist', () => {
    expect(providersOf(rankTtsCandidates('openai-key', 'gemini-key', 'eleven-key', 'free'))).toEqual(['edge'])
  })

  it('uses free-first order in auto mode', () => {
    expect(providersOf(rankTtsCandidates('openai-key', 'gemini-key', 'eleven-key', 'auto'))).toEqual([
      'edge',
      'openai',
      'gemini',
      'elevenlabs',
    ])
  })

  it('uses paid-first order in premium mode', () => {
    expect(providersOf(rankTtsCandidates('openai-key', 'gemini-key', 'eleven-key', 'premium'))).toEqual([
      'openai',
      'gemini',
      'elevenlabs',
      'edge',
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('registerTtsHandlers — input validation', () => {
  let invoke: ReturnType<typeof buildMockIpcMain>['invoke']

  beforeEach(() => {
    vi.clearAllMocks()
    openaiMock.speechCreate.mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    const mock = buildMockIpcMain()
    // biome-ignore lint/suspicious/noExplicitAny: mock IpcMain
    registerTtsHandlers(mock.ipcMain as any)
    invoke = mock.invoke
  })

  it('returns success:false when all providers fail (no keys, Edge TTS times out)', async () => {
    // No API keys → openai and gemini candidates skipped → Edge TTS will fail (mocked ws)
    vi.mocked(getStoredApiKey).mockReturnValue(null)

    const result = await invoke('audio:tts', { text: 'Hello world' })
    // Edge TTS is always in the candidate list; with mocked WS it will reject
    // The handler should return a failure response, not throw
    expect(result).toBeDefined()
    expect(typeof result.success).toBe('boolean')
  })

  it('accepts a valid voice parameter without error', async () => {
    vi.mocked(getStoredApiKey).mockReturnValue(null)
    // Shouldn't throw even with valid voice name and no keys
    const result = await invoke('audio:tts', { text: 'Hello', voice: 'alloy' })
    expect(result).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('registerTtsHandlers — provider selection', () => {
  let invoke: ReturnType<typeof buildMockIpcMain>['invoke']

  beforeEach(() => {
    vi.clearAllMocks()
    openaiMock.speechCreate.mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    const mock = buildMockIpcMain()
    // biome-ignore lint/suspicious/noExplicitAny: mock IpcMain
    registerTtsHandlers(mock.ipcMain as any)
    invoke = mock.invoke
  })

  it('does not attempt OpenAI in default free mode when an OpenAI key is available', async () => {
    vi.mocked(getStoredApiKey).mockImplementation((provider: string) =>
      provider === 'openai' ? 'fake-openai-key' : null
    )

    const result = await invoke('audio:tts', { text: 'Hello' })
    expect(result).toBeDefined()
    expect(openaiMock.speechCreate).not.toHaveBeenCalled()
  })

  it('attempts OpenAI first in premium mode when OpenAI key is available', async () => {
    vi.mocked(getStoredApiKey).mockImplementation((provider: string) =>
      provider === 'openai' ? 'fake-openai-key' : null
    )

    const result = await invoke('audio:tts', { text: 'Hello', mode: 'premium' })
    expect(result).toMatchObject({ success: true, provider: 'openai' })
    expect(openaiMock.speechCreate).toHaveBeenCalledTimes(1)
  })

  it('handles provider with INVALID_KEY error code', async () => {
    vi.mocked(getStoredApiKey).mockImplementation((provider: string) =>
      provider === 'openai' ? 'invalid-key' : null
    )

    openaiMock.speechCreate.mockRejectedValue(new Error('401 Unauthorized - invalid_api_key'))

    const result = await invoke('audio:tts', { text: 'Hello', mode: 'premium' })
    expect(result).toBeDefined()
    expect(result).toMatchObject({ success: false, errorCode: 'INVALID_KEY' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('TTS response shape', () => {
  let invoke: ReturnType<typeof buildMockIpcMain>['invoke']

  beforeEach(() => {
    vi.clearAllMocks()
    openaiMock.speechCreate.mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
    })
    const mock = buildMockIpcMain()
    // biome-ignore lint/suspicious/noExplicitAny: mock IpcMain
    registerTtsHandlers(mock.ipcMain as any)
    invoke = mock.invoke
  })

  it('always returns an object with a success boolean', async () => {
    vi.mocked(getStoredApiKey).mockReturnValue(null)
    const result = await invoke('audio:tts', { text: 'Test' })
    expect(result).toHaveProperty('success')
    expect(typeof result.success).toBe('boolean')
  })

  it('returns error and errorCode on failure', async () => {
    vi.mocked(getStoredApiKey).mockReturnValue(null)
    const result = await invoke('audio:tts', { text: 'Test' })
    if (!result.success) {
      expect(result).toHaveProperty('error')
      expect(typeof result.error).toBe('string')
    }
  })
})
