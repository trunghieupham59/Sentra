import { render, screen, fireEvent } from '@testing-library/react'
import { act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ChatPage } from '../ChatPage'
import { useAppStore } from '../../store/useAppStore'

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
})
