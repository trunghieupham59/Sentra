import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_SETTINGS } from '../constants/providers'
import { TRANSLATIONS, type Translations } from '../i18n'
import type { Provider } from '../types'
import { createChatSlice, type ChatSlice } from './slices/chatSlice'
import { createHistorySlice, type HistorySlice } from './slices/historySlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'

// ── Core translation + navigation state ───────────────────────────────────────
interface CoreSlice {
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
  swapLanguages: (detectedLang?: string) => void
  setIsTranslating: (v: boolean) => void
  setTranslateError: (err: string | null) => void
  setSelectedProvider: (provider: Provider) => void
  setSelectedModel: (provider: Provider, model: string) => void
  setActivePage: (page: 'translate' | 'history' | 'settings' | 'chat' | 'live') => void
  clearTranslation: () => void

  // Computed
  t: Translations
}

/** Full app state = core + all feature slices */
type AppState = CoreSlice & SettingsSlice & HistorySlice & ChatSlice

/** Zustand persist storage key — đổi giá trị này nếu cần reset toàn bộ persisted state */
const STORE_PERSIST_KEY = 'translate-app-settings'

// Debounced localStorage storage — batches writes at most once per 500ms
function createDebouncedStorage(delay = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingValue: string | null = null

  return {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      pendingValue = value
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (pendingValue !== null) {
          localStorage.setItem(key, pendingValue)
          pendingValue = null
        }
      }, delay)
    },
    removeItem: (key: string) => localStorage.removeItem(key),
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get, store) => ({
      // ── Core initial state ──────────────────────────────────────────────
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

      // Computed getter — current translations
      get t() {
        return TRANSLATIONS[get().locale]
      },

      // ── Core actions ────────────────────────────────────────────────────
      setSourceText: (text) => set({ sourceText: text, translateError: null }),
      setTranslatedText: (text) => set({ translatedText: text }),
      setPhoneticText: (text) => set({ phoneticText: text }),
      setSourceLang: (lang) => set({ sourceLang: lang }),
      setTargetLang: (lang) => set({ targetLang: lang }),

      swapLanguages: (detectedLang?: string) =>
        set((state) => {
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
        set((state) => ({ selectedModels: { ...state.selectedModels, [provider]: model } })),

      setActivePage: (page) => set({ activePage: page }),
      clearTranslation: () =>
        set({ sourceText: '', translatedText: '', phoneticText: '', translateError: null }),

      // ── Feature slices ───────────────────────────────────────────────────
      ...createSettingsSlice(set, get, store),
      ...createHistorySlice(set, get, store),
      ...createChatSlice(set, get, store),
    }),
    {
      name: STORE_PERSIST_KEY,
      storage: createJSONStorage(() => createDebouncedStorage(500)),
      partialize: (state) => ({
        sourceLang: state.sourceLang,
        targetLang: state.targetLang,
        selectedProvider: state.selectedProvider,
        selectedModels: state.selectedModels,
        autoTranslate: state.autoTranslate,
        autoTranslateDelay: state.autoTranslateDelay,
        showFurigana: state.showFurigana,
        translationStyle: state.translationStyle,
        ttsVoice: state.ttsVoice,
        fontSize: state.fontSize,
        locale: state.locale,
        localeAuto: state.localeAuto,
        history: state.history,
        liveSessions: state.liveSessions,
        chatSessions: state.chatSessions,
        chatSystemPrompt: state.chatSystemPrompt,
        systemPromptPresets: state.systemPromptPresets,
      }),
    }
  )
)

// Standalone hook for translations (re-renders on locale change)
export function useT(): Translations {
  return useAppStore((s) => TRANSLATIONS[s.locale])
}
