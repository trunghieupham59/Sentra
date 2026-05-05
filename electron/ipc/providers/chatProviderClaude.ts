/**
 * Claude (Anthropic) chat provider — non-streaming + streaming implementations.
 *
 * Uses the official `@anthropic-ai/sdk` lazily imported at runtime.
 *
 * Multimodal: text + base64 images mapped into Anthropic content blocks.
 *
 * Cancellation: the Anthropic SDK accepts a `signal` request-option that wires
 * through to fetch, closing the SSE connection cleanly. We additionally call
 * `stream.controller?.abort()` from the abort listener as a defensive belt-and-
 * braces and poll between events.
 */
import type { ImageBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { ClaudeImageMimeType } from '../chatConfig'
import { CHAT_RUNTIME_MESSAGES } from '../chatMessages'
import { buildEnforcedSystemPrompt } from '../chatPrompts'
import type { ChatMessage } from '../chatValidation'
import { MAX_CHAT_OUTPUT_TOKENS } from '../ipcConstants'
import {
  CHAT_STREAM_CANCELLED_MESSAGE,
  type ChatProviderOptions,
  type ChatStreamTokenHandler,
} from './chatProviderTypes'


/** Map IPC chat messages → Anthropic SDK message blocks (text + image). */
function formatClaudeMessages(messages: ChatMessage[]) {
  return messages.map((msg) => {
    const content: Array<TextBlockParam | ImageBlockParam> = []
    for (const c of msg.content) {
      if (c.type === 'text' && c.text) {
        content.push({ type: 'text', text: c.text })
      } else if (c.type === 'image' && c.imageBase64 && c.imageMimeType) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: c.imageMimeType as ClaudeImageMimeType,
            data: c.imageBase64,
          },
        })
      }
    }
    return { role: msg.role, content }
  })
}

/** Non-streaming Claude chat — returns the trimmed reply text. */
export async function chatWithClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  maxOutputTokens = MAX_CHAT_OUTPUT_TOKENS,
  options: ChatProviderOptions = {},
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const formattedMessages = formatClaudeMessages(messages)

  const message = await client.messages.create({
    model,
    max_tokens: maxOutputTokens,  // HC-02
    system: buildEnforcedSystemPrompt(systemPrompt || '', {
      carefulReasoning: options.carefulReasoning,
    }),
    messages: formattedMessages,
  })


  const block = message.content[0]
  if (block.type === 'text') {
    const text = block.text.trim()
    if (!text) {
      throw new Error(CHAT_RUNTIME_MESSAGES.claudeEmptyResponse(message.stop_reason ?? 'unknown'))
    }
    return text
  }
  throw new Error(CHAT_RUNTIME_MESSAGES.claudeUnexpectedResponseType)
}

/** Streaming Claude chat — emits tokens through `onToken`. */
export async function streamChatWithClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string | undefined,
  maxOutputTokens: number,
  onToken: ChatStreamTokenHandler,
  signal?: AbortSignal,
  options: ChatProviderOptions = {},
): Promise<string> {
  if (signal?.aborted) throw new Error(CHAT_STREAM_CANCELLED_MESSAGE)
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  let fullText = ''
  const stream = client.messages.stream(
    {
      model,
      max_tokens: maxOutputTokens,
      system: buildEnforcedSystemPrompt(systemPrompt || '', {
        carefulReasoning: options.carefulReasoning,
      }),
      messages: formatClaudeMessages(messages),
    },

    // Anthropic SDK accepts a request-options object whose `signal` field
    // wires through to the underlying fetch — aborting here closes the SSE
    // connection cleanly.
    signal ? { signal } : undefined,
  )

  // Defensive: also poll the signal between events in case the SDK does not
  // surface the abort fast enough.
  const onAbort = () => {
    try {
      stream.controller?.abort?.()
    } catch {
      /* ignore — we still throw below */
    }
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    for await (const event of stream) {
      if (signal?.aborted) throw new Error(CHAT_STREAM_CANCELLED_MESSAGE)
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const token = event.delta.text
        if (token) {
          fullText += token
          onToken(token)
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }

  const text = fullText.trim()
  if (!text) throw new Error(CHAT_RUNTIME_MESSAGES.claudeStreamEmptyResponse)
  return text
}
