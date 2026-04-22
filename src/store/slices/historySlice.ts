/**
 * historySlice — Zustand store slice for Translation History and Live Sessions.
 *
 * Manages persisted history of text translations and live-translate sessions
 * independently of chat state and user settings.
 */
import type { StateCreator } from 'zustand'
import type { HistoryItem, LiveSession } from '../../types'

/** Maximum number of translation history entries to keep. */
const MAX_HISTORY = 100

/** Maximum number of live-translate sessions to keep. */
const MAX_LIVE_SESSIONS = 50

export interface HistorySlice {
  // State
  history: HistoryItem[]
  liveSessions: LiveSession[]
  /** ID of the live session currently being viewed (null = not viewing any) */
  viewingLiveSessionId: string | null

  // History actions
  addHistory: (item: HistoryItem) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void

  // Live session actions
  addLiveSession: (session: LiveSession) => void
  updateLiveSession: (id: string, updates: Partial<LiveSession>) => void
  deleteLiveSession: (id: string) => void
  clearLiveSessions: () => void
  setViewingLiveSession: (id: string | null) => void
}

// biome-ignore lint/suspicious/noExplicitAny: StateCreator full-state generic omitted to avoid circular deps — full AppState is assembled in useAppStore.ts
export const createHistorySlice: StateCreator<any, [], [], HistorySlice> = (set) => ({
  history: [],
  liveSessions: [],
  viewingLiveSessionId: null,

  addHistory: (item) =>
    set((state: HistorySlice) => ({
      history: [item, ...state.history].slice(0, MAX_HISTORY),
    })),

  deleteHistoryItem: (id) =>
    set((state: HistorySlice) => ({
      history: state.history.filter((h) => h.id !== id),
    })),

  clearHistory: () => set({ history: [] }),

  addLiveSession: (session) =>
    set((state: HistorySlice) => ({
      liveSessions: [session, ...state.liveSessions].slice(0, MAX_LIVE_SESSIONS),
    })),

  updateLiveSession: (id, updates) =>
    set((state: HistorySlice) => ({
      liveSessions: state.liveSessions.map((s) => s.id === id ? { ...s, ...updates } : s),
    })),

  deleteLiveSession: (id) =>
    set((state: HistorySlice) => ({
      liveSessions: state.liveSessions.filter((s) => s.id !== id),
    })),

  clearLiveSessions: () => set({ liveSessions: [] }),

  setViewingLiveSession: (id) => set({ viewingLiveSessionId: id }),
})
