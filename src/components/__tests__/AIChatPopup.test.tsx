import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import type { ChatResult, ChatStreamEvent } from '../../types'
import { AIChatPopup } from '../AIChatPopup'

function mockStreamingChat() {
  let listener: ((event: ChatStreamEvent) => void) | null = null

  vi.mocked(window.api.onChatStreamEvent).mockImplementation((_requestId, cb) => {
    listener = cb
    return vi.fn()
  })
  vi.mocked(window.api.chatStream).mockImplementation(async () => {
    listener?.({ requestId: 'quick-chat-test', type: 'token', token: 'Hello' })
    listener?.({ requestId: 'quick-chat-test', type: 'token', token: ' there' })
    listener?.({ requestId: 'quick-chat-test', type: 'end', reply: 'Hello there' })
    return { success: true, reply: 'Hello there' } satisfies ChatResult
  })
}

beforeEach(() => {
  act(() => {
    useAppStore.setState({
      selectedProvider: 'local',
      selectedModels: { gemini: 'gemini-2.0-flash', claude: 'claude-3-5-haiku-20241022', openai: 'gpt-4o', local: 'local-auto' },
      keyStatus: { gemini: false, claude: false, openai: false, local: true },
      chatSystemPrompt: '',
      locale: 'en',
    })
  })
  vi.mocked(window.api.chatStream).mockReset()
  vi.mocked(window.api.chatStream).mockResolvedValue({ success: false })
  vi.mocked(window.api.onChatStreamEvent).mockReset()
  vi.mocked(window.api.onChatStreamEvent).mockReturnValue(() => {})
  vi.mocked(window.api.quickChat.openInChat).mockClear()
  vi.mocked(window.api.quickChat.openSettings).mockClear()
  vi.mocked(window.api.keychain.hasKey).mockResolvedValue({ exists: false })
  window.api.platform = 'darwin'
})

describe('AIChatPopup quick window', () => {
  it('focuses the input when mounted', async () => {
    render(<AIChatPopup />)

    const input = screen.getByRole('textbox')
    await waitFor(() => expect(document.activeElement).toBe(input))
  })

  it('streams the answer inline when Enter sends the question', async () => {
    mockStreamingChat()
    render(<AIChatPopup />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Say hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(window.api.chatStream).toHaveBeenCalled())
    expect(await screen.findByText('Hello there')).toBeInTheDocument()
  })

  it('localizes provider content blocks instead of showing raw SDK errors', async () => {
    vi.mocked(window.api.chatStream).mockResolvedValue({
      success: false,
      error: '[GoogleGenerativeAI Error]: Candidate was blocked due to RECITATION',
      errorCode: 'BLOCKED_RECITATION',
    })

    render(<AIChatPopup />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Analyze these lyrics' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByText(/Gemini blocked this response/)).toBeInTheDocument()
    expect(screen.queryByText(/GoogleGenerativeAI|RECITATION/i)).not.toBeInTheDocument()
  })

  it('does not send on Shift+Enter', () => {
    render(<AIChatPopup />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Line one' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(window.api.chatStream).not.toHaveBeenCalled()
  })

  it('disables send and opens settings when the provider has no key', async () => {
    act(() => {
      useAppStore.setState({
        selectedProvider: 'gemini',
        keyStatus: { gemini: false, claude: false, openai: false, local: true },
      })
    })
    render(<AIChatPopup />)

    expect(await screen.findByText('No API key configured. Go to Settings to add one.')).toBeInTheDocument()
    const sendButton = screen.getByTitle('Send')
    expect(sendButton).toBeDisabled()

    fireEvent.click(screen.getByText('Open Settings'))
    expect(window.api.quickChat.openSettings).toHaveBeenCalled()
  })

  it('sends the current Q&A payload when opening full Chat', async () => {
    mockStreamingChat()
    render(<AIChatPopup />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Carry this' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText('Hello there')

    fireEvent.click(screen.getByText('Open in Chat'))

    expect(window.api.quickChat.openInChat).toHaveBeenCalledWith({
      question: 'Carry this',
      response: 'Hello there',
      provider: 'local',
      model: 'local-auto',
    })
  })

  it('starts a new conversation with Cmd+N on macOS', async () => {
    mockStreamingChat()
    render(<AIChatPopup />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Start over from this' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText('Hello there')

    expect(screen.getByTitle('New conversation (Cmd+N)')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'n', metaKey: true })

    expect(screen.queryByText('Hello there')).not.toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('starts a new conversation with Ctrl+N off macOS', async () => {
    window.api.platform = 'win32'
    mockStreamingChat()
    render(<AIChatPopup />)

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Start over from this' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await screen.findByText('Hello there')

    expect(screen.getByTitle('New conversation (Ctrl+N)')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })

    expect(screen.queryByText('Hello there')).not.toBeInTheDocument()
    expect(input).toHaveValue('')
  })
})
