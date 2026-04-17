import { ProviderConfig, Language, Provider } from '../types'

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    color: '#4285F4',
    emoji: '🟡',
    keyPrefix: 'AIza',
    docsUrl: 'https://aistudio.google.com/apikey',
    models: [
      // ★ When adding a new Gemini model, mark the fastest/best translation model as tag:'recommended'
      { id: 'gemini-2.5-flash-preview-04-17', name: 'Gemini 2.5 Flash', description: 'Newest & fastest', tag: 'recommended' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast & capable', tag: 'balanced' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', description: 'Ultra fast & light', tag: 'balanced' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast & efficient', tag: 'balanced' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Most capable', tag: 'powerful' },
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    color: '#CC785C',
    emoji: '🟣',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com',
    models: [
      // ★ When adding a new Claude model, mark the fastest/best translation model as tag:'recommended'
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fastest & efficient', tag: 'recommended' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Balanced performance', tag: 'balanced' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', description: 'Most powerful', tag: 'powerful' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    color: '#10A37F',
    emoji: '🟢',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    models: [
      // ★ When adding a new OpenAI model, mark the fastest/best translation model as tag:'recommended'
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & efficient', tag: 'recommended' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable', tag: 'balanced' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Economy', tag: 'powerful' },
    ],
  },
]

/**
 * Returns the ID of the recommended translation model for a given provider.
 * Falls back to the first model in the list if none is tagged 'recommended'.
 *
 * MAINTENANCE: When a provider releases a new, faster/better translation model,
 * update the PROVIDERS array above:
 *   1. Set the new model's tag to 'recommended'
 *   2. Change the previous recommended model's tag to 'balanced' or 'powerful'
 * This function will automatically pick up the new default.
 */
export function getRecommendedModel(providerId: Provider): string {
  const provider = PROVIDERS.find((p) => p.id === providerId)
  if (!provider) return ''
  const recommended = provider.models.find((m) => m.tag === 'recommended')
  return recommended?.id ?? provider.models[0]?.id ?? ''
}

export const LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto Detect', nativeName: 'Auto' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
]

export const TARGET_LANGUAGES = LANGUAGES.filter((l) => l.code !== 'auto')

/**
 * Maximum number of characters allowed in the translation input.
 * Prevents accidental high API costs and request timeouts.
 * Show a warning in the UI when the user exceeds this limit.
 */
export const MAX_INPUT_CHARS = 5000

/**
 * Maximum number of characters allowed in the chat input.
 * Chat context is smaller than full-page translation so the limit is lower.
 */
export const MAX_CHAT_INPUT_CHARS = 3000

/**
 * Maximum characters of source text sent to the AI for language detection.
 * Enough to reliably identify any language; truncating saves tokens on long inputs.
 *
 * IMPORTANT: Must stay in sync with DETECT_LANG_MAX_CHARS in electron/ipc/ipcConstants.ts
 * which applies the same limit in the main process (defence-in-depth).
 */
export const DETECT_LANG_MAX_CHARS = 500

/**
 * Fallback language code for TTS when source language is set to 'auto'.
 * 'auto' is not a valid BCP-47 tag for speech synthesis, so we fall back to English.
 */
export const DEFAULT_TTS_FALLBACK_LANG = 'en'

export const DEFAULT_SETTINGS = {
  defaultProvider: 'gemini' as const,
  defaultSourceLang: 'auto',
  defaultTargetLang: 'vi',
  /** Auto-resolved from PROVIDERS using tag:'recommended' — update tags to change defaults */
  defaultModels: {
    gemini: getRecommendedModel('gemini'),
    claude: getRecommendedModel('claude'),
    openai: getRecommendedModel('openai'),
  },
  autoTranslate: true,
  autoTranslateDelay: 800,
}
