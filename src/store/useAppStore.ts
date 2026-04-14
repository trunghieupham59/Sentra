import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SETTINGS } from '../constants/providers'
import { type AppLocale, TRANSLATIONS, type Translations } from '../i18n'
import type { ChatMessage, ChatSession, FetchedModel, HistoryItem, LiveSession, Provider, SystemPromptPreset, TranslationStyle, TtsVoice } from '../types'

const MAX_HISTORY = 100

/**
 * Maximum number of chat sessions to keep in memory and persisted storage.
 * Oldest sessions are removed when the limit is exceeded to prevent
 * unbounded memory growth in long-running usage.
 */
const MAX_CHAT_SESSIONS = 20

interface AppState {
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

  // Settings
  autoTranslate: boolean
  autoTranslateDelay: number
  showFurigana: boolean
  translationStyle: TranslationStyle
  ttsVoice: TtsVoice
  fontSize: 'small' | 'medium' | 'large'

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
  activePage: 'translate' | 'history' | 'settings' | 'chat' | 'live'

  // Translation history
  history: HistoryItem[]

  // Live session history
  liveSessions: LiveSession[]

  // Chat state
  chatSessions: ChatSession[]
  activeChatSessionId: string | null
  chatSystemPrompt: string
  systemPromptPresets: SystemPromptPreset[]

  // Actions
  setSourceText: (text: string) => void
  setTranslatedText: (text: string) => void
  setPhoneticText: (text: string) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  swapLanguages: () => void
  setIsTranslating: (v: boolean) => void
  setTranslateError: (err: string | null) => void
  setSelectedProvider: (provider: Provider) => void
  setSelectedModel: (provider: Provider, model: string) => void
  setAutoTranslate: (v: boolean) => void
  setAutoTranslateDelay: (ms: number) => void
  setShowFurigana: (v: boolean) => void
  setTranslationStyle: (style: TranslationStyle) => void
  setTtsVoice: (voice: TtsVoice) => void
  setFontSize: (size: 'small' | 'medium' | 'large') => void
  setKeyStatus: (provider: Provider, hasKey: boolean) => void
  setDynamicModels: (provider: Provider, models: FetchedModel[]) => void
  setModelsLoading: (provider: Provider, loading: boolean) => void
  setModelsError: (provider: Provider, error: string | null) => void
  /** Set locale explicitly by user — disables auto-follow */
  setLocale: (locale: AppLocale) => void
  /** Set locale from system detection — does NOT disable auto-follow */
  setLocaleFromSystem: (locale: AppLocale) => void
  setLocaleAuto: (v: boolean) => void
  setActivePage: (page: 'translate' | 'history' | 'settings' | 'chat' | 'live') => void
  clearTranslation: () => void

  // History actions
  addHistory: (item: HistoryItem) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void

  // Live session actions
  addLiveSession: (session: LiveSession) => void
  updateLiveSession: (id: string, updates: Partial<LiveSession>) => void
  deleteLiveSession: (id: string) => void
  clearLiveSessions: () => void

  // Chat actions
  createChatSession: (provider: Provider, model: string) => string
  deleteChatSession: (id: string) => void
  setActiveChatSession: (id: string | null) => void
  addChatMessage: (sessionId: string, message: ChatMessage) => void
  updateChatMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void
  clearChatSession: (sessionId: string) => void
  setChatSystemPrompt: (prompt: string) => void
  // System prompt presets
  addSystemPromptPreset: (preset: Omit<SystemPromptPreset, 'id'>) => string
  updateSystemPromptPreset: (id: string, updates: Partial<Omit<SystemPromptPreset, 'id'>>) => void
  deleteSystemPromptPreset: (id: string) => void
  setDefaultSystemPromptPreset: (id: string | null) => void

  // Computed
  t: Translations
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      sourceText: '',
      translatedText: '',
      phoneticText: '',
      sourceLang: DEFAULT_SETTINGS.defaultSourceLang,
      targetLang: DEFAULT_SETTINGS.defaultTargetLang,
      isTranslating: false,
      translateError: null,
      selectedProvider: DEFAULT_SETTINGS.defaultProvider,
      selectedModels: DEFAULT_SETTINGS.defaultModels,
      autoTranslate: DEFAULT_SETTINGS.autoTranslate,
      autoTranslateDelay: DEFAULT_SETTINGS.autoTranslateDelay,
      showFurigana: false,
      translationStyle: 'neutral' as TranslationStyle,
      ttsVoice: 'nova' as TtsVoice,
      fontSize: 'medium' as const,
      keyStatus: { gemini: false, claude: false, openai: false },
      dynamicModels: { gemini: [], claude: [], openai: [] },
      modelsLoading: { gemini: false, claude: false, openai: false },
      modelsError: { gemini: null, claude: null, openai: null },
      locale: 'en',
      localeAuto: true,
      activePage: 'translate',
      history: [],
      liveSessions: [],
      chatSessions: [],
      activeChatSessionId: null,
      chatSystemPrompt: '',
      systemPromptPresets: [],

      // Computed getter — current translations
      get t() {
        return TRANSLATIONS[get().locale]
      },

      // Actions
      setSourceText: (text) => set({ sourceText: text, translateError: null }),
      setTranslatedText: (text) => set({ translatedText: text }),
      setPhoneticText: (text) => set({ phoneticText: text }),
      setSourceLang: (lang) => set({ sourceLang: lang }),
      setTargetLang: (lang) => set({ targetLang: lang }),

      swapLanguages: () =>
        set((state) => {
          // When source is 'auto', we can't meaningfully swap back — fall back to 'ja'
          const newTargetLang = state.sourceLang === 'auto' ? 'ja' : state.sourceLang
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
        set((state) => ({
          selectedModels: { ...state.selectedModels, [provider]: model },
        })),

      setAutoTranslate: (v) => set({ autoTranslate: v }),
      setAutoTranslateDelay: (ms) => set({ autoTranslateDelay: ms }),
      setShowFurigana: (v) => set({ showFurigana: v }),
      setTranslationStyle: (style) => set({ translationStyle: style }),
      setTtsVoice: (voice) => set({ ttsVoice: voice }),
      setFontSize: (size) => set({ fontSize: size }),
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
        set({ sourceText: '', translatedText: '', phoneticText: '', translateError: null }),

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

      // Live session actions
      addLiveSession: (session) =>
        set((state) => ({
          liveSessions: [session, ...state.liveSessions].slice(0, 50),
        })),
      updateLiveSession: (id, updates) =>
        set((state) => ({
          liveSessions: state.liveSessions.map((s) => s.id === id ? { ...s, ...updates } : s),
        })),
      deleteLiveSession: (id) =>
        set((state) => ({
          liveSessions: state.liveSessions.filter((s) => s.id !== id),
        })),
      clearLiveSessions: () => set({ liveSessions: [] }),

      // Chat actions
      createChatSession: (provider, model) => {
        const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const session: ChatSession = {
          id,
          title: 'New Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          provider,
          model,
        }
        set((state) => ({
          // Prepend new session and enforce MAX_CHAT_SESSIONS cap — oldest sessions are trimmed
          chatSessions: [session, ...state.chatSessions].slice(0, MAX_CHAT_SESSIONS),
          activeChatSessionId: id,
        }))
        return id
      },
      deleteChatSession: (id) =>
        set((state) => ({
          chatSessions: state.chatSessions.filter((s) => s.id !== id),
          activeChatSessionId: state.activeChatSessionId === id ? null : state.activeChatSessionId,
        })),
      setActiveChatSession: (id) => set({ activeChatSessionId: id }),
      addChatMessage: (sessionId, message) =>
        set((state) => ({
          chatSessions: state.chatSessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
              : s
          ),
        })),
      updateChatMessage: (sessionId, messageId, updates) =>
        set((state) => ({
          chatSessions: state.chatSessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
                  updatedAt: Date.now(),
                }
              : s
          ),
        })),
      clearChatSession: (sessionId) =>
        set((state) => ({
          chatSessions: state.chatSessions.map((s) =>
            s.id === sessionId ? { ...s, messages: [], updatedAt: Date.now() } : s
          ),
        })),
      setChatSystemPrompt: (prompt) => set({ chatSystemPrompt: prompt }),

      // System prompt presets
      addSystemPromptPreset: (preset) => {
        const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const newPreset: SystemPromptPreset = { ...preset, id }
        set((state) => {
          // If this new preset is default, clear default from others
          const presets = preset.isDefault
            ? state.systemPromptPresets.map((p) => ({ ...p, isDefault: false }))
            : [...state.systemPromptPresets]
          presets.push(newPreset)
          const updates: Partial<typeof state> = { systemPromptPresets: presets }
          if (preset.isDefault) updates.chatSystemPrompt = preset.content
          return updates
        })
        return id
      },
      updateSystemPromptPreset: (id, updates) =>
        set((state) => {
          const presets = state.systemPromptPresets.map((p) => {
            if (p.id !== id) {
              // If the update sets isDefault true, clear others
              return updates.isDefault ? { ...p, isDefault: false } : p
            }
            return { ...p, ...updates }
          })
          const updated = presets.find((p) => p.id === id)
          const extra: Partial<typeof state> = { systemPromptPresets: presets }
          if (updated?.isDefault) extra.chatSystemPrompt = updated.content
          return extra
        }),
      deleteSystemPromptPreset: (id) =>
        set((state) => ({
          systemPromptPresets: state.systemPromptPresets.filter((p) => p.id !== id),
          // Clear system prompt if this was the default
          chatSystemPrompt: state.systemPromptPresets.find((p) => p.id === id)?.isDefault
            ? ''
            : state.chatSystemPrompt,
        })),
      setDefaultSystemPromptPreset: (id) =>
        set((state) => ({
          systemPromptPresets: state.systemPromptPresets.map((p) => ({ ...p, isDefault: p.id === id })),
          chatSystemPrompt: id
            ? (state.systemPromptPresets.find((p) => p.id === id)?.content ?? state.chatSystemPrompt)
            : state.chatSystemPrompt,
        })),
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
