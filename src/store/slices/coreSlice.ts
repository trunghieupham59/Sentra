/**
 * coreSlice — Zustand store slice for core translation + navigation state.
 *
 * Extracted from useAppStore.ts inline definition to follow the same pattern
 * as chatSlice / historySlice / settingsSlice — each slice owns one domain,
 * keeping useAppStore.ts as a thin aggregator.
 *
 * Contains: sourceText, translatedText, lang pair, provider/model selection,
 * active page, and the convenience `t` computed translations getter.
 */
import type { StateCreator } from 'zustand'
import { DEFAULT_SETTINGS } from '../../constants/providers'
import { TRANSLATIONS, type Translations } from '../../i18n'
import type { Provider } from '../../types'

export interface CoreSlice {
  // Translation state
  sourceText: string
  translatedText: string
  phoneticText: string
  sourceLang: string
  targetLang: string
  isTranslating: boolean
  translateError: string | null

  // Provider/Model selection
  selectedProvider: Provider
  selectedModels: Record<Provider, string>

  // Active page
  activePage: 'translate' | 'history' | 'settings' | 'chat' | 'live'

  // Core actions
  setSourceText: (text: string) => void
  setTranslatedText: (text: string) => void
  setPhoneticText: (text: string) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  /** Swap source ↔ target languages + texts.
   * @param detectedLang — optional AI-detected source lang to use as the new target. */
  swapLanguages: (detectedLang?: string) => void
  setIsTranslating: (v: boolean) => void
  setTranslateError: (err: string | null) => void
  setSelectedProvider: (provider: Provider) => void
  setSelectedModel: (provider: Provider, model: string) => void
  setActivePage: (page: CoreSlice['activePage']) => void
  clearTranslation: () => void

  // Computed — reads locale from SettingsSlice via store.get()
  t: Translations
}

// biome-ignore lint/suspicious/noExplicitAny: StateCreator full-state generic omitted to avoid circular deps — full AppState is assembled in useAppStore.ts
export const createCoreSlice: StateCreator<any, [], [], CoreSlice> = (set, get) => ({
  // ── Initial state ───────────────────────────────────────────────────────────
  sourceText: '',
  translatedText: '',
  phoneticText: '',
  sourceLang: DEFAULT_SETTINGS.defaultSourceLang,
  targetLang: DEFAULT_SETTINGS.defaultTargetLang,
  isTranslating: false,
  translateError: null,
  selectedProvider: DEFAULT_SETTINGS.defaultProvider,
  selectedModels: DEFAULT_SETTINGS.defaultModels,
  activePage: 'translate',

  // Computed getter — reads locale from SettingsSlice at access time.
  // NOTE: Zustand's shallow-merge on set() means this getter lives on the
  // initial object; for reactive locale changes prefer the standalone useT() hook.
  // SAFETY: during Zustand store initialization get() returns undefined — use
  // optional chaining so the getter doesn't throw before the store is ready.
  get t() {
    const state = get() as { locale?: string } | undefined
    const locale = state?.locale
    return (locale ? TRANSLATIONS[locale as keyof typeof TRANSLATIONS] : undefined) ?? TRANSLATIONS.en
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  setSourceText: (text) => set({ sourceText: text, translateError: null }),
  setTranslatedText: (text) => set({ translatedText: text }),
  setPhoneticText: (text) => set({ phoneticText: text }),
  setSourceLang: (lang) => set({ sourceLang: lang }),
  setTargetLang: (lang) => set({ targetLang: lang }),

  swapLanguages: (detectedLang?: string) =>
    set((state: CoreSlice) => {
      // Prefer the AI-detected source language as the new target (passed from UI layer).
      // When absent, fall back to sourceLang — but 'auto' can't be a target, so use 'ja'.
      const newTargetLang = detectedLang ?? (state.sourceLang === 'auto' ? 'ja' : state.sourceLang)
      return {
        sourceLang: state.targetLang,
        targetLang: newTargetLang,
        sourceText: state.translatedText,
        translatedText: state.sourceText,
        phoneticText: '',
      }
    }),

  setIsTranslating: (v) => set({ isTranslating: v }),
  setTranslateError: (err) => set({ translateError: err }),
  setSelectedProvider: (provider) => set({ selectedProvider: provider, translateError: null }),
  setSelectedModel: (provider, model) =>
    set((state: CoreSlice) => ({ selectedModels: { ...state.selectedModels, [provider]: model } })),

  setActivePage: (page) => set({ activePage: page }),
  clearTranslation: () =>
    set({ sourceText: '', translatedText: '', phoneticText: '', translateError: null }),
})
