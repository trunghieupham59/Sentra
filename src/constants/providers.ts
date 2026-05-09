import type { Language, Provider, ProviderConfig } from '../types'

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'local',
    name: 'Local AI',
    color: '#6B7280',
    keyPrefix: '',
    docsUrl: 'https://ollama.com/download',
    requiresApiKey: false,
    localEngines: ['ollama', 'lmstudio', 'llamacpp'],
    models: [
      { id: 'local-auto', name: 'Auto local model', description: 'Best running local model', tag: 'recommended', recommendedFor: 'Chat' },
      { id: 'qwen3:4b', name: 'Qwen3 4B', description: 'Balanced local model', tag: 'balanced', speed: 5, intelligence: 4, recommendedFor: 'Chat' },
      { id: 'gemma3:4b', name: 'Gemma 3 4B', description: 'Vision-capable local model', tag: 'powerful', speed: 5, intelligence: 4, capabilities: ['vision'], recommendedFor: 'Chat' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    color: '#10A37F',
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
    requiresApiKey: true,
    models: [
      // Static fallback only. Runtime model refresh uses the provider API.
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Fast, efficient model for everyday tasks', tag: 'recommended', speed: 7, intelligence: 5, contextK: 128, capabilities: ['vision', 'reasoning'], recommendedFor: 'Chat, Translation' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Balanced performance with large context', tag: 'balanced', speed: 6, intelligence: 5, contextK: 1000, capabilities: ['vision'], recommendedFor: 'Chat' },
      { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Most capable OpenAI model for complex reasoning', tag: 'powerful', speed: 4, intelligence: 8, contextK: 128, capabilities: ['vision', 'reasoning', 'image-gen'], recommendedFor: 'Chat' },
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    color: '#CC785C',
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com',
    requiresApiKey: true,
    models: [
      // Static fallback only. Runtime model refresh uses the provider API.
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance with strong reasoning', tag: 'recommended', speed: 6, intelligence: 7, contextK: 200, capabilities: ['vision', 'reasoning'], recommendedFor: 'Chat, Translation' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Highest capability for complex tasks', tag: 'balanced', speed: 4, intelligence: 8, contextK: 200, capabilities: ['vision', 'reasoning'], recommendedFor: 'Chat' },
      { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', description: 'Latest flagship with advanced reasoning', tag: 'powerful', speed: 3, intelligence: 8, contextK: 200, capabilities: ['vision', 'reasoning'], recommendedFor: 'Chat' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    color: '#4285F4',
    keyPrefix: 'AIza',
    docsUrl: 'https://aistudio.google.com/apikey',
    requiresApiKey: true,
    models: [
      // Static fallback only. Runtime model refresh uses the provider API.
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Best price-performance with long context', tag: 'recommended', speed: 8, intelligence: 6, contextK: 1000, capabilities: ['vision', 'web-search'], recommendedFor: 'Chat, Translation' },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', description: 'Fastest and most cost-efficient Gemini', tag: 'balanced', speed: 8, intelligence: 5, contextK: 1000, capabilities: ['vision'], recommendedFor: 'Translation' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable Gemini with deep reasoning', tag: 'powerful', speed: 5, intelligence: 8, contextK: 1000, capabilities: ['vision', 'reasoning', 'web-search'], recommendedFor: 'Chat' },
    ],
  },
]

/**
 * Returns the bundled fallback model for a given provider.
 * Runtime model refresh fetches the provider list through IPC and updates the
 * selected model when a newer provider-recommended model is available.
 */
export function getRecommendedModel(providerId: Provider): string {
  const provider = PROVIDERS.find((p) => p.id === providerId)
  if (!provider) return ''
  const recommended = provider.models.find((m) => m.tag === 'recommended')
  return recommended?.id ?? provider.models[0]?.id ?? ''
}

export const LANGUAGES: Language[] = [
  { code: 'auto', name: 'Auto Detect', nativeName: 'Auto' },
  // Sorted alphabetically by English name:
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'th', name: 'Thai', nativeName: 'ภาษาไทย' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
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
  defaultProvider: 'local' as const,
  defaultSourceLang: 'auto',
  defaultTargetLang: 'vi',
  /** Bundled fallback defaults. Provider API refresh updates selected cloud models at runtime. */
  defaultModels: {
    local: getRecommendedModel('local'),
    gemini: getRecommendedModel('gemini'),
    claude: getRecommendedModel('claude'),
    openai: getRecommendedModel('openai'),
  },
  autoTranslate: true,
  autoTranslateDelay: 800,
}
