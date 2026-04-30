/**
 * settingsSlice — Zustand store slice for User Preferences and Provider State.
 *
 * Covers: app locale, UI settings (font size, auto-translate, furigana),
 * translation style, TTS voice, API key status cache, and dynamically
 * fetched model lists — all independently versioned from chat/history state.
 */
import type { StateCreator } from 'zustand'
import { DEFAULT_SETTINGS, PROVIDERS } from '../../constants/providers'
import type { AppLocale } from '../../i18n'
import type { ChatSendShortcut, FetchedModel, PhoneticMode, Provider, SttProvider, TranslationStyle, TtsMode, TtsVoice } from '../../types'
import { DEFAULT_CHAT_NEW_SESSION_SHORTCUT, DEFAULT_CHAT_SEND_SHORTCUT } from '../../utils/keyboardShortcuts'

export interface SettingsSlice {
  // Locale
  locale: AppLocale
  /** When true, locale is automatically set from system language on startup */
  localeAuto: boolean

  // UI preferences
  autoTranslate: boolean
  autoTranslateDelay: number
  /**
   * Phonetic annotation mode for the translation result:
   *  - 'off'      — no phonetic annotations
   *  - 'standard' — ruby/furigana annotations above original characters ({word|reading} format)
   *  - 'phonetic' — replace script with pure phonetics (hiragana-only, pinyin-only, romanization-only, IPA)
   */
  phoneticMode: PhoneticMode
  translationStyle: TranslationStyle
  ttsMode: TtsMode
  ttsVoice: TtsVoice
  fontSize: 'small' | 'medium' | 'large'
  /**
   * Preferred STT provider. Default 'auto' tries Whisper first then falls back
   * to Google Cloud STT (using the Gemini key), keeping voice input resilient
   * even when the OpenAI API is unavailable or out of credits.
   */
  sttProvider: SttProvider
  chatSendShortcut: ChatSendShortcut
  chatNewSessionShortcut: string

  // Provider / key status
  keyStatus: Record<Provider, boolean>

  // Dynamic models (fetched from API per provider)
  dynamicModels: Record<Provider, FetchedModel[]>
  modelsLoading: Record<Provider, boolean>
  modelsError: Record<Provider, string | null>

  // Actions — locale
  /** Set locale explicitly by user — disables auto-follow */
  setLocale: (locale: AppLocale) => void
  /** Set locale from system detection — does NOT disable auto-follow */
  setLocaleFromSystem: (locale: AppLocale) => void
  setLocaleAuto: (v: boolean) => void

  // Actions — preferences
  setAutoTranslate: (v: boolean) => void
  setAutoTranslateDelay: (ms: number) => void
  setPhoneticMode: (mode: PhoneticMode) => void
  setTranslationStyle: (style: TranslationStyle) => void
  setTtsMode: (mode: TtsMode) => void
  setTtsVoice: (voice: TtsVoice) => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void
  setSttProvider: (provider: SttProvider) => void
  setChatSendShortcut: (shortcut: ChatSendShortcut) => void
  setChatNewSessionShortcut: (shortcut: string) => void

  /** Whether a Tavily API key is stored (used for Deep Research web search) */
  hasTavilyKey: boolean
  /** Whether a Brave Search API key is stored (Deep Research fallback) */
  hasBraveKey: boolean

  // Actions — provider state
  setKeyStatus: (provider: Provider, hasKey: boolean) => void
  setDynamicModels: (provider: Provider, models: FetchedModel[]) => void
  setModelsLoading: (provider: Provider, loading: boolean) => void
  setModelsError: (provider: Provider, error: string | null) => void
  setHasTavilyKey: (v: boolean) => void
  setHasBraveKey: (v: boolean) => void
}

// biome-ignore lint/suspicious/noExplicitAny: StateCreator full-state generic omitted to avoid circular deps — full AppState is assembled in useAppStore.ts
export const createSettingsSlice: StateCreator<any, [], [], SettingsSlice> = (set) => ({
  locale: 'en' as AppLocale,
  localeAuto: true,
  autoTranslate: DEFAULT_SETTINGS.autoTranslate,
  autoTranslateDelay: DEFAULT_SETTINGS.autoTranslateDelay,
  phoneticMode: 'off' as PhoneticMode,
  translationStyle: 'general' as TranslationStyle,
  ttsMode: 'free' as TtsMode,
  ttsVoice: 'nova' as TtsVoice,
  fontSize: 'medium' as const,
  sttProvider: 'auto' as SttProvider,
  chatSendShortcut: DEFAULT_CHAT_SEND_SHORTCUT,
  chatNewSessionShortcut: DEFAULT_CHAT_NEW_SESSION_SHORTCUT,
  // Build initial provider maps from PROVIDERS registry — adding a new provider only requires
  // updating constants/providers.ts; no need to touch this slice.
  keyStatus: Object.fromEntries(PROVIDERS.map((p) => [p.id, false])) as Record<Provider, boolean>,
  dynamicModels: Object.fromEntries(PROVIDERS.map((p): [string, FetchedModel[]] => [p.id, []])) as Record<Provider, FetchedModel[]>,
  modelsLoading: Object.fromEntries(PROVIDERS.map((p) => [p.id, false])) as Record<Provider, boolean>,
  modelsError: Object.fromEntries(PROVIDERS.map((p): [string, string | null] => [p.id, null])) as Record<Provider, string | null>,
  hasTavilyKey: false,
  hasBraveKey: false,

  // Locale — explicit user choice turns off auto-follow
  setLocale: (locale) => set({ locale, localeAuto: false }),
  // System detection — does NOT change localeAuto flag
  setLocaleFromSystem: (locale) => set({ locale }),
  setLocaleAuto: (v) => set({ localeAuto: v }),

  setAutoTranslate: (v) => set({ autoTranslate: v }),
  setAutoTranslateDelay: (ms) => set({ autoTranslateDelay: ms }),
  setPhoneticMode: (mode) => set({ phoneticMode: mode }),
  setTranslationStyle: (style) => set({ translationStyle: style }),
  setTtsMode: (mode) => set({ ttsMode: mode }),
  setTtsVoice: (voice) => set({ ttsVoice: voice }),
  setFontSize: (size) => set({ fontSize: size }),
  setSttProvider: (provider) => set({ sttProvider: provider }),
  setChatSendShortcut: (shortcut) => set({ chatSendShortcut: shortcut }),
  setChatNewSessionShortcut: (shortcut) => set({ chatNewSessionShortcut: shortcut }),

  setKeyStatus: (provider, hasKey) =>
    set((state: SettingsSlice) => ({ keyStatus: { ...state.keyStatus, [provider]: hasKey } })),
  setDynamicModels: (provider, models) =>
    set((state: SettingsSlice) => ({ dynamicModels: { ...state.dynamicModels, [provider]: models } })),
  setModelsLoading: (provider, loading) =>
    set((state: SettingsSlice) => ({ modelsLoading: { ...state.modelsLoading, [provider]: loading } })),
  setModelsError: (provider, error) =>
    set((state: SettingsSlice) => ({ modelsError: { ...state.modelsError, [provider]: error } })),
  setHasTavilyKey: (v) => set({ hasTavilyKey: v }),
  setHasBraveKey: (v) => set({ hasBraveKey: v }),
})
