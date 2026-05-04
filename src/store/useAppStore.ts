/**
 * useAppStore — root Zustand store that assembles all feature slices.
 *
 * Architecture: this file is a thin aggregator.
 * All domain logic lives in the dedicated slice files under ./slices/:
 *   - coreSlice      — translation text, language pair, provider/model, navigation
 *   - settingsSlice  — locale, UI preferences, provider key status, dynamic models
 *   - historySlice   — translation history + live sessions
 *   - chatSlice      — chat sessions + system prompt presets
 *   - dictionarySlice — dictionary lookup history + favorites
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { TRANSLATIONS, type Translations } from '../i18n'
import { type ChatSlice, createChatSlice } from './slices/chatSlice'
import { type CoreSlice, createCoreSlice } from './slices/coreSlice'
import { createDictionarySlice, type DictionarySlice } from './slices/dictionarySlice'
import { createHistorySlice, type HistorySlice } from './slices/historySlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'

/** Full app state = core + all feature slices */
type AppState = CoreSlice & SettingsSlice & HistorySlice & ChatSlice & DictionarySlice

/** Zustand persist storage key — change this value to force-reset all persisted state */
const STORE_PERSIST_KEY = 'translate-app-settings'

/**
 * Debounced localStorage storage — batches writes at most once per `delay` ms.
 * Prevents excessive serialization on rapid state updates (e.g. typing in source text).
 *
 * Exposes a module-level `flushPersistedStore()` that synchronously commits any
 * pending write — used to make sure cross-window listeners (e.g. the standalone
 * Quick Chat popup) see the latest provider/model selection without waiting for
 * the debounce timeout.
 */
let flushDebouncedWrite: () => void = () => {}

export function flushPersistedStore(): void {
  flushDebouncedWrite()
}

function createDebouncedStorage(delay = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingKey: string | null = null
  let pendingValue: string | null = null

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (pendingKey !== null && pendingValue !== null) {
      localStorage.setItem(pendingKey, pendingValue)
      pendingKey = null
      pendingValue = null
    }
  }
  flushDebouncedWrite = flush

  return {
    getItem: (key: string) => localStorage.getItem(key),
    setItem: (key: string, value: string) => {
      pendingKey = key
      pendingValue = value
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    removeItem: (key: string) => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      pendingKey = null
      pendingValue = null
      localStorage.removeItem(key)
    },
  }
}


export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...createCoreSlice(set, get),
      ...createSettingsSlice(set),
      ...createHistorySlice(set),
      ...createChatSlice(set),
      ...createDictionarySlice(set),
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
        ttsMode: state.ttsMode,
        ttsVoice: state.ttsVoice,
        fontSize: state.fontSize,
        sttProvider: state.sttProvider,
        chatSendShortcut: state.chatSendShortcut,
        chatNewSessionShortcut: state.chatNewSessionShortcut,
        sidebarCollapsed: state.sidebarCollapsed,
        locale: state.locale,
        localeAuto: state.localeAuto,
        history: state.history,
        liveSessions: state.liveSessions,
        chatSessions: state.chatSessions,
        chatSystemPrompt: state.chatSystemPrompt,
        systemPromptPresets: state.systemPromptPresets,
        langUsage: state.langUsage,
        dictionaryEntries: state.dictionaryEntries,
      }),
    }
  )
)

/** Standalone hook for translations — re-renders on locale change. */
export function useT(): Translations {
  return useAppStore((s) => TRANSLATIONS[s.locale])
}
