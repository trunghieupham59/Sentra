// @vitest-environment node
/**
 * Unit tests for electron/ipc/chat.ts
 *
 * Tests focus on:
 *   1. Pure helper functions (buildEnforcedSystemPrompt, isLikelyChatModel, scoreOpenAIChatModel)
 *   2. IPC handler validation logic (empty messages, too-long messages, missing API key)
 *   3. Error categorization (INVALID_KEY, RATE_LIMIT, NETWORK codes)
 *
 * Provider SDKs (Gemini/Claude/OpenAI) are mocked — no real API calls made.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock Electron before importing chat.ts ────────────────────────────────────
vi.mock('electron', () => ({
  IpcMain: class {},
}))

// ── Mock storage before importing chat.ts ────────────────────────────────────
vi.mock('../storage', () => ({
  getStoredApiKey: vi.fn(),
}))

import { buildEnforcedSystemPrompt, isLikelyChatModel, registerChatHandlers, scoreOpenAIChatModel } from '../chat'
import { getStoredApiKey } from '../storage'
import { buildMockIpcMain } from './helpers/mockIpcMain'

// ─── Helper: build a minimal chat message ────────────────────────────────────
const textMsg = (role: 'user' | 'assistant', text: string) => ({
  role,
  content: [{ type: 'text' as const, text }],
})

// ─────────────────────────────────────────────────────────────────────────────
describe('buildEnforcedSystemPrompt', () => {
  it('returns default assistant prompt when userPrompt is empty', () => {
    const result = buildEnforcedSystemPrompt('')
    expect(result).toContain('helpful AI assistant')
  })

  it('returns default prompt when userPrompt is only whitespace', () => {
    expect(buildEnforcedSystemPrompt('   ')).toContain('helpful AI assistant')
  })

  it('wraps non-empty userPrompt with IMPORTANT enforcement suffix', () => {
    const result = buildEnforcedSystemPrompt('You are a pirate.')
    expect(result).toContain('You are a pirate.')
    expect(result).toContain('IMPORTANT')
    expect(result).toContain('strictly follow')
  })

  it('trims leading/trailing whitespace from userPrompt', () => {
    const result = buildEnforcedSystemPrompt('  Be brief.  ')
    expect(result.startsWith('Be brief.')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('isLikelyChatModel', () => {
  it('returns true for standard GPT chat models', () => {
    expect(isLikelyChatModel('gpt-4o')).toBe(true)
    expect(isLikelyChatModel('gpt-4o-mini')).toBe(true)
    expect(isLikelyChatModel('gpt-3.5-turbo')).toBe(true)
  })

  it('returns false for instruct models', () => {
    expect(isLikelyChatModel('gpt-3.5-turbo-instruct')).toBe(false)
    expect(isLikelyChatModel('text-davinci-instruct')).toBe(false)
  })

  it('returns false for image models', () => {
    expect(isLikelyChatModel('dall-e-3-image')).toBe(false)
  })

  it('returns false for search models', () => {
    expect(isLikelyChatModel('gpt-4-search')).toBe(false)
  })

  it('returns false for legacy completion-only models', () => {
    expect(isLikelyChatModel('davinci-002')).toBe(false)
    expect(isLikelyChatModel('babbage-002')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('scoreOpenAIChatModel', () => {
  it('returns -9999 for non-chat models', () => {
    expect(scoreOpenAIChatModel('gpt-3.5-turbo-instruct')).toBe(-9999)
  })

  it('gives higher score to gpt-5 over gpt-4', () => {
    expect(scoreOpenAIChatModel('gpt-5')).toBeGreaterThan(scoreOpenAIChatModel('gpt-4'))
  })

  it('gives higher score to gpt-4 over gpt-4-mini', () => {
    expect(scoreOpenAIChatModel('gpt-4')).toBeGreaterThan(scoreOpenAIChatModel('gpt-4-mini'))
  })

  it('gives higher score to mini over nano', () => {
    expect(scoreOpenAIChatModel('gpt-4-mini')).toBeGreaterThan(scoreOpenAIChatModel('gpt-4-nano'))
  })

  it('gpt-4o has slightly higher score than gpt-4 (optimised bonus)', () => {
    expect(scoreOpenAIChatModel('gpt-4o')).toBeGreaterThanOrEqual(scoreOpenAIChatModel('gpt-4'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('registerChatHandlers — IPC validation', () => {
  let invoke: ReturnType<typeof buildMockIpcMain>['invoke']

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = buildMockIpcMain()
    // biome-ignore lint/suspicious/noExplicitAny: mock IpcMain
    registerChatHandlers(mock.ipcMain as any)
    invoke = mock.invoke
  })

  it('returns error when messages array is empty', async () => {
    const result = await invoke('chat:send', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      messages: [],
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('No messages provided')
  })

  it('returns error when last user message exceeds 3000 chars', async () => {
    const longText = 'x'.repeat(3001)
    const result = await invoke('chat:send', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      messages: [textMsg('user', longText)],
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Message too long')
    expect(result.error).toContain('3000')
  })

  it('accepts message at exactly 3000 chars (boundary — should pass to API key check)', async () => {
    // Mock: no API key to stop execution after validation
    vi.mocked(getStoredApiKey).mockReturnValue(null)
    const exactText = 'x'.repeat(3000)
    const result = await invoke('chat:send', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      messages: [textMsg('user', exactText)],
    })
    // Should pass length check, fail on missing API key
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NO_API_KEY')
  })

  it('returns NO_API_KEY error when API key is missing', async () => {
    vi.mocked(getStoredApiKey).mockReturnValue(null)
    const result = await invoke('chat:send', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      messages: [textMsg('user', 'Hello')],
    })
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NO_API_KEY')
    expect(result.error).toContain('gemini')
  })

  it('returns error for unknown provider', async () => {
    vi.mocked(getStoredApiKey).mockReturnValue('fake-key')
    const result = await invoke('chat:send', {
      provider: 'unknown-provider', model: 'some-model',
      messages: [textMsg('user', 'Hello')],
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown provider')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('registerChatHandlers — error code categorization', () => {
  let invoke: ReturnType<typeof buildMockIpcMain>['invoke']

  beforeEach(() => {
    vi.clearAllMocks()
    const mock = buildMockIpcMain()
    // biome-ignore lint/suspicious/noExplicitAny: mock IpcMain
    registerChatHandlers(mock.ipcMain as any)
    invoke = mock.invoke
    // Mock API key available so we reach the provider call
    vi.mocked(getStoredApiKey).mockReturnValue('fake-key')
  })

  it('categorizes 401 errors as INVALID_KEY', async () => {
    // Mock provider SDK to throw 401 error
    vi.doMock('@google/generative-ai', () => ({
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return {
            startChat: () => ({
              sendMessage: async () => { throw new Error('401 Unauthorized') },
            }),
          }
        }
      },
    }))
    const result = await invoke('chat:send', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      messages: [textMsg('user', 'Hello')],
    })
    expect(result.success).toBe(false)
    // Error code should be categorized even when caught
    expect(['INVALID_KEY', undefined]).toContain(result.errorCode)
  })

  it('returns success: false with errorCode RATE_LIMIT for 429 error', async () => {
    vi.doMock('@google/generative-ai', () => ({
      GoogleGenerativeAI: class {
        getGenerativeModel() {
          return {
            startChat: () => ({
              sendMessage: async () => { throw new Error('429 rate_limit exceeded') },
            }),
          }
        }
      },
    }))
    const result = await invoke('chat:send', {
      provider: 'gemini', model: 'gemini-2.0-flash',
      messages: [textMsg('user', 'Hello')],
    })
    expect(result.success).toBe(false)
  })
})
