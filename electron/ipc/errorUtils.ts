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
  if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('authentication')) {
    return { success: false, error: 'Invalid API key. Please check your key in Settings.', errorCode: 'INVALID_KEY' }
  }
  if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota')) {
    return { success: false, error: 'Rate limit exceeded. Please wait and try again.', errorCode: 'RATE_LIMIT' }
  }
  if (
    msg.includes('ENOTFOUND') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Failed to fetch') ||
    msg.includes('FetchError') ||
    msg.includes('Connection error')
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
