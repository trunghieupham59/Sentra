/**
 * Shared error classification utilities for IPC handlers.
 *
 * Centralizes provider error detection and response formatting,
 * replacing the near-duplicate error handling blocks (DUP-01, DUP-03)
 * that were previously scattered across translate.ts, chat.ts, and imageTranslate.ts.
 */

export interface IpcErrorResponse {
  success: false
  error: string
  errorCode?: string
}

/**
 * Classify a raw error message from an AI provider into a structured IPC error response.
 * Handles the three most common failure modes: invalid API key, rate limit, and no network.
 *
 * Usage:
 *   } catch (error: unknown) {
 *     const msg = error instanceof Error ? error.message : String(error)
 *     return classifyProviderError(msg)
 *   }
 */
export function classifyProviderError(msg: string): IpcErrorResponse {
  const lower = msg.toLowerCase()

  if (lower.includes('401') || lower.includes('invalid_api_key') || lower.includes('authentication')) {
    return { success: false, error: 'Invalid API key. Please check your key in Settings.', errorCode: 'INVALID_KEY' }
  }
  if (lower.includes('429') || lower.includes('rate_limit') || lower.includes('quota')) {
    return { success: false, error: 'Rate limit exceeded. Please wait and try again.', errorCode: 'RATE_LIMIT' }
  }
  if (
    lower.includes('aborterror') ||
    lower.includes('operation was aborted') ||
    lower.includes('request timed out') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  ) {
    return { success: false, error: 'The request timed out. Please try again.', errorCode: 'TIMEOUT' }
  }
  if (
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('failed to fetch') ||
    lower.includes('fetcherror') ||
    lower.includes('connection error')
  ) {
    return { success: false, error: 'No internet connection.', errorCode: 'NETWORK' }
  }
  return { success: false, error: msg }
}

/**
 * Standard "no API key stored" response for the given provider.
 *
 * Usage:
 *   const apiKey = getStoredApiKey(provider)
 *   if (!apiKey) return noApiKeyResponse(provider)
 */
export function noApiKeyResponse(provider: string): IpcErrorResponse {
  return {
    success: false,
    error: `No API key found for ${provider}. Please add it in Settings.`,
    errorCode: 'NO_API_KEY',
  }
}
