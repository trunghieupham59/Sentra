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
import type { FetchedModel, Provider, TranslationStyle, TtsVoice } from '../../types'

export interface SettingsSlice {
  // Locale
  locale: AppLocale
  /** When true, locale is automatically set from system language on startup */
  localeAuto: boolean

  // UI preferences
  autoTranslate: boolean
  autoTranslateDelay: number
  showFurigana: boolean
  translationStyle: TranslationStyle
  ttsVoice: TtsVoice
  fontSize: 'small' | 'medium' | 'large'

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
  setShowFurigana: (v: boolean) => void
  setTranslationStyle: (style: TranslationStyle) => void
  setTtsVoice: (voice: TtsVoice) => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void

  // Actions — provider state
  setKeyStatus: (provider: Provider, hasKey: boolean) => void
  setDynamicModels: (provider: Provider, models: FetchedModel[]) => void
  setModelsLoading: (provider: Provider, loading: boolean) => void
  setModelsError: (provider: Provider, error: string | null) => void
}

// biome-ignore lint/suspicious/noExplicitAny: StateCreator full-state generic omitted to avoid circular deps — full AppState is assembled in useAppStore.ts
export const createSettingsSlice: StateCreator<any, [], [], SettingsSlice> = (set) => ({
  locale: 'en' as AppLocale,
  localeAuto: true,
  autoTranslate: DEFAULT_SETTINGS.autoTranslate,
  autoTranslateDelay: DEFAULT_SETTINGS.autoTranslateDelay,
  showFurigana: false,
  translationStyle: 'neutral' as TranslationStyle,
  ttsVoice: 'nova' as TtsVoice,
  fontSize: 'medium' as const,
  // Build initial provider maps from PROVIDERS registry — adding a new provider only requires
  // updating constants/providers.ts; no need to touch this slice.
  keyStatus: Object.fromEntries(PROVIDERS.map((p) => [p.id, false])) as Record<Provider, boolean>,
  dynamicModels: Object.fromEntries(PROVIDERS.map((p): [string, FetchedModel[]] => [p.id, []])) as Record<Provider, FetchedModel[]>,
  modelsLoading: Object.fromEntries(PROVIDERS.map((p) => [p.id, false])) as Record<Provider, boolean>,
  modelsError: Object.fromEntries(PROVIDERS.map((p): [string, string | null] => [p.id, null])) as Record<Provider, string | null>,

  // Locale — explicit user choice turns off auto-follow
  setLocale: (locale) => set({ locale, localeAuto: false }),
  // System detection — does NOT change localeAuto flag
  setLocaleFromSystem: (locale) => set({ locale }),
  setLocaleAuto: (v) => set({ localeAuto: v }),

  setAutoTranslate: (v) => set({ autoTranslate: v }),
  setAutoTranslateDelay: (ms) => set({ autoTranslateDelay: ms }),
  setShowFurigana: (v) => set({ showFurigana: v }),
  setTranslationStyle: (style) => set({ translationStyle: style }),
  setTtsVoice: (voice) => set({ ttsVoice: voice }),
  setFontSize: (size) => set({ fontSize: size }),

  setKeyStatus: (provider, hasKey) =>
    set((state: SettingsSlice) => ({ keyStatus: { ...state.keyStatus, [provider]: hasKey } })),
  setDynamicModels: (provider, models) =>
    set((state: SettingsSlice) => ({ dynamicModels: { ...state.dynamicModels, [provider]: models } })),
  setModelsLoading: (provider, loading) =>
    set((state: SettingsSlice) => ({ modelsLoading: { ...state.modelsLoading, [provider]: loading } })),
  setModelsError: (provider, error) =>
    set((state: SettingsSlice) => ({ modelsError: { ...state.modelsError, [provider]: error } })),
})
