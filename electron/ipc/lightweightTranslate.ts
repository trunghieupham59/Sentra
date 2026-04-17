import { LIGHTWEIGHT_TRANSLATOR_PROMPT, MAX_LIGHTWEIGHT_TRANSLATE_TOKENS } from './ipcConstants'
import { getStoredApiKey } from './storage'

export interface LightweightTranslateParams {
  text: string
  targetLang: string
  provider?: string
  model?: string
}

/**
 * Lightweight translation — dùng cho global hotkey và browser extension.
 * Không có chunking, style, furigana — chỉ dịch nhanh.
 */
export async function lightweightTranslate({
  text,
  targetLang,
  provider = 'gemini',
  model,
}: LightweightTranslateParams): Promise<{ success: boolean; translatedText?: string; error?: string }> {
  if (!text?.trim()) return { success: false, error: 'Text is empty' }

  const resolvedModel = model ?? (provider === 'gemini' ? 'gemini-2.0-flash'
    : provider === 'openai' ? 'gpt-4o-mini'
    : 'claude-3-5-haiku-20241022')

  const apiKey = await getStoredApiKey(provider)
  if (!apiKey) return { success: false, error: `No API key configured for ${provider}` }

  const prompt = `Translate into ${targetLang}. Tone: neutral. Output only the translation.\n\n${text}`

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
