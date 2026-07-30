import { MAX_OUTPUT_TOKENS_OPENAI, VERIFY_MAX_TOKENS, VERIFY_MODEL_OPENAI } from './ipcConstants'
import { buildPrompt, buildRewritePrompt, REWRITE_SYSTEM_PROMPT, SYSTEM_PROMPT } from './translatePrompts'
import type { DetectFn, RewriteFn, StreamFn, TranslateFn, TranslateRequestOptions, VerifyFn } from './translateProviderTypes'
import { getOpenAIReasoningEffort } from './translationReasoning'

export const translateWithOpenAI: TranslateFn = async (
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
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create(
    {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly, phoneticMode) },
      ],
      max_completion_tokens: MAX_OUTPUT_TOKENS_OPENAI,
      reasoning_effort: getOpenAIReasoningEffort(model, reasoningEffort),
    },
    options.signal ? { signal: options.signal } : undefined,
  )
  return (completion.choices[0]?.message?.content ?? '').trim()
}

export const rewriteWithOpenAI: RewriteFn = async (apiKey, model, text, lang, style) => {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: buildRewritePrompt(text, lang, style) },
    ],
    max_completion_tokens: MAX_OUTPUT_TOKENS_OPENAI,
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

export const detectWithOpenAI: DetectFn = async (apiKey, model, prompt) => {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 10,
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

export const verifyOpenAIKey: VerifyFn = async (apiKey) => {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model: VERIFY_MODEL_OPENAI,
    messages: [{ role: 'user', content: 'Say "ok".' }],
    max_completion_tokens: VERIFY_MAX_TOKENS,
  })
  if (!completion.choices[0]) throw new Error('No response from OpenAI')
}

export const streamWithOpenAI: StreamFn = async (apiKey, model, prompt, onToken) => {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  let fullText = ''
  const stream = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    stream: true,
    max_completion_tokens: MAX_OUTPUT_TOKENS_OPENAI,
  })
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) {
      fullText += token
      onToken(token)
    }
  }
  return fullText
}
