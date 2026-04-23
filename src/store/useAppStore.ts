/**
 * useAppStore — root Zustand store that assembles all feature slices.
 *
 * Architecture: this file is a thin aggregator.
 * All domain logic lives in the dedicated slice files under ./slices/:
 *   - coreSlice      — translation text, language pair, provider/model, navigation
 *   - settingsSlice  — locale, UI preferences, provider key status, dynamic models
 *   - historySlice   — translation history + live sessions
 *   - chatSlice      — chat sessions + system prompt presets
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { TRANSLATIONS, type Translations } from '../i18n'
import { type ChatSlice, createChatSlice } from './slices/chatSlice'
import { type CoreSlice, createCoreSlice } from './slices/coreSlice'
import { createHistorySlice, type HistorySlice } from './slices/historySlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'

/** Full app state = core + all feature slices */
type AppState = CoreSlice & SettingsSlice & HistorySlice & ChatSlice

/** Zustand persist storage key — change this value to force-reset all persisted state */
const STORE_PERSIST_KEY = 'translate-app-settings'

/**
 * Debounced localStorage storage — batches writes at most once per `delay` ms.
 * Prevents excessive serialization on rapid state updates (e.g. typing in source text).
 */
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
      ...createCoreSlice(set, get, store),
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
        phoneticMode: state.phoneticMode,
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

/** Standalone hook for translations — re-renders on locale change. */
export function useT(): Translations {
  return useAppStore((s) => TRANSLATIONS[s.locale])
}
