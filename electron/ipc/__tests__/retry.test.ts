// @vitest-environment node
/**
 * Unit tests for electron/ipc/retry.ts
 *
 * Tests cover:
 *   1. isRetriableError() — classifies errors as retriable or non-retriable
 *   2. withRetry()        — retry count, backoff, success on retry, non-retriable passthrough
 */
import { describe, it, expect, vi } from 'vitest'
import { isRetriableError, withRetry } from '../retry'

// ─────────────────────────────────────────────────────────────────────────────
describe('isRetriableError', () => {
  // ── Retriable (network) errors ─────────────────────────────────────────────
  it('returns true for ENOTFOUND (DNS failure)', () => {
    expect(isRetriableError(new Error('getaddrinfo ENOTFOUND api.openai.com'))).toBe(true)
  })

  it('returns true for ECONNREFUSED', () => {
    expect(isRetriableError(new Error('connect ECONNREFUSED 127.0.0.1:443'))).toBe(true)
  })

  it('returns true for ETIMEDOUT', () => {
    expect(isRetriableError(new Error('connection ETIMEDOUT'))).toBe(true)
  })

  it('returns true for ECONNRESET', () => {
    expect(isRetriableError(new Error('read ECONNRESET'))).toBe(true)
  })

  it('returns true for "Failed to fetch"', () => {
    expect(isRetriableError(new Error('Failed to fetch'))).toBe(true)
  })

  it('returns true for "FetchError"', () => {
    expect(isRetriableError(new Error('FetchError: request failed'))).toBe(true)
  })

  it('returns true for "socket hang up"', () => {
    expect(isRetriableError(new Error('socket hang up'))).toBe(true)
  })

  it('returns true for "timeout" in message', () => {
    expect(isRetriableError(new Error('request timeout after 30s'))).toBe(true)
  })

  it('returns true for "connection reset"', () => {
    expect(isRetriableError(new Error('connection reset by peer'))).toBe(true)
  })

  it('returns true for OpenAI APIConnectionError "Connection error."', () => {
    // OpenAI Node SDK throws APIConnectionError with this exact message on
    // DNS failures, TCP resets, or proxy issues.
    expect(isRetriableError(new Error('Connection error.'))).toBe(true)
  })

  it('returns true for lowercase "connection error"', () => {
    expect(isRetriableError(new Error('connection error occurred'))).toBe(true)
  })

  // ── Non-retriable (hard) errors ───────────────────────────────────────────
  it('returns false for 401 Unauthorized (invalid API key)', () => {
    expect(isRetriableError(new Error('401 Unauthorized'))).toBe(false)
  })

  it('returns false for invalid_api_key', () => {
    expect(isRetriableError(new Error('Error: invalid_api_key'))).toBe(false)
  })

  it('returns false for authentication error', () => {
    expect(isRetriableError(new Error('authentication failed'))).toBe(false)
  })

  it('returns false for 429 rate limit', () => {
    expect(isRetriableError(new Error('429 rate_limit exceeded'))).toBe(false)
  })

  it('returns false for quota exceeded', () => {
    expect(isRetriableError(new Error('quota exceeded for gemini-2.0-flash'))).toBe(false)
  })

  it('returns false for RESOURCE_EXHAUSTED (Gemini quota)', () => {
    expect(isRetriableError(new Error('RESOURCE_EXHAUSTED: quota for model'))).toBe(false)
  })

  it('returns false for 403 Forbidden', () => {
    expect(isRetriableError(new Error('403 Forbidden'))).toBe(false)
  })

  it('returns false for "unknown provider"', () => {
    expect(isRetriableError(new Error('Unknown provider: "mymodel"'))).toBe(false)
  })

  it('returns false for "not found"', () => {
    expect(isRetriableError(new Error('404 Model not found: xyz'))).toBe(false)
  })

  it('returns false for unrelated generic error', () => {
    expect(isRetriableError(new Error('Unexpected response type from Claude'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('withRetry', () => {
  // ── Success path ──────────────────────────────────────────────────────────
  it('returns the value immediately when fn succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValueOnce('success')
    const result = await withRetry(fn, { maxAttempts: 3 })
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  // ── Retry path ────────────────────────────────────────────────────────────
  it('retries on retriable error and succeeds on the second attempt', async () => {
    const networkError = new Error('ENOTFOUND api.openai.com')
    const fn = vi.fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce('ok on retry')

    const result = await withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 1, // fast test
    })

    expect(result).toBe('ok on retry')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries up to maxAttempts and then throws the last error', async () => {
    const networkError = new Error('ENOTFOUND')
    const fn = vi.fn().mockRejectedValue(networkError)

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })
    ).rejects.toThrow('ENOTFOUND')

    expect(fn).toHaveBeenCalledTimes(3)
  })

  // ── Non-retriable path ────────────────────────────────────────────────────
  it('does NOT retry for non-retriable errors (401) — throws immediately', async () => {
    const authError = new Error('401 Unauthorized invalid_api_key')
    const fn = vi.fn().mockRejectedValue(authError)

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })
    ).rejects.toThrow('401 Unauthorized')

    // Only called once — no retry for auth error
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry for rate limit errors (429)', async () => {
    const rateLimitError = new Error('429 rate_limit exceeded')
    const fn = vi.fn().mockRejectedValue(rateLimitError)

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelayMs: 1 })
    ).rejects.toThrow('429 rate_limit')

    expect(fn).toHaveBeenCalledTimes(1)
  })

  // ── Custom shouldRetry ────────────────────────────────────────────────────
  it('uses custom shouldRetry predicate', async () => {
    const error = new Error('custom-retriable-error')
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success')

    const result = await withRetry(fn, {
      maxAttempts: 3,
      initialDelayMs: 1,
      shouldRetry: (err) => err.message.includes('custom-retriable'),
    })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry when custom shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('never retry this'))

    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        initialDelayMs: 1,
        shouldRetry: () => false,
      })
    ).rejects.toThrow('never retry this')

    expect(fn).toHaveBeenCalledTimes(1)
  })

  // ── maxAttempts = 1 ───────────────────────────────────────────────────────
  it('maxAttempts=1 means no retries at all', async () => {
    const networkError = new Error('ENOTFOUND')
    const fn = vi.fn().mockRejectedValue(networkError)

    await expect(
      withRetry(fn, { maxAttempts: 1, initialDelayMs: 1 })
    ).rejects.toThrow('ENOTFOUND')

    expect(fn).toHaveBeenCalledTimes(1)
  })

  // ── Edge cases ────────────────────────────────────────────────────────────
  it('handles non-Error rejections by wrapping in Error', async () => {
    const fn = vi.fn().mockRejectedValue('string rejection')

    await expect(
      withRetry(fn, { maxAttempts: 1 })
    ).rejects.toThrow('string rejection')
  })
})
