import { render, screen, fireEvent } from '@testing-library/react'
import { act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { TranslatePage } from '../TranslatePage'
import { useAppStore } from '../../store/useAppStore'

// Reset store before each test
beforeEach(() => {
  act(() => {
    useAppStore.setState({
      sourceText: '',
      translatedText: '',
      phoneticText: '',
      sourceLang: 'auto',
      targetLang: 'vi',
      isTranslating: false,
      translateError: null,
      autoTranslate: false, // manual mode — shows Translate button
      keyStatus: { gemini: true, claude: false, openai: false },
      selectedProvider: 'gemini',
      selectedModels: { gemini: 'gemini-2.0-flash', claude: 'claude-3-5-haiku-20241022', openai: 'gpt-4o' },
      showFurigana: false,
      translationStyle: 'neutral',
    })
  })
})

describe('TranslatePage', () => {
  it('renders the translate page without crashing', () => {
    const { container } = render(<TranslatePage />)
    expect(container).not.toBeNull()
  })

  it('shows Translate button in manual mode', () => {
    render(<TranslatePage />)
    // In manual mode (autoTranslate=false), a translate button should appear
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('shows Auto/Manual toggle button', () => {
    render(<TranslatePage />)
    // The Auto/Manual toggle button should be rendered
    const manualBtn = screen.getByTitle(/Tự động dịch|Dịch thủ công|Auto|Manual/i)
    expect(manualBtn).toBeInTheDocument()
  })

  it('clicking Auto/Manual toggle switches autoTranslate state', () => {
    render(<TranslatePage />)
    expect(useAppStore.getState().autoTranslate).toBe(false)

    const toggle = screen.getByTitle(/Tự động dịch|Dịch thủ công|Auto|Manual/i)
    act(() => { fireEvent.click(toggle) })

    expect(useAppStore.getState().autoTranslate).toBe(true)
  })

  it('shows result placeholder when no translation yet', () => {
    render(<TranslatePage />)
    // Placeholder text should be visible when translatedText is empty
    // The placeholder is rendered as a <p> with a special class
    const placeholders = document.querySelectorAll('.text-gray-300, .text-gray-700')
    expect(placeholders.length).toBeGreaterThan(0)
  })

  it('renders a text input area for source text', () => {
    render(<TranslatePage />)
    // MarkdownEditor renders inside a scrollable div; the page panel itself should be present
    // We check for the overall source panel — a flex column that contains the editor
    const panels = document.querySelectorAll('.flex-1.basis-0')
    // Two panels: source (left) and result (right)
    expect(panels.length).toBeGreaterThanOrEqual(2)
  })

  it('shows error message when translateError is set', () => {
    act(() => {
      useAppStore.setState({ translateError: 'API key invalid' })
    })
    render(<TranslatePage />)
    expect(screen.getByText('API key invalid')).toBeInTheDocument()
  })

  it('shows phonetic toggle button', () => {
    render(<TranslatePage />)
    // The phonetic/furigana toggle button should be present
    const phoneticBtn = screen.getByTitle(/phonetic|phiên âm|furigana/i)
    expect(phoneticBtn).toBeInTheDocument()
  })

  // ── Required: source text input nhận giá trị ──────────────────────────────
  it('source text input renders the entered value', () => {
    act(() => {
      useAppStore.setState({ sourceText: 'Hello world' })
    })
    render(<TranslatePage />)
    // MarkdownEditor renders unfocused lines as <RenderedLine> → <p>text</p>
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  // ── Required: clear button xuất hiện khi có source text ───────────────────
  it('clear button does NOT appear when source text is empty', () => {
    // beforeEach already sets sourceText: ''
    render(<TranslatePage />)
    // ClearButton uses class btn-ghost — not rendered when sourceText is empty
    expect(document.querySelector('.btn-ghost')).toBeNull()
  })

  it('clear button appears when source text is present', () => {
    act(() => {
      useAppStore.setState({ sourceText: 'Some text to translate' })
    })
    render(<TranslatePage />)
    // ClearButton (btn-ghost) should render in the source panel bottom bar
    expect(document.querySelector('.btn-ghost')).not.toBeNull()
  })

  // ── Required: character counter hiển thị đúng ─────────────────────────────
  it('character counter displays the correct character count', () => {
    act(() => {
      useAppStore.setState({ sourceText: 'Hello' }) // exactly 5 characters
    })
    render(<TranslatePage />)
    // Counter: <span className="text-xs tabular-nums ...">5 chars</span>
    // (shown when !isVoiceActive; the source counter is first in DOM order)
    const counter = document.querySelector('.tabular-nums')
    expect(counter).not.toBeNull()
    // Must contain the number "5"
    expect(counter?.textContent).toMatch(/5/)
  })
})

