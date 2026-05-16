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
import type { ChatSession } from '../types'
import { type ChatSlice, createChatSlice } from './slices/chatSlice'
import { type CoreSlice, createCoreSlice } from './slices/coreSlice'
import { createDictionarySlice, type DictionarySlice } from './slices/dictionarySlice'
import { createHistorySlice, type HistorySlice } from './slices/historySlice'
import { createSettingsSlice, type SettingsSlice } from './slices/settingsSlice'
import { createUsageSlice, type UsageSlice } from './slices/usageSlice'

/** Full app state = core + all feature slices */
type AppState = CoreSlice & SettingsSlice & HistorySlice & ChatSlice & DictionarySlice & UsageSlice

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


/**
 * Drop renderer-only blob fields from a chat session before persisting it.
 * `imageBase64` (and the `data:`-URL `imagePreviewUrl` derived from it) can be
 * multiple megabytes each — keeping them in localStorage risks blowing the
 * quota the first time the user attaches a high-res photo. We retain the
 * filename and MIME type so the UI can still render a meaningful past message.
 */
function stripChatSessionImageData(session: ChatSession): ChatSession {
  return {
    ...session,
    messages: session.messages.map((message) => ({
      ...message,
      content: message.content.map((part) =>
        part.type === 'image'
          ? {
            type: 'image',
            text: part.text,
            imageFileName: part.imageFileName,
            imageMimeType: part.imageMimeType,
          }
          : part,
      ),
    })),
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
      ...createUsageSlice(set),
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
        // Strip ephemeral image data (base64 + preview URL) from each chat
        // message before writing to localStorage. Without this, attached
        // images can easily push a single session over the 5–10 MB browser
        // quota, causing silent persist failures and lost history. The
        // metadata we keep (fileName + mimeType) lets the UI still display
        // a "[image]" placeholder for past turns.
        chatSessions: state.chatSessions.map(stripChatSessionImageData),
        chatSystemPrompt: state.chatSystemPrompt,
        systemPromptPresets: state.systemPromptPresets,
        chatPendingDraft: state.chatPendingDraft,
        chatPendingDeepResearchMode: state.chatPendingDeepResearchMode,

        langUsage: state.langUsage,
        dictionaryEntries: state.dictionaryEntries,
        costCurrency: state.costCurrency,
        apiKeyUsageTotals: state.apiKeyUsageTotals,
      }),
    }
  )
)

/** Standalone hook for translations — re-renders on locale change. */
export function useT(): Translations {
  return useAppStore((s) => TRANSLATIONS[s.locale])
}
