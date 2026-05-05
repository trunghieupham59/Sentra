/**
 * Chat IPC entry point.
 *
 * Hosts the four IPC channels the renderer talks to, but delegates all
 * provider-specific work to focused sibling modules:
 *
 *   - providers/chatProvider{Gemini,Claude,OpenAI,Local}.ts — per-provider
 *     non-streaming + streaming implementations.
 *   - providers/chatProviderRegistry.ts — provider lookup tables.
 *   - chatTokenResolver.ts — max-output-token resolution (incl. Gemini meta).
 *   - chatImageEdit.ts — image edit validation + provider implementations.
 *   - chatValidation.ts — Zod-style payload parsing for `chat:send` /
 *     `chat:stream`.
 *
 * Channels registered:
 *   - `chat:send`         → non-streaming chat
 *   - `chat:stream`       → streaming chat (token events on `chat:stream:event`)
 *   - `chat:stream:cancel`→ abort an in-flight stream
 *   - `chat:image-edit`   → edit an attached image
 *
 * Cross-cutting concerns:
 *   - API keys are read from the OS Keychain via `getStoredApiKey` — never
 *     forwarded from the renderer.
 *   - Errors are categorised by `classifyProviderError` into typed
 *     `errorCode` values (`NO_API_KEY`, `INVALID_KEY`, `RATE_LIMIT`, `NETWORK`,
 *     `TIMEOUT`, …) so the renderer can present localised messages.
 *   - Transient network errors are retried via `withRetry` (exponential
 *     backoff). User cancellation is never retried.
 */
import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { CHAT_IPC_CHANNELS } from './chatConfig'
import { CHAT_IMAGE_EDIT_PROVIDERS, parseChatImageEditParams } from './chatImageEdit'
import { CHAT_LOG_MESSAGES, CHAT_RUNTIME_MESSAGES } from './chatMessages'
import { resolveChatOutputTokens } from './chatTokenResolver'
import { parseChatParams } from './chatValidation'
import { classifyProviderError, noApiKeyResponse } from './errorUtils'
import { isNonEmptyString, isRecord } from './ipcValidation'
import { isLocalProvider, LOCAL_AI_PLACEHOLDER_KEY } from './localAi'
import {
  CHAT_STREAM_CANCELLED_MESSAGE,
  isAbortError,
} from './providers/chatProviderTypes'
import {
  CHAT_PROVIDERS,
  CHAT_STREAM_PROVIDERS,
} from './providers/chatProviderRegistry'
import { unknownProviderError } from './providers/types'
import { withRetry } from './retry'
import { getStoredApiKey } from './storage'

// ── Re-exports for tests & legacy import sites ───────────────────────────────
//
// These re-exports keep `import { … } from './chat'` working for unit tests
// and any other consumers that historically reached into chat.ts directly.
// Production code should import from the dedicated modules.

export { buildEnforcedSystemPrompt } from './chatPrompts'
export {
  getCurrentFamilyModelMaxOutputTokens,
  resolveModelMaxOutputTokens,
} from './chatTokenResolver'
export {
  isLikelyChatModel,
  scoreOpenAIChatModel,
} from './providers/chatProviderOpenAI'

// ── Stream cancellation registry ─────────────────────────────────────────────
//
// Module-scoped map of in-flight stream `requestId` → AbortController. The
// renderer cancels via `chat:stream:cancel` (which calls `controller.abort()`),
// and the stream handler converts the resulting rejection into a typed
// `CANCELLED` event the renderer can suppress.
const activeStreamControllers = new Map<string, AbortController>()

// ── Stream event typing ──────────────────────────────────────────────────────

type ChatStreamEventPayload =
  | { type: 'start' }
  | { type: 'token'; token: string }
  | { type: 'end'; reply: string }
  | { type: 'error'; error: string; errorCode?: string }

type ChatStreamEvent = { requestId: string } & ChatStreamEventPayload

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Local providers do not require a key, so we substitute a placeholder string
 * to satisfy SDK constructors. For cloud providers we fetch from Keychain.
 */
function getProviderCredential(provider: string): string | null {
  return isLocalProvider(provider) ? LOCAL_AI_PLACEHOLDER_KEY : getStoredApiKey(provider)
}

/**
 * Convert any provider error into the IPC error response shape, attaching a
 * typed `errorCode` when one can be inferred from the message (auth, rate
 * limit, network, timeout, …).
 */
function toChatFailure(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error)
  const classified = classifyProviderError(msg)
  return { ...classified, error: classified.errorCode ? classified.error : CHAT_RUNTIME_MESSAGES.chatFailed(msg) }
}

function sendChatStreamEvent(event: IpcMainInvokeEvent, payload: ChatStreamEvent) {
  event.sender.send(CHAT_IPC_CHANNELS.streamEvent, payload)
}

// ── IPC registration ─────────────────────────────────────────────────────────

/**
 * Register every chat-related IPC handler with Electron's main process.
 *
 * The function is idempotent for a given `ipcMain` instance — main.ts calls it
 * exactly once at startup.
 */
export function registerChatHandlers(ipcMain: IpcMain) {
  registerChatSendHandler(ipcMain)
  registerChatImageEditHandler(ipcMain)
  registerChatStreamHandler(ipcMain)
  registerChatStreamCancelHandler(ipcMain)
}

// ── chat:send ────────────────────────────────────────────────────────────────

function registerChatSendHandler(ipcMain: IpcMain) {
  ipcMain.handle(CHAT_IPC_CHANNELS.send, async (_event, rawParams: unknown) => {
    const parsed = parseChatParams(rawParams)
    if (!parsed.ok) return parsed.response
    const {
      provider, model, messages, systemPrompt, maxOutputTokens: requested, carefulReasoning,
    } = parsed.value

    const apiKey = getProviderCredential(provider)
    if (!apiKey) return noApiKeyResponse(provider)
    const maxOutputTokens = await resolveChatOutputTokens(provider, model, apiKey, requested)

    try {
      // Registry lookup — `unknownProviderError` returns a typed response with
      // a hint listing supported providers.
      const chatFn = CHAT_PROVIDERS[provider]
      if (!chatFn) return unknownProviderError(provider)

      // withRetry adds exponential backoff for transient network errors.
      // Hard failures (auth, rate limit) are surfaced immediately.
      const reply = await withRetry(() => chatFn(
        apiKey, model, messages, systemPrompt, maxOutputTokens, { carefulReasoning },
      ))
      return { success: true, reply }
    } catch (error: unknown) {
      console.error(CHAT_LOG_MESSAGES.providerError(provider), error)
      return toChatFailure(error)
    }
  })
}


// ── chat:image-edit ──────────────────────────────────────────────────────────

function registerChatImageEditHandler(ipcMain: IpcMain) {
  ipcMain.handle(CHAT_IPC_CHANNELS.imageEdit, async (_event, rawParams: unknown) => {
    const parsed = parseChatImageEditParams(rawParams)
    if (!parsed.ok) return parsed.response
    const { provider, model, prompt, imageBase64, imageMimeType } = parsed.value

    const editFn = CHAT_IMAGE_EDIT_PROVIDERS[provider]
    if (!editFn) {
      return {
        success: false,
        error: CHAT_RUNTIME_MESSAGES.imageEditUnsupportedProvider,
        errorCode: 'NO_IMAGE_EDIT',
      }
    }

    const apiKey = getProviderCredential(provider)
    if (!apiKey) return noApiKeyResponse(provider)

    try {
      const result = await withRetry(() => editFn(apiKey, model, prompt, imageBase64, imageMimeType))
      return {
        success: true,
        imageBase64: result.imageBase64,
        imageMimeType: result.imageMimeType,
        usedProvider: provider,
        usedModel: result.usedModel,
      }
    } catch (error: unknown) {
      console.error(CHAT_LOG_MESSAGES.imageEditProviderError(provider), error)
      return toChatFailure(error)
    }
  })
}

// ── chat:stream ──────────────────────────────────────────────────────────────

function registerChatStreamHandler(ipcMain: IpcMain) {
  ipcMain.handle(CHAT_IPC_CHANNELS.stream, async (event, rawParams: unknown) => {
    const parsed = parseChatParams(rawParams)
    if (!parsed.ok) return parsed.response
    const {
      provider, model, messages, systemPrompt, requestId,
      maxOutputTokens: requested, carefulReasoning,
    } = parsed.value

    if (!requestId) {
      return {
        success: false,
        error: CHAT_RUNTIME_MESSAGES.streamRequestIdRequired,
        errorCode: 'INVALID_INPUT',
      }
    }

    const emit = (payload: ChatStreamEventPayload) => {
      sendChatStreamEvent(event, { requestId, ...payload })
    }

    emit({ type: 'start' })

    const apiKey = getProviderCredential(provider)
    if (!apiKey) {
      const response = noApiKeyResponse(provider)
      emit({ type: 'error', error: response.error, errorCode: response.errorCode })
      return response
    }
    const maxOutputTokens = await resolveChatOutputTokens(provider, model, apiKey, requested)

    // Register an AbortController for this stream so the renderer can cancel
    // via `chat:stream:cancel`. We pass `controller.signal` into the provider
    // so token streaming halts as soon as the user clicks Stop. The entry is
    // removed in `finally` to keep the registry tidy.
    const controller = new AbortController()
    activeStreamControllers.set(requestId, controller)

    try {
      const chatFn = CHAT_STREAM_PROVIDERS[provider]
      if (!chatFn) {
        const response = unknownProviderError(provider)
        emit({ type: 'error', error: response.error })
        return response
      }

      const reply = await chatFn(
        apiKey, model, messages, systemPrompt, maxOutputTokens,
        (token) => { emit({ type: 'token', token }) },
        controller.signal,
        { carefulReasoning },
      )


      emit({ type: 'end', reply })
      return { success: true, reply }
    } catch (error: unknown) {
      // User-initiated cancellation: emit a typed `CANCELLED` error code so
      // the renderer can suppress the visible error bubble; partial tokens
      // already streamed remain visible.
      if (controller.signal.aborted || isAbortError(error)) {
        emit({ type: 'error', error: CHAT_STREAM_CANCELLED_MESSAGE, errorCode: 'CANCELLED' })
        return { success: false, error: CHAT_STREAM_CANCELLED_MESSAGE, errorCode: 'CANCELLED' }
      }
      console.error(CHAT_LOG_MESSAGES.streamProviderError(provider), error)
      const response = toChatFailure(error)
      emit({ type: 'error', error: response.error, errorCode: response.errorCode })
      return response
    } finally {
      // Idempotent: a late cancel may have already removed the entry.
      if (activeStreamControllers.get(requestId) === controller) {
        activeStreamControllers.delete(requestId)
      }
    }
  })
}

// ── chat:stream:cancel ───────────────────────────────────────────────────────

function registerChatStreamCancelHandler(ipcMain: IpcMain) {
  ipcMain.handle(CHAT_IPC_CHANNELS.streamCancel, async (_event, rawParams: unknown) => {
    if (!isRecord(rawParams) || !isNonEmptyString(rawParams.requestId)) {
      return { success: false, error: 'INVALID_INPUT' }
    }
    const requestId = rawParams.requestId
    const controller = activeStreamControllers.get(requestId)
    if (!controller) return { success: false, error: 'NOT_FOUND' }
    try {
      controller.abort()
    } catch {
      /* abort cannot throw in normal cases — swallow defensively */
    }
    activeStreamControllers.delete(requestId)
    return { success: true }
  })
}
