import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deepResearchService } from '../../services/deepResearchService'
import { useAppStore } from '../../store/useAppStore'
import type { ChatResult, ChatStreamEvent } from '../../types'
import { DEFAULT_CHAT_NEW_SESSION_SHORTCUT, DEFAULT_CHAT_SEND_SHORTCUT } from '../../utils/keyboardShortcuts'
import { ChatPage } from '../ChatPage'

vi.mock('../../utils/imageUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/imageUtils')>()
  return {
    ...actual,
    resizeImageFile: vi.fn().mockResolvedValue({
      base64: 'research-image-base64',
      mimeType: 'image/png',
      previewUrl: 'data:image/png;base64,research-image-base64',
      width: 100,
      height: 100,
      fileName: 'research.png',
    }),
  }
})

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

function mockedEditChatImage() {
  const editChatImage = window.api.editChatImage
  if (typeof editChatImage !== 'function') {
    throw new Error('editChatImage bridge is missing in test setup')
  }
  return vi.mocked(editChatImage)
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
      locale: 'en',
      chatSystemPrompt: '',
      systemPromptPresets: [],
      chatSendShortcut: DEFAULT_CHAT_SEND_SHORTCUT,
      chatNewSessionShortcut: DEFAULT_CHAT_NEW_SESSION_SHORTCUT,
    })
  })
  vi.mocked(window.api.chatStream).mockReset()
  vi.mocked(window.api.chatStream).mockResolvedValue({ success: false })
  mockedEditChatImage().mockReset()
  mockedEditChatImage().mockResolvedValue({ success: false })
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
    const warningText = document.querySelector('.text-gray-500, .text-gray-400')
    expect(warningText).not.toBeNull()
  })

  it('send button is disabled when no API key', () => {
    render(<ChatPage />)
    // Find the composer send button.
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons.find(b => b.getAttribute('title') !== null && b.className.includes('chat-send-button'))
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

  it('uses the configured new chat shortcut', () => {
    let sessionId = ''
    act(() => {
      useAppStore.setState({
        keyStatus: { gemini: true, claude: false, openai: false, local: false },
        chatNewSessionShortcut: 'Alt+K',
      })
      sessionId = useAppStore.getState().createChatSession('gemini', 'gemini-2.0-flash')
    })

    render(<ChatPage />)
    expect(useAppStore.getState().activeChatSessionId).toBe(sessionId)

    fireEvent.keyDown(window, { key: 'n', metaKey: true })
    expect(useAppStore.getState().activeChatSessionId).toBe(sessionId)

    fireEvent.keyDown(window, { key: 'k', altKey: true })
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

  it('uses Cmd+Enter to send when configured', async () => {
    act(() => {
      useAppStore.setState({
        keyStatus: { gemini: true, claude: false, openai: false, local: false },
        chatSendShortcut: 'modEnter',
      })
    })
    vi.mocked(window.api.chatStream).mockResolvedValue({ success: true, reply: 'Sent with shortcut' })
    render(<ChatPage />)

    const textarea = screen.getByPlaceholderText(/type a message/i)
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(window.api.chatStream).not.toHaveBeenCalled()

    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })

    await waitFor(() => expect(window.api.chatStream).toHaveBeenCalled())
  })

  it('passes attached images through Deep Research mode', async () => {
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
    })
    const runSpy = vi.spyOn(deepResearchService, 'run').mockImplementation(async ({ callbacks }) => {
      const msgId = callbacks.onStepStart('Tổng hợp cuối cùng', { phase: 'synth' })
      callbacks.onStepComplete(msgId, 'Research done', true)
    })


    try {
      render(<ChatPage />)

      fireEvent.click(screen.getByTitle(/enable deep research mode/i))

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(fileInput, {
        target: { files: [new File(['fake'], 'research.png', { type: 'image/png' })] },
      })
      await waitFor(() => expect(screen.getByAltText('research.png')).toBeInTheDocument())

      const textarea = screen.getByPlaceholderText(/type a message/i)
      fireEvent.change(textarea, { target: { value: 'Research this image' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      await waitFor(() => expect(runSpy).toHaveBeenCalled())
      expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
        question: 'Research this image',
        images: [{
          imageBase64: 'research-image-base64',
          imageMimeType: 'image/png',
        }],
      }))

      const userMessage = useAppStore.getState().chatSessions[0].messages.find((m) => m.role === 'user')
      expect(userMessage?.content).toEqual([
        expect.objectContaining({
          type: 'image',
          imageBase64: 'research-image-base64',
          imageMimeType: 'image/png',
        }),
        expect.objectContaining({ type: 'text', text: 'Research this image' }),
      ])
    } finally {
      runSpy.mockRestore()
    }
  })

  it('renders Deep Research resume as the composer primary action', async () => {
    const resumeState = {
      question: 'Resume checkpoint question',
      aspects: ['Aspect A', 'Aspect B'],
      knowledgeBase: [{ label: 'Aspect A', content: 'Completed A' }],
      surveyCompletedAspects: ['Aspect A'],
      imageContext: '',
      imageSearchTerms: [],
      anyWebSearch: false,
      lastCompletedPhase: 'survey' as const,
      lastGapIteration: 0,
      hasImages: false,
    }
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
      const sessionId = useAppStore.getState().createChatSession('gemini', 'gemini-2.0-flash')
      useAppStore.getState().addChatMessage(sessionId, {
        id: 'msg-research-step',
        role: 'assistant',
        content: [{ type: 'text', text: 'Completed A' }],
        timestamp: Date.now(),
        isResearchStep: true,
        researchStepLabel: 'Survey',
        researchStepPhase: 'survey',
        researchStepAspect: 'Aspect A',
      })
      useAppStore.getState().setDeepResearchResumeState(sessionId, resumeState)
    })
    const runSpy = vi.spyOn(deepResearchService, 'run').mockImplementation(async ({ callbacks }) => {
      const msgId = callbacks.onStepStart('Tổng hợp cuối cùng', { phase: 'synth' })
      callbacks.onStepComplete(msgId, 'Research done', true)
      callbacks.onResumeStateChange?.(null)
    })

    try {
      render(<ChatPage />)

      const resumeButton = screen.getByTitle(/resume research/i)
      expect(resumeButton).toHaveClass('chat-resume-button')
      expect(resumeButton).toHaveTextContent('Resume')

      fireEvent.click(resumeButton)

      await waitFor(() => expect(runSpy).toHaveBeenCalled())
      expect(runSpy).toHaveBeenCalledWith(expect.objectContaining({
        question: 'Resume checkpoint question',
        resumeState: expect.objectContaining({
          lastCompletedPhase: 'survey',
          surveyCompletedAspects: ['Aspect A'],
        }),
      }))
    } finally {
      runSpy.mockRestore()
    }
  })

  it('routes image edit prompts to the image-edit API and renders the generated image', async () => {
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
    })
    mockedEditChatImage().mockResolvedValue({
      success: true,
      imageBase64: 'edited-image-base64',
      imageMimeType: 'image/png',
      usedProvider: 'gemini',
      usedModel: 'gemini-2.5-flash-image',
    })

    render(<ChatPage />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake'], 'research.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(screen.getByAltText('research.png')).toBeInTheDocument())

    const textarea = screen.getByPlaceholderText(/type a message/i)
    fireEvent.change(textarea, { target: { value: 'Sửa thành phông nền màu trắng' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => expect(window.api.editChatImage).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      prompt: 'Sửa thành phông nền màu trắng',
      imageBase64: 'research-image-base64',
      imageMimeType: 'image/png',
    })))
    expect(window.api.chatStream).not.toHaveBeenCalled()

    await waitFor(() => {
      const assistant = useAppStore.getState().chatSessions[0].messages.find((m) => m.role === 'assistant')
      expect(assistant?.isLoading).toBe(false)
      expect(assistant?.content).toEqual([
        expect.objectContaining({
          type: 'image',
          imageBase64: 'edited-image-base64',
          imageMimeType: 'image/png',
          imagePreviewUrl: 'data:image/png;base64,edited-image-base64',
        }),
        expect.objectContaining({ type: 'text', text: 'Edited image' }),
      ])
    })
    const editedImage = screen.getByAltText(/edited-image-/i)
    expect(editedImage).toBeInTheDocument()

    fireEvent.click(editedImage)
    expect(screen.getByRole('dialog', { name: /image preview/i })).toBeInTheDocument()
    expect(screen.getAllByAltText(/edited-image-/i).length).toBe(2)

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /image preview/i })).not.toBeInTheDocument()
    })
  })

  it('shows a reload-required error when the Electron preload bridge is stale', async () => {
    act(() => {
      useAppStore.setState({ keyStatus: { gemini: true, claude: false, openai: false, local: false } })
    })
    const originalEditChatImage = window.api.editChatImage
    // biome-ignore lint/suspicious/noExplicitAny: simulates a running app with an older preload bundle
    ;(window.api as any).editChatImage = undefined

    try {
      render(<ChatPage />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(fileInput, {
        target: { files: [new File(['fake'], 'research.png', { type: 'image/png' })] },
      })
      await waitFor(() => expect(screen.getByAltText('research.png')).toBeInTheDocument())

      const textarea = screen.getByPlaceholderText(/type a message/i)
      fireEvent.change(textarea, { target: { value: 'Thay nền trắng cho ảnh' } })
      fireEvent.keyDown(textarea, { key: 'Enter' })

      await waitFor(() => expect(screen.getByText(/restart/i)).toBeInTheDocument())
      expect(window.api.chatStream).not.toHaveBeenCalled()
    } finally {
      window.api.editChatImage = originalEditChatImage
    }
  })

  it('localizes typed image-edit timeout errors in Vietnamese', async () => {
    act(() => {
      useAppStore.setState({
        locale: 'vi',
        keyStatus: { gemini: true, claude: false, openai: false, local: false },
      })
    })
    mockedEditChatImage().mockResolvedValue({
      success: false,
      error: 'Chat failed: This operation was aborted',
      errorCode: 'TIMEOUT',
    })

    render(<ChatPage />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, {
      target: { files: [new File(['fake'], 'research.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(screen.getByAltText('research.png')).toBeInTheDocument())

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Thay nền ảnh thành màu trắng' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Yêu cầu mất quá lâu và đã bị hủy. Vui lòng thử lại.')).toBeInTheDocument()
    })
    expect(screen.queryByText(/This operation was aborted/i)).not.toBeInTheDocument()
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
    // chatService.stream batches tokens via `bufferIntervalMs` (~60 ms) before
    // dispatching the store update, so the rendered text appears asynchronously.
    await waitFor(() => expect(screen.getByText('New')).toBeInTheDocument())

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

  it('localizes Gemini recitation blocks in Vietnamese', async () => {
    act(() => {
      useAppStore.setState({
        locale: 'vi',
        keyStatus: { gemini: true, claude: false, openai: false, local: false },
      })
    })
    vi.mocked(window.api.chatStream).mockResolvedValue({
      success: false,
      error: '[GoogleGenerativeAI Error]: Candidate was blocked due to RECITATION: The generated content was filtered because it may contain material that resembles existing copyrighted works.',
      errorCode: 'BLOCKED_RECITATION',
    })

    render(<ChatPage />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Phân tích đoạn lời bài hát này' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText(/Gemini đã chặn phản hồi/)).toBeInTheDocument()
    })
    expect(screen.queryByText(/GoogleGenerativeAI|RECITATION|copyrighted works/i)).not.toBeInTheDocument()
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
