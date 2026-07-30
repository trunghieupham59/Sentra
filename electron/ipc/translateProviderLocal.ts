import { MAX_OUTPUT_TOKENS_OPENAI } from './ipcConstants'
import { LOCAL_AI_PLACEHOLDER_KEY, resolveLocalAiRequestModel } from './localAi'
import { buildPrompt, buildRewritePrompt, REWRITE_SYSTEM_PROMPT, SYSTEM_PROMPT } from './translatePrompts'
import type { DetectFn, RewriteFn, StreamFn, TranslateFn, TranslateRequestOptions, VerifyFn } from './translateProviderTypes'

async function getLocalOpenAIClient(model: string) {
  const OpenAI = (await import('openai')).default
  const local = await resolveLocalAiRequestModel(model)
  return {
    client: new OpenAI({ apiKey: LOCAL_AI_PLACEHOLDER_KEY, baseURL: local.baseURL }),
    model: local.model,
  }
}

export const translateWithLocal: TranslateFn = async (
  _apiKey,
  model,
  sourceText,
  sourceLang,
  targetLang,
  showFurigana,
  style,
  phoneticOnly,
  phoneticMode,
  _reasoningEffort,
  options: TranslateRequestOptions = {},
) => {
  const { client, model: resolvedModel } = await getLocalOpenAIClient(model)
  const completion = await client.chat.completions.create(
    {
      model: resolvedModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly, phoneticMode) },
      ],
      max_tokens: MAX_OUTPUT_TOKENS_OPENAI,
    },
    options.signal ? { signal: options.signal } : undefined,
  )
  return (completion.choices[0]?.message?.content ?? '').trim()
}

export const rewriteWithLocal: RewriteFn = async (_apiKey, model, text, lang, style) => {
  const { client, model: resolvedModel } = await getLocalOpenAIClient(model)
  const completion = await client.chat.completions.create({
    model: resolvedModel,
    messages: [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: buildRewritePrompt(text, lang, style) },
    ],
    max_tokens: MAX_OUTPUT_TOKENS_OPENAI,
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

export const detectWithLocal: DetectFn = async (_apiKey, model, prompt) => {
  const { client, model: resolvedModel } = await getLocalOpenAIClient(model)
  const completion = await client.chat.completions.create({
    model: resolvedModel,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 10,
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

export const verifyLocalRuntime: VerifyFn = async () => {
  await resolveLocalAiRequestModel('local-auto')
}

export const streamWithLocal: StreamFn = async (_apiKey, model, prompt, onToken) => {
  const { client, model: resolvedModel } = await getLocalOpenAIClient(model)
  let fullText = ''
  const stream = await client.chat.completions.create({
    model: resolvedModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    stream: true,
    max_tokens: MAX_OUTPUT_TOKENS_OPENAI,
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
