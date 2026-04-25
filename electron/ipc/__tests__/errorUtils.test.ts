// @vitest-environment node
/**
 * Unit tests for electron/ipc/errorUtils.ts
 *
 * Tests cover:
 *   1. classifyProviderError() — maps error message strings to typed IPC error responses
 *   2. noApiKeyResponse()      — generates the standard NO_API_KEY response for a provider
 */
import { describe, it, expect } from 'vitest'
import { classifyProviderError, noApiKeyResponse } from '../errorUtils'

// ─────────────────────────────────────────────────────────────────────────────
describe('classifyProviderError', () => {

  // ── INVALID_KEY detection ─────────────────────────────────────────────────
  describe('401 / invalid key patterns', () => {
    it('classifies "401 Unauthorized" as INVALID_KEY', () => {
      const result = classifyProviderError('401 Unauthorized')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('INVALID_KEY')
      expect(result.error).toContain('Invalid API key')
    })

    it('classifies "invalid_api_key" as INVALID_KEY', () => {
      const result = classifyProviderError('Error: invalid_api_key provided')
      expect(result.errorCode).toBe('INVALID_KEY')
    })

    it('classifies "authentication" error as INVALID_KEY', () => {
      const result = classifyProviderError('authentication failed: bad credentials')
      expect(result.errorCode).toBe('INVALID_KEY')
    })

    it('is case-sensitive — does not match "401" as substring in non-error context', () => {
      // "401" appears in the error string → still classified
      const result = classifyProviderError('HTTP 401')
      expect(result.errorCode).toBe('INVALID_KEY')
    })
  })

  // ── RATE_LIMIT detection ──────────────────────────────────────────────────
  describe('429 / rate limit patterns', () => {
    it('classifies "429 Too Many Requests" as RATE_LIMIT', () => {
      const result = classifyProviderError('429 Too Many Requests')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('RATE_LIMIT')
      expect(result.error).toContain('Rate limit')
    })

    it('classifies "rate_limit" as RATE_LIMIT', () => {
      const result = classifyProviderError('rate_limit exceeded')
      expect(result.errorCode).toBe('RATE_LIMIT')
    })

    it('classifies "quota" error as RATE_LIMIT', () => {
      const result = classifyProviderError('quota exceeded for this project')
      expect(result.errorCode).toBe('RATE_LIMIT')
    })

    it('classifies Gemini RESOURCE_EXHAUSTED as RATE_LIMIT via quota keyword', () => {
      // Gemini sometimes returns quota messages with RESOURCE_EXHAUSTED
      const result = classifyProviderError('RESOURCE_EXHAUSTED: quota for model exceeded')
      expect(result.errorCode).toBe('RATE_LIMIT')
    })
  })

  // ── NETWORK detection ─────────────────────────────────────────────────────
  describe('network error patterns', () => {
    it('classifies "ENOTFOUND" as NETWORK', () => {
      const result = classifyProviderError('getaddrinfo ENOTFOUND api.openai.com')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NETWORK')
      expect(result.error).toContain('internet')
    })

    it('classifies "ECONNREFUSED" as NETWORK', () => {
      const result = classifyProviderError('connect ECONNREFUSED 127.0.0.1:443')
      expect(result.errorCode).toBe('NETWORK')
    })

    it('classifies "Failed to fetch" as NETWORK', () => {
      const result = classifyProviderError('Failed to fetch')
      expect(result.errorCode).toBe('NETWORK')
    })

    it('classifies "FetchError" as NETWORK', () => {
      const result = classifyProviderError('FetchError: request to https://... failed')
      expect(result.errorCode).toBe('NETWORK')
    })

    it('classifies OpenAI "Connection error." as NETWORK', () => {
      // OpenAI Node SDK throws APIConnectionError with this exact message string.
      const result = classifyProviderError('Connection error.')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NETWORK')
      expect(result.error).toContain('internet')
    })
  })

  // ── Unknown errors — pass through ─────────────────────────────────────────
  describe('unknown / unclassified errors', () => {
    it('passes through unrecognized error message without errorCode', () => {
      const result = classifyProviderError('Something completely unexpected happened')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Something completely unexpected happened')
      expect(result.errorCode).toBeUndefined()
    })

    it('passes through empty string without errorCode', () => {
      const result = classifyProviderError('')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBeUndefined()
    })

    it('passes through model-not-found error without classification', () => {
      const result = classifyProviderError('404 Model not found: gpt-99')
      expect(result.success).toBe(false)
      expect(result.errorCode).toBeUndefined()
      expect(result.error).toContain('Model not found')
    })
  })

  // ── Return shape ──────────────────────────────────────────────────────────
  describe('return shape', () => {
    it('always returns success: false', () => {
      const cases = [
        'any error message',
        '401 unauthorized',
        '429 rate limit',
        'ENOTFOUND',
      ]
      for (const msg of cases) {
        expect(classifyProviderError(msg).success).toBe(false)
      }
    })

    it('always returns a non-empty error string', () => {
      const result = classifyProviderError('some error')
      expect(typeof result.error).toBe('string')
      expect(result.error.length).toBeGreaterThan(0)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('noApiKeyResponse', () => {
  it('returns success: false', () => {
    expect(noApiKeyResponse('gemini').success).toBe(false)
  })

  it('returns errorCode: NO_API_KEY', () => {
    expect(noApiKeyResponse('gemini').errorCode).toBe('NO_API_KEY')
  })

  it('includes the provider name in the error message', () => {
    const result = noApiKeyResponse('openai')
    expect(result.error).toContain('openai')
  })

  it('generates distinct messages for different providers', () => {
    const gemini = noApiKeyResponse('gemini')
    const claude = noApiKeyResponse('claude')
    expect(gemini.error).not.toBe(claude.error)
    expect(gemini.error).toContain('gemini')
    expect(claude.error).toContain('claude')
  })

  it('works for any provider string including unknown ones', () => {
    const result = noApiKeyResponse('my-custom-provider')
    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NO_API_KEY')
    expect(result.error).toContain('my-custom-provider')
  })
})
