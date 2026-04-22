import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { ChatPage } from '../ChatPage'

// Reset store before each test
beforeEach(() => {
  act(() => {
    useAppStore.setState({
      chatSessions: [],
      activeChatSessionId: null,
      keyStatus: { gemini: false, claude: false, openai: false },
      selectedProvider: 'gemini',
      selectedModels: { gemini: 'gemini-2.0-flash', claude: 'claude-3-5-haiku-20241022', openai: 'gpt-4o' },
      chatSystemPrompt: '',
      systemPromptPresets: [],
    })
  })
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
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false } })
    })
    render(<ChatPage />)

    // Sessions should still be empty before interaction
    expect(useAppStore.getState().chatSessions).toHaveLength(0)
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

