import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useAppStore } from '../useAppStore'

// Reset relevant store slices before each test
beforeEach(() => {
  act(() => {
    useAppStore.setState({
      history: [],
      chatSessions: [],
      liveSessions: [],
      systemPromptPresets: [],
      activeChatSessionId: null,
      chatSystemPrompt: '',
      sourceText: '',
      translatedText: '',
      phoneticText: '',
      translateError: null,
    })
  })
})

// ─── Translation History ───────────────────────────────────────────────────────
describe('Translation History', () => {
  it('adds a history item', () => {
    const item = {
      id: 'test-1',
      timestamp: Date.now(),
      provider: 'gemini' as const,
      model: 'gemini-2.0-flash',
      sourceLang: 'auto',
      targetLang: 'vi',
      sourceText: 'Hello',
      translatedText: 'Xin chào',
    }
    act(() => useAppStore.getState().addHistory(item))
    const { history } = useAppStore.getState()
    expect(history).toHaveLength(1)
    expect(history[0].sourceText).toBe('Hello')
    expect(history[0].translatedText).toBe('Xin chào')
  })

  it('prepends new items (newest first)', () => {
    act(() => {
      useAppStore.getState().addHistory({ id: '1', timestamp: 100, provider: 'gemini', model: 'm', sourceLang: 'auto', targetLang: 'vi', sourceText: 'First', translatedText: 'A' })
      useAppStore.getState().addHistory({ id: '2', timestamp: 200, provider: 'gemini', model: 'm', sourceLang: 'auto', targetLang: 'vi', sourceText: 'Second', translatedText: 'B' })
    })
    expect(useAppStore.getState().history[0].sourceText).toBe('Second')
    expect(useAppStore.getState().history[1].sourceText).toBe('First')
  })

  it('limits history to MAX_HISTORY (100)', () => {
    act(() => {
      for (let i = 0; i < 105; i++) {
        useAppStore.getState().addHistory({
          id: String(i), timestamp: i, provider: 'gemini', model: 'm',
          sourceLang: 'auto', targetLang: 'vi',
          sourceText: `text ${i}`, translatedText: `dịch ${i}`,
        })
      }
    })
    expect(useAppStore.getState().history).toHaveLength(100)
  })

  it('deletes history item by id', () => {
    act(() => {
      useAppStore.getState().addHistory({ id: 'abc', timestamp: 1, provider: 'openai', model: 'gpt-4o', sourceLang: 'en', targetLang: 'vi', sourceText: 'Test', translatedText: 'Thử' })
      useAppStore.getState().deleteHistoryItem('abc')
    })
    expect(useAppStore.getState().history).toHaveLength(0)
  })

  it('clears all history', () => {
    act(() => {
      useAppStore.getState().addHistory({ id: '1', timestamp: 1, provider: 'gemini', model: 'm', sourceLang: 'en', targetLang: 'vi', sourceText: 'a', translatedText: 'b' })
      useAppStore.getState().clearHistory()
    })
    expect(useAppStore.getState().history).toHaveLength(0)
  })
})

// ─── swapLanguages ─────────────────────────────────────────────────────────────
describe('swapLanguages', () => {
  it('swaps source and target languages', () => {
    act(() => {
      useAppStore.setState({ sourceLang: 'en', targetLang: 'vi', sourceText: 'Hello', translatedText: 'Xin chào' })
      useAppStore.getState().swapLanguages()
    })
    const state = useAppStore.getState()
    expect(state.sourceLang).toBe('vi')
    expect(state.targetLang).toBe('en')
    expect(state.sourceText).toBe('Xin chào')
    expect(state.translatedText).toBe('Hello')
    expect(state.phoneticText).toBe('')
  })

  it('falls back to "ja" when sourceLang is "auto"', () => {
    act(() => {
      useAppStore.setState({ sourceLang: 'auto', targetLang: 'vi', sourceText: 'test', translatedText: 'kiểm tra' })
      useAppStore.getState().swapLanguages()
    })
    const state = useAppStore.getState()
    expect(state.sourceLang).toBe('vi')
    expect(state.targetLang).toBe('ja') // falls back to 'ja', not 'auto'
  })
})

// ─── Chat Sessions ─────────────────────────────────────────────────────────────
describe('Chat Sessions', () => {
  it('creates a new chat session and sets it as active', () => {
    let id: string
    act(() => {
      id = useAppStore.getState().createChatSession('gemini', 'gemini-2.0-flash')
    })
    const { chatSessions, activeChatSessionId } = useAppStore.getState()
    expect(chatSessions).toHaveLength(1)
    expect(chatSessions[0].provider).toBe('gemini')
    expect(chatSessions[0].model).toBe('gemini-2.0-flash')
    expect(chatSessions[0].messages).toHaveLength(0)
    expect(activeChatSessionId).toBe(id!)
  })

  it('adds a message to a session', () => {
    let sessionId: string
    act(() => {
      sessionId = useAppStore.getState().createChatSession('openai', 'gpt-4o')
      useAppStore.getState().addChatMessage(sessionId, {
        id: 'msg1',
        role: 'user',
        content: [{ type: 'text', text: 'Hello AI' }],
        timestamp: Date.now(),
      })
    })
    const session = useAppStore.getState().chatSessions.find(s => s.id === sessionId!)
    expect(session?.messages).toHaveLength(1)
    expect(session?.messages[0].content[0].text).toBe('Hello AI')
  })

  it('updates a message', () => {
    let sessionId: string
    act(() => {
      sessionId = useAppStore.getState().createChatSession('claude', 'claude-3-5-haiku-20241022')
      useAppStore.getState().addChatMessage(sessionId, {
        id: 'msg1', role: 'assistant',
        content: [{ type: 'text', text: '' }],
        timestamp: Date.now(),
        isLoading: true,
      })
      useAppStore.getState().updateChatMessage(sessionId, 'msg1', {
        content: [{ type: 'text', text: 'Hi there!' }],
        isLoading: false,
      })
    })
    const session = useAppStore.getState().chatSessions.find(s => s.id === sessionId!)
    expect(session?.messages[0].content[0].text).toBe('Hi there!')
    expect(session?.messages[0].isLoading).toBe(false)
  })

  it('deletes a chat session and clears activeChatSessionId', () => {
    let sessionId: string
    act(() => {
      sessionId = useAppStore.getState().createChatSession('gemini', 'gemini-2.0-flash')
      useAppStore.getState().deleteChatSession(sessionId)
    })
    expect(useAppStore.getState().chatSessions).toHaveLength(0)
    expect(useAppStore.getState().activeChatSessionId).toBeNull()
  })

  it('clears all messages in a session', () => {
    let sessionId: string
    act(() => {
      sessionId = useAppStore.getState().createChatSession('openai', 'gpt-4o')
      useAppStore.getState().addChatMessage(sessionId, {
        id: 'msg1', role: 'user',
        content: [{ type: 'text', text: 'Hi' }],
        timestamp: Date.now(),
      })
      useAppStore.getState().clearChatSession(sessionId)
    })
    const session = useAppStore.getState().chatSessions.find(s => s.id === sessionId!)
    expect(session?.messages).toHaveLength(0)
  })
})

// ─── System Prompt Presets ─────────────────────────────────────────────────────
describe('System Prompt Presets', () => {
  it('adds a preset', () => {
    act(() => {
      useAppStore.getState().addSystemPromptPreset({
        name: 'Formal Translator',
        content: 'You are a formal translator.',
      })
    })
    const { systemPromptPresets } = useAppStore.getState()
    expect(systemPromptPresets).toHaveLength(1)
    expect(systemPromptPresets[0].name).toBe('Formal Translator')
    expect(systemPromptPresets[0].id).toBeTruthy()
  })

  it('sets chatSystemPrompt when adding a default preset', () => {
    act(() => {
      useAppStore.getState().addSystemPromptPreset({
        name: 'Default',
        content: 'Be concise.',
        isDefault: true,
      })
    })
    expect(useAppStore.getState().chatSystemPrompt).toBe('Be concise.')
  })

  it('clears other presets isDefault when new default is added', () => {
    act(() => {
      useAppStore.getState().addSystemPromptPreset({ name: 'A', content: 'Content A', isDefault: true })
      useAppStore.getState().addSystemPromptPreset({ name: 'B', content: 'Content B', isDefault: true })
    })
    const { systemPromptPresets } = useAppStore.getState()
    const defaultPresets = systemPromptPresets.filter(p => p.isDefault)
    expect(defaultPresets).toHaveLength(1)
    expect(defaultPresets[0].name).toBe('B')
  })

  it('deletes a preset', () => {
    let id: string
    act(() => {
      id = useAppStore.getState().addSystemPromptPreset({ name: 'ToDelete', content: 'Content' })
      useAppStore.getState().deleteSystemPromptPreset(id)
    })
    expect(useAppStore.getState().systemPromptPresets).toHaveLength(0)
  })

  it('clears chatSystemPrompt when deleting the default preset', () => {
    let id: string
    act(() => {
      id = useAppStore.getState().addSystemPromptPreset({ name: 'Default', content: 'My prompt', isDefault: true })
    })
    expect(useAppStore.getState().chatSystemPrompt).toBe('My prompt')
    act(() => {
      useAppStore.getState().deleteSystemPromptPreset(id)
    })
    expect(useAppStore.getState().chatSystemPrompt).toBe('')
  })

  it('updates preset name and content', () => {
    let id: string
    act(() => {
      id = useAppStore.getState().addSystemPromptPreset({ name: 'Old Name', content: 'Old content' })
      useAppStore.getState().updateSystemPromptPreset(id, { name: 'New Name', content: 'New content' })
    })
    const preset = useAppStore.getState().systemPromptPresets.find(p => p.id === id)
    expect(preset?.name).toBe('New Name')
    expect(preset?.content).toBe('New content')
  })
})

// ─── clearTranslation ─────────────────────────────────────────────────────────
describe('clearTranslation', () => {
  it('clears source, translated, phonetic text and error', () => {
    act(() => {
      useAppStore.setState({
        sourceText: 'Hello',
        translatedText: 'Xin chào',
        phoneticText: 'sin chow',
        translateError: 'Some error',
      })
      useAppStore.getState().clearTranslation()
    })
    const state = useAppStore.getState()
    expect(state.sourceText).toBe('')
    expect(state.translatedText).toBe('')
    expect(state.phoneticText).toBe('')
    expect(state.translateError).toBeNull()
  })
})
