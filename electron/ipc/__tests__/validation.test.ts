// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseChatParams } from '../chatValidation'
import { isAllowedExternalUrl } from '../externalUrl'
import { MAX_CHAT_REQUEST_CHARS } from '../ipcConstants'
import { parseQuickChatSeedPayload } from '../quickChat'
import { parseTranslateParams } from '../translateValidation'

const chatPayload = (text: string, overrides: Record<string, unknown> = {}) => ({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [
    {
      role: 'user',
      content: [{ type: 'text', text }],
    },
  ],
  ...overrides,
})

const translatePayload = (overrides: Record<string, unknown> = {}) => ({
  provider: 'openai',
  model: 'gpt-4o',
  sourceText: 'Hello',
  sourceLang: 'en',
  targetLang: 'vi',
  ...overrides,
})

describe('isAllowedExternalUrl', () => {
  it('allows public web URLs and approved macOS Settings URLs', () => {
    expect(isAllowedExternalUrl('https://github.com/trunghieupham59/Viezan/releases/latest')).toBe(true)
    expect(isAllowedExternalUrl('https://console.groq.com')).toBe(true)
    expect(isAllowedExternalUrl('https://luatvietnam.vn/co-cau-to-chuc/quy-dinh.html')).toBe(true)
    expect(isAllowedExternalUrl('http://www.cchccantho.gov.vn/danh-muc-chuc-danh')).toBe(true)
    expect(isAllowedExternalUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')).toBe(true)
  })

  it('rejects unsafe hosts, protocols, credentials, and near-miss system paths', () => {
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedExternalUrl('data:text/html,hello')).toBe(false)
    expect(isAllowedExternalUrl('https://evil.example.com')).toBe(false)
    expect(isAllowedExternalUrl('https://localhost:5173')).toBe(false)
    expect(isAllowedExternalUrl('https://127.0.0.1:11434')).toBe(false)
    expect(isAllowedExternalUrl('https://192.168.1.10')).toBe(false)
    expect(isAllowedExternalUrl('http://[::1]:3000')).toBe(false)
    expect(isAllowedExternalUrl('https://user:pass@example.org')).toBe(false)
    expect(isAllowedExternalUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera')).toBe(false)
    expect(isAllowedExternalUrl('not a url')).toBe(false)
  })
})

describe('parseChatParams', () => {
  it('rejects oversized user messages unless bypass is explicitly enabled', () => {
    const longText = 'x'.repeat(MAX_CHAT_REQUEST_CHARS + 1)
    const blocked = parseChatParams(chatPayload(longText))
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.response.error).toContain('Message too long')

    const bypassed = parseChatParams(chatPayload(longText, { bypassLengthCheck: true }))
    expect(bypassed.ok).toBe(true)
  })

  it('rejects unsupported image MIME types', () => {
    const result = parseChatParams(chatPayload('', {
      messages: [
        {
          role: 'user',
          content: [{ type: 'image', imageBase64: 'abc', imageMimeType: 'image/svg+xml' }],
        },
      ],
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response).toMatchObject({ error: 'Invalid chat image content', errorCode: 'INVALID_INPUT' })
  })
})

describe('parseQuickChatSeedPayload', () => {
  it('accepts a valid quick chat seed payload', () => {
    expect(parseQuickChatSeedPayload({
      question: 'Open this in chat',
      response: 'Done',
      provider: 'local',
      model: 'local-auto',
    })).toEqual({
      question: 'Open this in chat',
      response: 'Done',
      provider: 'local',
      model: 'local-auto',
    })
  })

  it('rejects invalid quick chat seed payloads', () => {
    expect(parseQuickChatSeedPayload({ question: '', provider: 'local', model: 'local-auto' })).toBeNull()
    expect(parseQuickChatSeedPayload({
      question: 'x'.repeat(MAX_CHAT_REQUEST_CHARS + 1),
      provider: 'local',
      model: 'local-auto',
    })).toBeNull()
    expect(parseQuickChatSeedPayload({ question: 'Hello', provider: 'unknown', model: 'm' })).toBeNull()
  })
})

describe('parseTranslateParams', () => {
  it('trims provider/model and accepts valid optional modes', () => {
    const result = parseTranslateParams(translatePayload({
      provider: ' openai ',
      model: ' gpt-4o ',
      phoneticMode: 'standard',
      translationStyle: 'technical',
      reasoningEffort: 'medium',
      showFurigana: true,
    }))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.provider).toBe('openai')
      expect(result.value.model).toBe('gpt-4o')
      expect(result.value.translationStyle).toBe('technical')
      expect(result.value.reasoningEffort).toBe('medium')
    }
  })

  it('rejects unsafe language codes and invalid phonetic modes', () => {
    const invalidLanguage = parseTranslateParams(translatePayload({ sourceLang: '../en' }))
    expect(invalidLanguage.ok).toBe(false)
    if (!invalidLanguage.ok) expect(invalidLanguage.response.error).toBe('Invalid source language')

    const invalidPhonetic = parseTranslateParams(translatePayload({ phoneticMode: 'kana' }))
    expect(invalidPhonetic.ok).toBe(false)
    if (!invalidPhonetic.ok) expect(invalidPhonetic.response.error).toBe('Invalid phonetic mode')

    const invalidReasoning = parseTranslateParams(translatePayload({ reasoningEffort: 'extreme' }))
    expect(invalidReasoning.ok).toBe(false)
    if (!invalidReasoning.ok) expect(invalidReasoning.response.error).toBe('Invalid reasoning effort')
  })
})
