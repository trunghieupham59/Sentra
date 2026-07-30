import { VERIFY_MODEL_GEMINI } from './ipcConstants'
import { buildPrompt, buildRewritePrompt, REWRITE_SYSTEM_PROMPT, SYSTEM_PROMPT } from './translatePrompts'
import type { DetectFn, RewriteFn, StreamFn, TranslateFn, TranslateRequestOptions, VerifyFn } from './translateProviderTypes'
import { getGeminiThinkingConfig } from './translationReasoning'

const TRANSLATE_CANCELLED_MESSAGE = 'translate-cancelled'

export const translateWithGemini: TranslateFn = async (
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
  if (options.signal?.aborted) throw new Error(TRANSLATE_CANCELLED_MESSAGE)
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const thinkingConfig = getGeminiThinkingConfig(model, reasoningEffort)
  const generationConfig = thinkingConfig === undefined
    ? undefined
    : { thinkingConfig }
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_PROMPT,
    // The legacy SDK forwards generationConfig verbatim but predates this API field in its types.
    generationConfig: generationConfig as never,
  })
  const result = await genModel.generateContent(buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style, phoneticOnly, phoneticMode))
  if (options.signal?.aborted) throw new Error(TRANSLATE_CANCELLED_MESSAGE)
  return result.response.text().trim()
}

export const rewriteWithGemini: RewriteFn = async (apiKey, model, text, lang, style) => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model, systemInstruction: REWRITE_SYSTEM_PROMPT })
  const result = await genModel.generateContent(buildRewritePrompt(text, lang, style))
  return result.response.text().trim()
}

export const detectWithGemini: DetectFn = async (apiKey, model, prompt) => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model })
  const result = await genModel.generateContent(prompt)
  return result.response.text().trim()
}

export const verifyGeminiKey: VerifyFn = async (apiKey) => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: VERIFY_MODEL_GEMINI })
  const result = await model.generateContent('Say "ok" in one word.')
  const text = result.response.text()
  if (!text) throw new Error('No response from Gemini')
}

export const streamWithGemini: StreamFn = async (apiKey, model, prompt, onToken) => {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model, systemInstruction: SYSTEM_PROMPT })
  let fullText = ''
  const result = await genModel.generateContentStream(prompt)
  for await (const chunk of result.stream) {
    const token = chunk.text()
    if (token) {
      fullText += token
      onToken(token)
    }
  }
  return fullText
}
