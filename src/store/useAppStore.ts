import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Provider, FetchedModel, HistoryItem } from '../types'
import { DEFAULT_SETTINGS } from '../constants/providers'
import { AppLocale, TRANSLATIONS, Translations } from '../i18n'

const MAX_HISTORY = 100

interface AppState {
  // Translation state
  sourceText: string
  translatedText: string
  sourceLang: string
  targetLang: string
  isTranslating: boolean
  translateError: string | null

  // Provider/Model selection
  selectedProvider: Provider
  selectedModels: Record<Provider, string>

  // Settings
  autoTranslate: boolean
  autoTranslateDelay: number

  // Key status cache
  keyStatus: Record<Provider, boolean>

  // Dynamic models (fetched from API per provider)
  dynamicModels: Record<Provider, FetchedModel[]>
  modelsLoading: Record<Provider, boolean>
  modelsError: Record<Provider, string | null>

  // App locale
  locale: AppLocale
  /** When true, locale is automatically set from system language on startup */
  localeAuto: boolean

  // Active page
  activePage: 'translate' | 'history' | 'settings'

  // Translation history
  history: HistoryItem[]

  // Actions
  setSourceText: (text: string) => void
  setTranslatedText: (text: string) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  swapLanguages: () => void
  setIsTranslating: (v: boolean) => void
  setTranslateError: (err: string | null) => void
  setSelectedProvider: (provider: Provider) => void
  setSelectedModel: (provider: Provider, model: string) => void
  setAutoTranslate: (v: boolean) => void
  setAutoTranslateDelay: (ms: number) => void
  setKeyStatus: (provider: Provider, hasKey: boolean) => void
  setDynamicModels: (provider: Provider, models: FetchedModel[]) => void
  setModelsLoading: (provider: Provider, loading: boolean) => void
  setModelsError: (provider: Provider, error: string | null) => void
  /** Set locale explicitly by user — disables auto-follow */
  setLocale: (locale: AppLocale) => void
  /** Set locale from system detection — does NOT disable auto-follow */
  setLocaleFromSystem: (locale: AppLocale) => void
  setLocaleAuto: (v: boolean) => void
  setActivePage: (page: 'translate' | 'history' | 'settings') => void
  clearTranslation: () => void

  // History actions
  addHistory: (item: HistoryItem) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void

  // Computed
  t: Translations
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      sourceText: '',
      translatedText: '',
      sourceLang: DEFAULT_SETTINGS.defaultSourceLang,
      targetLang: DEFAULT_SETTINGS.defaultTargetLang,
      isTranslating: false,
      translateError: null,
      selectedProvider: DEFAULT_SETTINGS.defaultProvider,
      selectedModels: DEFAULT_SETTINGS.defaultModels,
      autoTranslate: DEFAULT_SETTINGS.autoTranslate,
      autoTranslateDelay: DEFAULT_SETTINGS.autoTranslateDelay,
      keyStatus: { gemini: false, claude: false, openai: false },
      dynamicModels: { gemini: [], claude: [], openai: [] },
      modelsLoading: { gemini: false, claude: false, openai: false },
      modelsError: { gemini: null, claude: null, openai: null },
      locale: 'en',
      localeAuto: true,
      activePage: 'translate',
      history: [],

      // Computed getter — current translations
      get t() {
        return TRANSLATIONS[get().locale]
      },

      // Actions
      setSourceText: (text) => set({ sourceText: text, translateError: null }),
      setTranslatedText: (text) => set({ translatedText: text }),
      setSourceLang: (lang) => set({ sourceLang: lang }),
      setTargetLang: (lang) => set({ targetLang: lang }),

      swapLanguages: () =>
        set((state) => {
          if (state.sourceLang === 'auto') return {}
          return {
            sourceLang: state.targetLang,
            targetLang: state.sourceLang,
            sourceText: state.translatedText,
            translatedText: state.sourceText,
          }
        }),

      setIsTranslating: (v) => set({ isTranslating: v }),
      setTranslateError: (err) => set({ translateError: err }),
      setSelectedProvider: (provider) => set({ selectedProvider: provider, translateError: null }),
      setSelectedModel: (provider, model) =>
        set((state) => ({
          selectedModels: { ...state.selectedModels, [provider]: model },
        })),

      setAutoTranslate: (v) => set({ autoTranslate: v }),
      setAutoTranslateDelay: (ms) => set({ autoTranslateDelay: ms }),
      setKeyStatus: (provider, hasKey) =>
        set((state) => ({ keyStatus: { ...state.keyStatus, [provider]: hasKey } })),

      setDynamicModels: (provider, models) =>
        set((state) => ({ dynamicModels: { ...state.dynamicModels, [provider]: models } })),
      setModelsLoading: (provider, loading) =>
        set((state) => ({ modelsLoading: { ...state.modelsLoading, [provider]: loading } })),
      setModelsError: (provider, error) =>
        set((state) => ({ modelsError: { ...state.modelsError, [provider]: error } })),

      // Locale — explicit user choice turns off auto-follow
      setLocale: (locale) => set({ locale, localeAuto: false }),
      // System detection — does NOT change localeAuto flag
      setLocaleFromSystem: (locale) => set({ locale }),
      setLocaleAuto: (v) => set({ localeAuto: v }),

      setActivePage: (page) => set({ activePage: page }),
      clearTranslation: () =>
        set({ sourceText: '', translatedText: '', translateError: null }),

      // History actions
      addHistory: (item) =>
        set((state) => ({
          history: [item, ...state.history].slice(0, MAX_HISTORY),
        })),
      deleteHistoryItem: (id) =>
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'translate-app-settings',
      partialize: (state) => ({
        sourceLang: state.sourceLang,
        targetLang: state.targetLang,
        selectedProvider: state.selectedProvider,
        selectedModels: state.selectedModels,
        autoTranslate: state.autoTranslate,
        autoTranslateDelay: state.autoTranslateDelay,
        locale: state.locale,
        localeAuto: state.localeAuto,
        history: state.history,
      }),
    }
  )
)

// Standalone hook for translations (re-renders on locale change)
export function useT(): Translations {
  return useAppStore((s) => TRANSLATIONS[s.locale])
}
