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
  it('allows approved HTTPS and macOS Settings URLs', () => {
    expect(isAllowedExternalUrl('https://github.com/trunghieupham59/Viezan/releases/latest')).toBe(true)
    expect(isAllowedExternalUrl('https://console.groq.com')).toBe(true)
    expect(isAllowedExternalUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')).toBe(true)
  })

  it('rejects unapproved hosts, protocols, and near-miss paths', () => {
    expect(isAllowedExternalUrl('http://github.com/trunghieupham59/Viezan/releases/latest')).toBe(false)
    expect(isAllowedExternalUrl('https://evil.example.com')).toBe(false)
    expect(isAllowedExternalUrl('https://github.com/trunghieupham59/Viezan/releases-malicious')).toBe(false)
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
      showFurigana: true,
    }))

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.provider).toBe('openai')
      expect(result.value.model).toBe('gpt-4o')
      expect(result.value.translationStyle).toBe('technical')
    }
  })

  it('rejects unsafe language codes and invalid phonetic modes', () => {
    const invalidLanguage = parseTranslateParams(translatePayload({ sourceLang: '../en' }))
    expect(invalidLanguage.ok).toBe(false)
    if (!invalidLanguage.ok) expect(invalidLanguage.response.error).toBe('Invalid source language')

    const invalidPhonetic = parseTranslateParams(translatePayload({ phoneticMode: 'kana' }))
    expect(invalidPhonetic.ok).toBe(false)
    if (!invalidPhonetic.ok) expect(invalidPhonetic.response.error).toBe('Invalid phonetic mode')
  })
})
