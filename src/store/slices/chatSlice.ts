/**
 * chatSlice — Zustand store slice for Chat Sessions and System Prompt Presets.
 *
 * Manages all chat-related state in isolation so it can be reasoned about,
 * tested, and evolved independently of translation or settings state.
 */
import type { ChatMessage, ChatSession, Provider, SystemPromptPreset, UsageCost } from '../../types'
import { createClientId } from '../../utils/id'
import type { SliceSet } from './sliceTypes'

/**
 * Maximum number of chat sessions to keep in memory and persisted storage.
 * Oldest sessions are removed when the limit is exceeded to prevent
 * unbounded memory growth in long-running usage.
 */
const MAX_CHAT_SESSIONS = 20

export interface ChatSlice {
  // State
  chatSessions: ChatSession[]
  activeChatSessionId: string | null
  chatSystemPrompt: string
  systemPromptPresets: SystemPromptPreset[]

  // Actions
  createChatSession: (provider: Provider, model: string) => string
  deleteChatSession: (id: string) => void
  setActiveChatSession: (id: string | null) => void
  addChatMessage: (sessionId: string, message: ChatMessage) => void
  updateChatMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void
  addChatSessionCost: (sessionId: string, cost: UsageCost) => void
  clearChatSession: (sessionId: string) => void
  setChatSystemPrompt: (prompt: string) => void
  addSystemPromptPreset: (preset: Omit<SystemPromptPreset, 'id'>) => string
  updateSystemPromptPreset: (id: string, updates: Partial<Omit<SystemPromptPreset, 'id'>>) => void
  deleteSystemPromptPreset: (id: string) => void
  setDefaultSystemPromptPreset: (id: string | null) => void
}

export const createChatSlice = (set: SliceSet): ChatSlice => ({
  chatSessions: [],
  activeChatSessionId: null,
  chatSystemPrompt: '',
  systemPromptPresets: [],

  createChatSession: (provider, model) => {
    const id = createClientId('chat')
    const session: ChatSession = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      provider,
      model,
    }
    set((state: ChatSlice) => ({
      // Prepend new session and enforce MAX_CHAT_SESSIONS cap — oldest sessions are trimmed
      chatSessions: [session, ...state.chatSessions].slice(0, MAX_CHAT_SESSIONS),
      activeChatSessionId: id,
    }))
    return id
  },

  deleteChatSession: (id) =>
    set((state: ChatSlice) => ({
      chatSessions: state.chatSessions.filter((s) => s.id !== id),
      activeChatSessionId: state.activeChatSessionId === id ? null : state.activeChatSessionId,
    })),

  setActiveChatSession: (id) => set({ activeChatSessionId: id }),

  addChatMessage: (sessionId, message) =>
    set((state: ChatSlice) => ({
      chatSessions: state.chatSessions.map((s) => {
        if (s.id !== sessionId) return s
        const messages = [...s.messages, message]

        // Auto-generate title from the first user message when session still has default title
        let title = s.title
        if (title === 'New Chat' && message.role === 'user' && s.messages.length === 0) {
          const textContent = message.content.find((c) => c.type === 'text')?.text ?? ''
          if (textContent) {
            title = textContent
              .replace(/\*\*(.+?)\*\*/g, '$1')  // remove **bold**
              .replace(/\*(.+?)\*/g, '$1')        // remove *italic*
              .replace(/#+\s/g, '')               // remove # headings
              .replace(/\n[\s\S]*/g, '')          // first line only
              .trim()
              .slice(0, 60)
              || 'New Chat'
          }
        }

        return { ...s, title, messages, updatedAt: Date.now() }
      }),
    })),

  updateChatMessage: (sessionId, messageId, updates) =>
    set((state: ChatSlice) => ({
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

  addChatSessionCost: (sessionId, cost) =>
    set((state: ChatSlice) => ({
      chatSessions: state.chatSessions.map((s) => {
        if (s.id !== sessionId) return s
        const current = s.cost
        const nextCost: UsageCost = current
          ? {
              ...cost,
              id: current.id,
              amountUsd: current.amountUsd + cost.amountUsd,
              inputTokens: current.inputTokens + cost.inputTokens,
              outputTokens: current.outputTokens + cost.outputTokens,
              totalTokens: current.totalTokens + cost.totalTokens,
              estimated: current.estimated || cost.estimated,
              createdAt: cost.createdAt,
            }
          : cost
        return { ...s, cost: nextCost, updatedAt: Date.now() }
      }),
    })),

  clearChatSession: (sessionId) =>
    set((state: ChatSlice) => ({
      chatSessions: state.chatSessions.map((s) =>
        s.id === sessionId ? { ...s, messages: [], cost: undefined, updatedAt: Date.now() } : s
      ),
    })),

  setChatSystemPrompt: (prompt) => set({ chatSystemPrompt: prompt }),

  addSystemPromptPreset: (preset) => {
    const id = createClientId('preset')
    const newPreset: SystemPromptPreset = { ...preset, id }
    set((state: ChatSlice) => {
      const presets = preset.isDefault
        ? state.systemPromptPresets.map((p) => ({ ...p, isDefault: false }))
        : [...state.systemPromptPresets]
      presets.push(newPreset)
      const updates: Partial<ChatSlice> = { systemPromptPresets: presets }
      if (preset.isDefault) updates.chatSystemPrompt = preset.content
      return updates
    })
    return id
  },

  updateSystemPromptPreset: (id, updates) =>
    set((state: ChatSlice) => {
      const presets = state.systemPromptPresets.map((p) => {
        if (p.id !== id) {
          return updates.isDefault ? { ...p, isDefault: false } : p
        }
        return { ...p, ...updates }
      })
      const updated = presets.find((p) => p.id === id)
      const extra: Partial<ChatSlice> = { systemPromptPresets: presets }
      if (updated?.isDefault) extra.chatSystemPrompt = updated.content
      return extra
    }),

  deleteSystemPromptPreset: (id) =>
    set((state: ChatSlice) => ({
      systemPromptPresets: state.systemPromptPresets.filter((p) => p.id !== id),
      chatSystemPrompt: state.systemPromptPresets.find((p) => p.id === id)?.isDefault
        ? ''
        : state.chatSystemPrompt,
    })),

  setDefaultSystemPromptPreset: (id) =>
    set((state: ChatSlice) => ({
      systemPromptPresets: state.systemPromptPresets.map((p) => ({ ...p, isDefault: p.id === id })),
      chatSystemPrompt: id
        ? (state.systemPromptPresets.find((p) => p.id === id)?.content ?? state.chatSystemPrompt)
        : state.chatSystemPrompt,
    })),

})

