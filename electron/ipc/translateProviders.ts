import { buildPrompt } from './translatePrompts'
import { detectWithClaude, rewriteWithClaude, streamWithClaude, translateWithClaude, verifyClaudeKey } from './translateProviderClaude'
import { detectWithGemini, rewriteWithGemini, streamWithGemini, translateWithGemini, verifyGeminiKey } from './translateProviderGemini'
import { detectWithLocal, rewriteWithLocal, streamWithLocal, translateWithLocal, verifyLocalRuntime } from './translateProviderLocal'
import { detectWithOpenAI, rewriteWithOpenAI, streamWithOpenAI, translateWithOpenAI, verifyOpenAIKey } from './translateProviderOpenAI'
import type { DetectFn, RewriteFn, StreamFn, TranslateFn, VerifyFn } from './translateProviderTypes'
import type { TranslationStyle } from './translateValidation'

export const TRANSLATE_PROVIDERS: Record<string, TranslateFn> = {
  gemini: translateWithGemini,
  claude: translateWithClaude,
  openai: translateWithOpenAI,
  local: translateWithLocal,
}

export const REWRITE_PROVIDERS: Record<string, RewriteFn> = {
  gemini: rewriteWithGemini,
  claude: rewriteWithClaude,
  openai: rewriteWithOpenAI,
  local: rewriteWithLocal,
}

export const DETECT_PROVIDERS: Record<string, DetectFn> = {
  gemini: detectWithGemini,
  claude: detectWithClaude,
  openai: detectWithOpenAI,
  local: detectWithLocal,
}

export const VERIFY_PROVIDERS: Record<string, VerifyFn> = {
  gemini: verifyGeminiKey,
  claude: verifyClaudeKey,
  openai: verifyOpenAIKey,
  local: verifyLocalRuntime,
}

const STREAM_PROVIDERS: Record<string, StreamFn> = {
  openai: streamWithOpenAI,
  gemini: streamWithGemini,
  claude: streamWithClaude,
  local: streamWithLocal,
}

export async function streamTranslation(
  provider: string,
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  style: TranslationStyle = 'general',
  onToken: (token: string) => void,
): Promise<string> {
  const prompt = buildPrompt(sourceText, sourceLang, targetLang, false, style, false)

  const streamFn = STREAM_PROVIDERS[provider]
  if (!streamFn) {
    const fullText = await translateWithOpenAI(apiKey, model, sourceText, sourceLang, targetLang, false, style, false, 'off')
    onToken(fullText)
    return fullText
  }

  return streamFn(apiKey, model, prompt, onToken)
}
