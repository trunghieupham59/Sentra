import {
  EXT_DEFAULT_CLAUDE_MODEL,
  EXT_DEFAULT_GEMINI_MODEL,
  EXT_DEFAULT_OPENAI_MODEL,
  LIGHTWEIGHT_TRANSLATOR_PROMPT,
  MAX_LIGHTWEIGHT_TRANSLATE_TOKENS,
} from './ipcConstants'
import { isLocalProvider, LOCAL_AI_PLACEHOLDER_KEY, resolveLocalAiRequestModel } from './localAi'
import { getStoredApiKey } from './storage'

type TranslationStyle = 'general' | 'formal' | 'casual' | 'business' | 'technical' | 'natural'

const STYLE_TONE: Record<TranslationStyle, string> = {
  general:   'clear, natural, well-balanced — suitable for general everyday use; neither overly formal nor overly casual; reads naturally to any native speaker',
  formal:    'formal, polished, and respectful — appropriate for official correspondence, letters, reports, or interactions with superiors and unfamiliar parties; uses proper honorifics where applicable; avoids contractions and casual expressions',
  casual:    'casual, relaxed, conversational — like chatting with a close friend; uses informal language, contractions, colloquialisms, and expressive wording; feels natural in everyday conversation, texting, or social media',
  business:  'formal business register — highly concise, precise, and objective; appropriate for corporate emails, executive communication, and business documents; avoids unnecessary words; maintains a professional and authoritative tone',
  technical: 'precise, technical, and domain-specific — uses accurate industry-standard terminology; sentences are clear, unambiguous, and logically structured; suitable for documentation, specs, or expert-to-expert communication; prioritizes exactness; avoids casual language, metaphors, and any imprecision',
  natural:   'authentic, idiomatic, and naturally fluent — as if a confident native speaker originally wrote it in the target language; uses natural collocations, real idioms, and native rhythm; eliminates any trace of translation or foreignness; prioritizes how a real native would genuinely express the idea',
}

export interface LightweightTranslateParams {
  text: string
  targetLang: string
  provider?: string
  model?: string
  translationStyle?: TranslationStyle
}

/**
 * Lightweight translation — dùng cho global hotkey và browser extension.
 * Hỗ trợ translationStyle để phù hợp với màn hình AI Dịch.
 */
export async function lightweightTranslate({
  text,
  targetLang,
  provider = 'gemini',
  model,
  translationStyle = 'general',
}: LightweightTranslateParams): Promise<{ success: boolean; translatedText?: string; error?: string }> {
  if (!text?.trim()) return { success: false, error: 'Text is empty' }

  const resolvedModel = model ?? (
    provider === 'gemini' ? EXT_DEFAULT_GEMINI_MODEL
    : provider === 'openai' ? EXT_DEFAULT_OPENAI_MODEL
    : provider === 'local' ? 'local-auto'
    : EXT_DEFAULT_CLAUDE_MODEL
  )

  const apiKey = isLocalProvider(provider) ? LOCAL_AI_PLACEHOLDER_KEY : await getStoredApiKey(provider)
  if (!apiKey) return { success: false, error: `No API key configured for ${provider}` }

  const tone = STYLE_TONE[translationStyle] ?? STYLE_TONE.general
  const prompt = `Translate into ${targetLang}. Tone: ${tone}. Output only the translation.\n\n${text}`

  try {
    if (provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(apiKey)
      const genModel = genAI.getGenerativeModel({ model: resolvedModel, systemInstruction: LIGHTWEIGHT_TRANSLATOR_PROMPT })
      const result = await genModel.generateContent(prompt)
      return { success: true, translatedText: result.response.text().trim() }
    }
    if (provider === 'openai') {
      const OpenAI = (await import('openai')).default
      const client = new OpenAI({ apiKey })
      const completion = await client.chat.completions.create({
        model: resolvedModel,
        messages: [{ role: 'system', content: LIGHTWEIGHT_TRANSLATOR_PROMPT }, { role: 'user', content: prompt }],
        max_completion_tokens: MAX_LIGHTWEIGHT_TRANSLATE_TOKENS,
      })
      return { success: true, translatedText: (completion.choices[0]?.message?.content ?? '').trim() }
    }
    if (provider === 'local') {
      const OpenAI = (await import('openai')).default
      const local = await resolveLocalAiRequestModel(resolvedModel)
      const client = new OpenAI({ apiKey: LOCAL_AI_PLACEHOLDER_KEY, baseURL: local.baseURL })
      const completion = await client.chat.completions.create({
        model: local.model,
        messages: [{ role: 'system', content: LIGHTWEIGHT_TRANSLATOR_PROMPT }, { role: 'user', content: prompt }],
        max_tokens: MAX_LIGHTWEIGHT_TRANSLATE_TOKENS,
      })
      return { success: true, translatedText: (completion.choices[0]?.message?.content ?? '').trim() }
    }
    if (provider === 'claude') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: resolvedModel,
        max_tokens: MAX_LIGHTWEIGHT_TRANSLATE_TOKENS,
        system: LIGHTWEIGHT_TRANSLATOR_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      })
      const block = msg.content[0]
      if (block.type === 'text') return { success: true, translatedText: block.text.trim() }
      return { success: false, error: 'Unexpected response from Claude' }
    }
    return { success: false, error: `Unknown provider: ${provider}` }
  } catch (e) {
    // Log full error (including stack) on the server only. Do not propagate
    // stack-trace or low-level SDK error details back to the caller — they
    // can travel through the local HTTP server to browser extension/web
    // pages and may leak implementation details (CWE-209/497).
    console.error('[lightweightTranslate] Translation failed:', e)
    return { success: false, error: 'Translation failed' }
  }
}
