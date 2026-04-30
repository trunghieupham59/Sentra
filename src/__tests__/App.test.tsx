import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useAppStore } from '../store/useAppStore'
import type { QuickChatSeedPayload } from '../types'

describe('App quick chat bridge', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState({
        activePage: 'translate',
        settingsOpen: false,
        chatSessions: [],
        activeChatSessionId: null,
        selectedProvider: 'local',
        keyStatus: { gemini: false, claude: false, openai: false, local: false },
      })
    })
    vi.mocked(window.api.quickChat.onOpenInChat).mockReset()
    vi.mocked(window.api.quickChat.onOpenInChat).mockReturnValue(() => {})
    vi.mocked(window.api.quickChat.onOpenSettings).mockReset()
    vi.mocked(window.api.quickChat.onOpenSettings).mockReturnValue(() => {})
  })

  it('opens the main chat with a seeded quick chat conversation', async () => {
    let openInChat: ((payload: QuickChatSeedPayload | null) => void) | null = null
    vi.mocked(window.api.quickChat.onOpenInChat).mockImplementation((cb) => {
      openInChat = cb
      return vi.fn()
    })

    render(<App />)

    await waitFor(() => expect(window.api.quickChat.onOpenInChat).toHaveBeenCalled())

    act(() => {
      openInChat?.({
        provider: 'local',
        model: 'local-auto',
        question: 'Summarize this release',
        response: 'Release summary is ready.',
      })
    })

    const state = useAppStore.getState()
    expect(state.activePage).toBe('chat')
    expect(state.chatSessions).toHaveLength(1)
    expect(state.activeChatSessionId).toBe(state.chatSessions[0].id)
    expect(state.chatSessions[0].provider).toBe('local')
    expect(state.chatSessions[0].model).toBe('local-auto')
    expect(state.chatSessions[0].messages).toMatchObject([
      { role: 'user', content: [{ type: 'text', text: 'Summarize this release' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Release summary is ready.' }] },
    ])
  })
})
