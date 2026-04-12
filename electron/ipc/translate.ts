import { IpcMain } from 'electron'

const KEYCHAIN_SERVICE = 'TranslateApp'

type TranslationStyle = 'standard' | 'casual' | 'formal' | 'message' | 'technical'

interface TranslateParams {
  provider: string
  model: string
  sourceText: string
  sourceLang: string
  targetLang: string
  showFurigana?: boolean
  translationStyle?: TranslationStyle
}

async function getApiKey(provider: string): Promise<string | null> {
  try {
    const keytar = await import('keytar')
    return await keytar.default.getPassword(KEYCHAIN_SERVICE, provider)
  } catch {
    return null
  }
}

const STYLE_INSTRUCTIONS: Record<TranslationStyle, string> = {
  standard: '',
  casual: ' Use casual, friendly, and natural everyday language. Avoid stiff or formal expressions.',
  formal: ' Use formal, professional language suitable for business documents, emails, and official contexts.',
  message: ' Use brief, conversational language as if writing a quick message on Slack or a chat app. Keep it concise and informal.',
  technical: ' Use precise technical language with appropriate domain-specific terminology. Maintain accuracy over readability.',
}

function buildPrompt(sourceText: string, sourceLang: string, targetLang: string, showFurigana = false, style: TranslationStyle = 'standard'): string {
  const sourceName = sourceLang === 'auto' ? 'the detected language' : sourceLang
  const styleInstruction = STYLE_INSTRUCTIONS[style] ?? ''
  let phoneticInstruction = ''
  if (showFurigana) {
    if (targetLang === 'ja') {
      phoneticInstruction = ' For every kanji word or phrase in the translation, wrap it with its furigana reading in the format {kanji|reading} (e.g. {東京|とうきょう}). Apply to ALL kanji including standalone characters.'
    } else if (targetLang === 'zh' || targetLang === 'zh-TW') {
      phoneticInstruction = ' For every Chinese word or character in the translation, wrap it with its pinyin reading in the format {character|pīnyīn} (e.g. {北京|Běijīng}). Apply to ALL Chinese characters.'
    } else if (targetLang === 'ko') {
      phoneticInstruction = ' For every Korean word in the translation, wrap it with its romanization in the format {한국어|romanization} (e.g. {서울|Seoul}). Apply to ALL Korean words.'
    } else {
      phoneticInstruction = ' For every word in the translation, wrap it with its pronunciation or phonetic transcription in the format {word|pronunciation} (e.g. {hello|həˈloʊ}). Use IPA notation where applicable.'
    }
  }
  return `Translate the following text from ${sourceName} to ${targetLang}. Return only the translated text, no explanations, no notes, no alternatives.${styleInstruction}${phoneticInstruction}\n\nText to translate:\n${sourceText}`
}

async function translateWithGemini(
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  showFurigana: boolean,
  style: TranslationStyle
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction:
      'You are a professional translator. Translate accurately and naturally. Return only the translated text.',
  })
  const result = await genModel.generateContent(buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style))
  return result.response.text().trim()
}

async function translateWithClaude(
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  showFurigana: boolean,
  style: TranslationStyle
): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system:
      'You are a professional translator. Translate accurately and naturally. Return only the translated text.',
    messages: [
      {
        role: 'user',
        content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style),
      },
    ],
  })
  const block = message.content[0]
  if (block.type === 'text') return block.text.trim()
  throw new Error('Unexpected response type from Claude')
}

async function translateWithOpenAI(
  apiKey: string,
  model: string,
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  showFurigana: boolean,
  style: TranslationStyle
): Promise<string> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a professional translator. Translate accurately and naturally. Return only the translated text.',
      },
      {
        role: 'user',
        content: buildPrompt(sourceText, sourceLang, targetLang, showFurigana, style),
      },
    ],
    max_tokens: 4096,
  })
  return (completion.choices[0]?.message?.content ?? '').trim()
}

async function verifyGeminiKey(apiKey: string): Promise<void> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  // List models as a lightweight verification call
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent('Say "ok" in one word.')
  const text = result.response.text()
  if (!text) throw new Error('No response from Gemini')
}

async function verifyClaudeKey(apiKey: string): Promise<void> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })
  const message = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say "ok".' }],
  })
  if (!message.content[0]) throw new Error('No response from Claude')
}

async function verifyOpenAIKey(apiKey: string): Promise<void> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({ apiKey })
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Say "ok".' }],
    max_tokens: 5,
  })
  if (!completion.choices[0]) throw new Error('No response from OpenAI')
}

export function registerTranslateHandlers(ipcMain: IpcMain) {
  // Verify API key by making a minimal test request
  ipcMain.handle('translate:verify', async (_event, provider: string, apiKey: string) => {
    if (!apiKey?.trim()) {
      return { success: false, error: 'API key is empty' }
    }
    try {
      switch (provider) {
        case 'gemini':
          await verifyGeminiKey(apiKey)
          break
        case 'claude':
          await verifyClaudeKey(apiKey)
          break
        case 'openai':
          await verifyOpenAIKey(apiKey)
          break
        default:
          return { success: false, error: `Unknown provider: ${provider}` }
      }
      return { success: true }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('authentication') || msg.includes('API key')) {
        return { success: false, error: 'Invalid API key', errorCode: 'INVALID_KEY' }
      }
      if (msg.includes('429') || msg.includes('quota') || msg.includes('rate_limit')) {
        return { success: false, error: 'Rate limit hit, but key is valid!', errorCode: 'RATE_LIMIT', valid: true }
      }
      if (msg.includes('ENOTFOUND') || msg.includes('network')) {
        return { success: false, error: 'No internet connection', errorCode: 'NETWORK' }
      }
      return { success: false, error: msg }
    }
  })

  ipcMain.handle('translate', async (_event, params: TranslateParams) => {
    const { provider, model, sourceText, sourceLang, targetLang, showFurigana, translationStyle } = params

    if (!sourceText.trim()) {
      return { success: false, error: 'Source text is empty' }
    }

    const apiKey = await getApiKey(provider)
    if (!apiKey) {
      return {
        success: false,
        error: `No API key found for ${provider}. Please add it in Settings.`,
        errorCode: 'NO_API_KEY',
      }
    }

    try {
      let translatedText = ''

      switch (provider) {
        case 'gemini':
          translatedText = await translateWithGemini(apiKey, model, sourceText, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'standard')
          break
        case 'claude':
          translatedText = await translateWithClaude(apiKey, model, sourceText, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'standard')
          break
        case 'openai':
          translatedText = await translateWithOpenAI(apiKey, model, sourceText, sourceLang, targetLang, !!showFurigana, translationStyle ?? 'standard')
          break
        default:
          return { success: false, error: `Unknown provider: ${provider}` }
      }

      return { success: true, translatedText }
    } catch (error: unknown) {
      console.error(`Translation error with ${provider}:`, error)
      const msg = error instanceof Error ? error.message : String(error)

      // Categorize common errors
      if (msg.includes('401') || msg.includes('invalid_api_key') || msg.includes('authentication')) {
        return { success: false, error: 'Invalid API key. Please check your key in Settings.', errorCode: 'INVALID_KEY' }
      }
      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota')) {
        return { success: false, error: 'Rate limit exceeded. Please wait and try again.', errorCode: 'RATE_LIMIT' }
      }
      if (msg.includes('ENOTFOUND') || msg.includes('network') || msg.includes('fetch')) {
        return { success: false, error: 'No internet connection.', errorCode: 'NETWORK' }
      }

      return { success: false, error: `Translation failed: ${msg}` }
    }
  })
}
