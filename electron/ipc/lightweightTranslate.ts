import {
  LIGHTWEIGHT_TRANSLATOR_PROMPT,
  MAX_LIGHTWEIGHT_TRANSLATE_TOKENS,
  EXT_DEFAULT_GEMINI_MODEL,
  EXT_DEFAULT_OPENAI_MODEL,
  EXT_DEFAULT_CLAUDE_MODEL,
} from './ipcConstants'
import { getStoredApiKey } from './storage'

type TranslationStyle = 'friendly' | 'neutral' | 'professional' | 'business' | 'slack' | 'polite' | 'technical'

const STYLE_TONE: Record<TranslationStyle, string> = {
  friendly: 'friendly, warm, casual — like chatting with a close friend or family member; use informal language, contractions, and expressive wording',
  neutral: 'neutral, clear, natural — well-balanced register suitable for general everyday use; neither overly formal nor overly casual',
  professional: 'professional, polished, confident — appropriate for interactions with colleagues, clients, or business partners',
  business: 'formal business register — highly concise, precise, and objective; appropriate for official corporate communication',
  slack: 'concise workplace chat style — informal yet professional; direct and efficient as in instant messaging',
  polite: 'polite, respectful, considerate — suitable for addressing someone of higher status or unfamiliar parties; uses appropriate honorifics',
  technical: 'technical, precise, domain-specific — uses accurate, industry-standard technical terminology; clear and unambiguous',
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
  translationStyle = 'neutral',
}: LightweightTranslateParams): Promise<{ success: boolean; translatedText?: string; error?: string }> {
  if (!text?.trim()) return { success: false, error: 'Text is empty' }

  const resolvedModel = model ?? (
    provider === 'gemini' ? EXT_DEFAULT_GEMINI_MODEL
    : provider === 'openai' ? EXT_DEFAULT_OPENAI_MODEL
    : EXT_DEFAULT_CLAUDE_MODEL
  )

  const apiKey = await getStoredApiKey(provider)
  if (!apiKey) return { success: false, error: `No API key configured for ${provider}` }

  const tone = STYLE_TONE[translationStyle] ?? STYLE_TONE.neutral
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
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  }
}
