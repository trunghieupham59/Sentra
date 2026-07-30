import { MAX_OUTPUT_TOKENS_CLAUDE, VERIFY_MAX_TOKENS, VERIFY_MODEL_CLAUDE } from './ipcConstants'
import { buildPrompt, buildRewritePrompt, REWRITE_SYSTEM_PROMPT, SYSTEM_PROMPT } from './translatePrompts'
import type { DetectFn, RewriteFn, StreamFn, TranslateFn, TranslateRequestOptions, VerifyFn } from './translateProviderTypes'
import { getClaudeReasoningConfig } from './translationReasoning'

export const translateWithClaude: TranslateFn = async (
  apiKey,
  model,
  sourceText,
  sourceLang,
  targetLang,
  showFurigana,
  style,
  phoneticOnly,
  phoneticMode,
  reasoningEffort,
  options: TranslateRequestOptions = {},
) => {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create(
    {
      model,
      max_tokens: MAX_OUTPUT_TOKENS_CLAUDE,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly, phoneticMode) }],
      ...getClaudeReasoningConfig(model, reasoningEffort),
    },
    options.signal ? { signal: options.signal } : undefined,
  )
  const block = message.content.find((content) => content.type === 'text')
  if (block?.type === 'text') return block.text.trim()
  throw new Error('Unexpected response type from Claude')
}

export const rewriteWithClaude: RewriteFn = async (apiKey, model, text, lang, style) => {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS_CLAUDE,
    system: REWRITE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildRewritePrompt(text, lang, style) }],
  })
  const block = message.content[0]
  if (block.type === 'text') return block.text.trim()
  throw new Error('Unexpected response type from Claude')
}

export const detectWithClaude: DetectFn = async (apiKey, model, prompt) => {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: 10,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = message.content[0]
  if (block.type === 'text') return block.text.trim()
  throw new Error('Unexpected response type from Claude')
}

export const verifyClaudeKey: VerifyFn = async (apiKey) => {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: VERIFY_MODEL_CLAUDE,
    max_tokens: VERIFY_MAX_TOKENS,
    messages: [{ role: 'user', content: 'Say "ok".' }],
  })
  if (!message.content[0]) throw new Error('No response from Claude')
}

export const streamWithClaude: StreamFn = async (apiKey, model, prompt, onToken) => {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  let fullText = ''
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_OUTPUT_TOKENS_CLAUDE,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const token = event.delta.text
      if (token) {
        fullText += token
        onToken(token)
      }
    }
  }
  return fullText
}
