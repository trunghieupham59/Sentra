/**
 * withRetry — exponential-backoff retry wrapper for IPC handlers.
 *
 * Designed for AI provider API calls that may fail transiently due to network
 * issues (DNS, connection reset, timeout). Retries are limited to clearly
 * transient errors — hard failures (auth, rate limit, invalid model) are
 * rethrown immediately without retrying.
 *
 * Usage:
 * ```ts
 * const result = await withRetry(() => translateWithGemini(apiKey, model, ...))
 * ```
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum total attempts including the first try (default: 3) */
  maxAttempts?: number
  /** Delay before the first retry in ms; doubles each subsequent retry (default: 500) */
  initialDelayMs?: number
  /** Maximum delay cap in ms — prevents unbounded waits (default: 8000) */
  maxDelayMs?: number
  /**
   * Predicate — return true if the error is retriable.
   * Default: retries only on transient network errors.
   * Override to customize: e.g. retry on specific status codes or messages.
   */
  shouldRetry?: (error: Error) => boolean
}

// ── Default shouldRetry: network errors only ──────────────────────────────────

/**
 * Returns true for transient network errors that are safe to retry.
 * Returns false for auth errors (401), rate limits (429), or invalid requests —
 * retrying those won't help and would waste quota.
 */
export function isRetriableError(err: Error): boolean {
  const msg = err.message.toLowerCase()
  // Hard failures — do NOT retry
  if (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('invalid_api_key') ||
    msg.includes('authentication') ||
    msg.includes('429') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('unknown provider') ||
    msg.includes('not found')
  ) {
    return false
  }
  // Transient network errors — retry
  return (
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetcherror') ||
    msg.includes('fetch failed') ||
    msg.includes('network socket disconnected') ||
    msg.includes('socket hang up') ||
    msg.includes('connection reset') ||
    msg.includes('timeout')
  )
}

// ── Main retry function ───────────────────────────────────────────────────────

/**
 * Execute `fn` with up to `maxAttempts` attempts, using exponential backoff.
 *
 * Backoff formula: `Math.min(initialDelayMs * 2^(attempt-1), maxDelayMs)`
 *   Attempt 1 fails → wait 500ms
 *   Attempt 2 fails → wait 1000ms
 *   Attempt 3 fails → throw (no more retries)
 *
 * @param fn - Async function to execute and potentially retry.
 * @param opts - Retry configuration (all fields optional).
 * @returns The resolved value of `fn` on any successful attempt.
 * @throws The last error if all attempts fail or the error is non-retriable.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 500,
    maxDelayMs = 8_000,
    shouldRetry = isRetriableError,
  } = opts

  let lastError: Error = new Error('Unknown error')

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Non-retriable error or last attempt → throw immediately
      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError
      }

      const delay = Math.min(initialDelayMs * (2 ** (attempt - 1)), maxDelayMs)
      console.warn(
        `[retry] Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. ` +
        `Retrying in ${delay}ms...`
      )
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
