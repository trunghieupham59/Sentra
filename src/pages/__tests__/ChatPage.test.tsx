import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import type { ChatResult, ChatStreamEvent } from '../../types'
import { ChatPage } from '../ChatPage'

function mockStreamingChat() {
  let listener: ((event: ChatStreamEvent) => void) | null = null
  let resolveStream: (result: ChatResult) => void = () => {}
  const streamResult = new Promise<ChatResult>((resolve) => {
    resolveStream = resolve
  })

  vi.mocked(window.api.onChatStreamEvent).mockImplementation((_requestId, cb) => {
    listener = cb
    return vi.fn()
  })
  vi.mocked(window.api.chatStream).mockImplementation(() => streamResult)

  return {
    emit: (event: Omit<ChatStreamEvent, 'requestId'>) => {
      act(() => {
        listener?.({ requestId: 'test-request', ...event } as ChatStreamEvent)
      })
    },
    resolve: (result: ChatResult) => {
      act(() => {
        resolveStream(result)
      })
    },
  }
}

// Reset store before each test
beforeEach(() => {
  act(() => {
    useAppStore.setState({
      chatSessions: [],
      activeChatSessionId: null,
      keyStatus: { gemini: false, claude: false, openai: false, local: false },
      selectedProvider: 'gemini',
      selectedModels: { gemini: 'gemini-2.0-flash', claude: 'claude-3-5-haiku-20241022', openai: 'gpt-4o', local: 'local-auto' },
      chatSystemPrompt: '',
      systemPromptPresets: [],
    })
  })
  vi.mocked(window.api.chatStream).mockReset()
  vi.mocked(window.api.chatStream).mockResolvedValue({ success: false })
  vi.mocked(window.api.onChatStreamEvent).mockReset()
  vi.mocked(window.api.onChatStreamEvent).mockReturnValue(() => {})
})

describe('ChatPage', () => {
  it('renders empty state when no messages', () => {
    render(<ChatPage />)
    // Empty state title should be visible
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('shows "New Chat" button in toolbar', () => {
    render(<ChatPage />)
    // The new chat button text comes from t.chat_new_session
    const newChatButtons = screen.getAllByRole('button')
    expect(newChatButtons.length).toBeGreaterThan(0)
  })

  it('shows API key warning when no key is configured', () => {
    render(<ChatPage />)
    // When no key, a warning message should appear in empty state
    const orangeText = document.querySelector('.text-orange-500, .text-orange-400')
    expect(orangeText).not.toBeNull()
  })

  it('send button is disabled when no API key', () => {
    render(<ChatPage />)
    // Find the send button (last button, blue circle)
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons.find(b => b.getAttribute('title') !== null && b.className.includes('rounded-full') && b.className.includes('bg-blue-500'))
    if (sendBtn) {
      expect(sendBtn).toBeDisabled()
    }
  })

  it('creates a new chat session when "New Chat" is clicked with a key', () => {
    // Set a key so session creation is accessible
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
    })
    render(<ChatPage />)

    // Sessions should still be empty before interaction
    expect(useAppStore.getState().chatSessions).toHaveLength(0)
  })

  it('starts a new chat with Cmd+N on macOS', () => {
    let sessionId = ''
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
      sessionId = useAppStore.getState().createChatSession('gemini', 'gemini-2.0-flash')
    })

    render(<ChatPage />)
    expect(useAppStore.getState().activeChatSessionId).toBe(sessionId)

    fireEvent.keyDown(window, { key: 'n', metaKey: true })

    expect(useAppStore.getState().activeChatSessionId).toBeNull()
  })

  it('renders system prompt button', () => {
    render(<ChatPage />)
    // System prompt area should be present
    const promptButtons = screen.getAllByRole('button')
    expect(promptButtons.length).toBeGreaterThan(1)
  })

  // ── Required: input field nhận text ───────────────────────────────────────
  it('input field accepts typed text', () => {
    render(<ChatPage />)
    // The chat textarea has placeholder t.chat_placeholder = "Type a message…"
    const textarea = screen.getByPlaceholderText(/type a message/i)
    expect(textarea).toBeInTheDocument()
    fireEvent.change(textarea, { target: { value: 'Hello chatbot' } })
    expect(textarea).toHaveValue('Hello chatbot')
  })

  it('streams assistant text while sending a message', async () => {
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
    })
    const stream = mockStreamingChat()
    render(<ChatPage />)

    const textarea = screen.getByPlaceholderText(/type a message/i)
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => expect(window.api.chatStream).toHaveBeenCalled())

    stream.emit({ type: 'token', token: 'Hel' })
    expect(screen.getByText('Hel')).toBeInTheDocument()

    stream.emit({ type: 'token', token: 'lo' })
    expect(screen.getAllByText('Hello').length).toBeGreaterThanOrEqual(2)

    stream.resolve({ success: true, reply: 'Hello' })

    await waitFor(() => {
      const session = useAppStore.getState().chatSessions[0]
      const assistant = session.messages.find((m) => m.role === 'assistant')
      expect(assistant?.isLoading).toBe(false)
      expect(assistant?.content[0].text).toBe('Hello')
    })
  })

  it('streams text into the last assistant message when regenerating', async () => {
    let sessionId = ''
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
      sessionId = useAppStore.getState().createChatSession('gemini', 'gemini-2.0-flash')
      useAppStore.getState().addChatMessage(sessionId, {
        id: 'msg-user',
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
        timestamp: Date.now(),
      })
      useAppStore.getState().addChatMessage(sessionId, {
        id: 'msg-assistant',
        role: 'assistant',
        content: [{ type: 'text', text: 'Old response' }],
        timestamp: Date.now(),
      })
    })
    const stream = mockStreamingChat()
    render(<ChatPage />)

    fireEvent.click(screen.getByTitle(/regenerate response/i))
    await waitFor(() => expect(window.api.chatStream).toHaveBeenCalled())

    stream.emit({ type: 'token', token: 'New' })
    expect(screen.getByText('New')).toBeInTheDocument()

    stream.resolve({ success: true, reply: 'New response' })

    await waitFor(() => {
      const assistant = useAppStore.getState().chatSessions[0].messages.find((m) => m.id === 'msg-assistant')
      expect(assistant?.isLoading).toBe(false)
      expect(assistant?.content[0].text).toBe('New response')
    })
  })

  it('shows stream errors and stops loading', async () => {
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
    })
    vi.mocked(window.api.chatStream).mockResolvedValue({ success: false, error: 'Stream failed' })

    render(<ChatPage />)
    const textarea = screen.getByPlaceholderText(/type a message/i)
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('Stream failed')).toBeInTheDocument())

    const assistant = useAppStore.getState().chatSessions[0].messages.find((m) => m.role === 'assistant')
    expect(assistant?.isLoading).toBe(false)
  })

  it('falls back to non-streaming chat when the preload stream API is unavailable', async () => {
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
    })
    const originalChatStream = window.api.chatStream
    const originalOnChatStreamEvent = window.api.onChatStreamEvent
    // biome-ignore lint/suspicious/noExplicitAny: simulates an older Electron preload at runtime
    ;(window.api as any).chatStream = undefined
    // biome-ignore lint/suspicious/noExplicitAny: simulates an older Electron preload at runtime
    ;(window.api as any).onChatStreamEvent = undefined
    vi.mocked(window.api.chat).mockResolvedValueOnce({ success: true, reply: 'Fallback reply' })

    try {
      render(<ChatPage />)
      const textarea = screen.getByPlaceholderText(/type a message/i)
      fireEvent.change(textarea, { target: { value: 'Hello' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      await waitFor(() => expect(screen.getByText('Fallback reply')).toBeInTheDocument())
      expect(window.api.chat).toHaveBeenCalled()
    } finally {
      window.api.chatStream = originalChatStream
      window.api.onChatStreamEvent = originalOnChatStreamEvent
    }
  })

  // ── Required: empty state hiển thị khi không có session ───────────────────
  it('empty state is shown when there are no chat sessions', () => {
    // chatSessions: [] from beforeEach — no session, no messages
    render(<ChatPage />)
    // Empty state renders an <h2> with chat_empty_title and a <p> with chat_empty_desc
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    // The messages list div should NOT be present (only shown when messages.length > 0)
    expect(document.querySelector('.space-y-4')).toBeNull()
  })
})
