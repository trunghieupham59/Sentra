import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { useAppStore } from '../store/useAppStore'

describe('App AI Chat quick popup', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState({
        selectedProvider: 'local',
        keyStatus: { gemini: false, claude: false, openai: false, local: false },
      })
    })
    vi.mocked(window.api.hotkey.chat.onOpen).mockReset()
    vi.mocked(window.api.hotkey.chat.onOpen).mockReturnValue(() => {})
  })

  it('opens the quick chat popup when the AI Chat hotkey event fires', async () => {
    let openQuickChat: (() => void) | null = null
    vi.mocked(window.api.hotkey.chat.onOpen).mockImplementation((cb) => {
      openQuickChat = cb
      return vi.fn()
    })

    render(<App />)

    await waitFor(() => expect(window.api.hotkey.chat.onOpen).toHaveBeenCalled())

    act(() => {
      openQuickChat?.()
    })

    expect(await screen.findByText(/Ask AI|Hỏi AI|AIに質問/)).toBeInTheDocument()
  })
})
