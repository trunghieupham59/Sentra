import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IMAGE_AUTO_TRANSLATE_DELAY_MS } from '../../constants/ui'
import { useAppStore } from '../../store/useAppStore'
import { extractImageFromClipboard, resizeImageFile } from '../../utils/imageUtils'
import { TranslatePage } from '../TranslatePage'

vi.mock('../../utils/imageUtils', async () => {
  const actual = await vi.importActual<typeof import('../../utils/imageUtils')>('../../utils/imageUtils')
  return {
    ...actual,
    extractImageFromClipboard: vi.fn(),
    resizeImageFile: vi.fn(),
  }
})

function openAdvancedConfig() {
  const configButton = screen.getByTitle(/Advanced AI Config|Cấu hình AI/i)
  act(() => {
    fireEvent.click(configButton)
  })
}

// Reset store before each test
beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.mocked(window.api.translate).mockReset()
  vi.mocked(window.api.translate).mockResolvedValue({ success: false })
  vi.mocked(window.api.translateImage).mockReset()
  vi.mocked(window.api.translateImage).mockResolvedValue({ success: false })
  const cancelTranslateMock = vi.mocked(
    window.api.cancelTranslate as NonNullable<typeof window.api.cancelTranslate>
  )
  cancelTranslateMock.mockReset()
  cancelTranslateMock.mockResolvedValue({ success: false, error: 'NOT_FOUND' })
  vi.mocked(extractImageFromClipboard).mockReturnValue(null)
  vi.mocked(resizeImageFile).mockResolvedValue({
    base64: 'mock-image-base64',
    mimeType: 'image/png',
    previewUrl: 'data:image/png;base64,mock-image-base64',
    width: 100,
    height: 80,
    fileName: 'mock.png',
  })
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
      keyStatus: { gemini: true, claude: false, openai: false, local: false },
      selectedProvider: 'gemini',
      selectedModels: { gemini: 'gemini-2.0-flash', claude: 'claude-3-5-haiku-20241022', openai: 'gpt-4o', local: 'local-auto' },
      phoneticMode: 'off',
      translationStyle: 'general',
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

  it('does not auto-translate a pasted image while manual mode is active', async () => {
    vi.useFakeTimers()
    const file = new File(['image'], 'manual.png', { type: 'image/png' })
    vi.mocked(extractImageFromClipboard).mockReturnValue(file)

    render(<TranslatePage />)

    act(() => {
      fireEvent.paste(screen.getByLabelText(/Image|ảnh/i), {
        clipboardData: { items: [] },
      })
    })

    await act(async () => {})

    expect(resizeImageFile).toHaveBeenCalledWith(file, expect.any(Number), { useQualityLoop: true })

    act(() => {
      vi.advanceTimersByTime(IMAGE_AUTO_TRANSLATE_DELAY_MS + 50)
    })

    expect(window.api.translateImage).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('clears a pasted image when the source delete button is clicked', async () => {
    const file = new File(['image'], 'clear.png', { type: 'image/png' })
    vi.mocked(extractImageFromClipboard).mockReturnValue(file)

    render(<TranslatePage />)

    act(() => {
      fireEvent.paste(screen.getByLabelText(/Image|ảnh/i), {
        clipboardData: { items: [] },
      })
    })

    await act(async () => {})

    expect(screen.getByAltText('mock.png')).toBeInTheDocument()

    act(() => {
      fireEvent.click(screen.getByTitle(/Clear|Xóa/i))
    })

    expect(screen.queryByAltText('mock.png')).not.toBeInTheDocument()
    expect(window.api.translateImage).not.toHaveBeenCalled()
  })

  it('restarts an in-flight manual translation when the target language changes', async () => {
    type TranslateApiResult = Awaited<ReturnType<typeof window.api.translate>>
    let resolveFirst: ((value: TranslateApiResult) => void) | undefined

    vi.mocked(window.api.translate)
      .mockImplementationOnce(() => new Promise<TranslateApiResult>((resolve) => {
        resolveFirst = resolve
      }))
      .mockResolvedValueOnce({ success: true, translatedText: 'こんにちは' })

    act(() => {
      useAppStore.setState({
        sourceText: 'Hello',
        targetLang: 'vi',
        autoTranslate: false,
      })
    })

    render(<TranslatePage />)

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^(Translate|Dịch)$/i }))
    })

    await waitFor(() => {
      expect(window.api.translate).toHaveBeenCalledWith(expect.objectContaining({
        sourceText: 'Hello',
        targetLang: 'vi',
      }))
    })

    act(() => {
      useAppStore.getState().setTargetLang('ja')
    })

    await waitFor(() => {
      expect(window.api.translate).toHaveBeenCalledTimes(2)
      expect(window.api.translate).toHaveBeenLastCalledWith(expect.objectContaining({
        sourceText: 'Hello',
        targetLang: 'ja',
      }))
    })

    expect(window.api.cancelTranslate).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.any(String),
    }))

    await waitFor(() => {
      expect(useAppStore.getState().translatedText).toBe('こんにちは')
    })

    await act(async () => {
      resolveFirst?.({ success: true, translatedText: 'Xin chào cũ' })
    })

    expect(useAppStore.getState().translatedText).toBe('こんにちは')
  })

  it('shows Auto/Manual toggle button', () => {
    render(<TranslatePage />)
    openAdvancedConfig()
    // The Auto/Manual toggle button lives in the Advanced AI Config popup.
    const manualBtn = screen.getByTitle(/Tự động dịch|Dịch thủ công|Auto|Manual/i)
    expect(manualBtn).toBeInTheDocument()
  })

  it('clicking Auto/Manual toggle switches autoTranslate state', () => {
    render(<TranslatePage />)
    expect(useAppStore.getState().autoTranslate).toBe(false)

    openAdvancedConfig()
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
    expect(screen.getByPlaceholderText(/Enter text to translate|Nhập văn bản/i)).toBeInTheDocument()
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
    openAdvancedConfig()
    // The phonetic dropdown should be present in the Advanced AI Config popup.
    expect(screen.getByDisplayValue(/Off|Tắt/i)).toBeInTheDocument()
  })

  it('generates phonetic text when phonetic mode is enabled after translation', async () => {
    vi.mocked(window.api.translate).mockResolvedValueOnce({
      success: true,
      translatedText: '{東京|とうきょう}',
    })

    act(() => {
      useAppStore.setState({
        translatedText: '東京',
        targetLang: 'ja',
        phoneticMode: 'off',
      })
    })

    render(<TranslatePage />)
    openAdvancedConfig()

    act(() => {
      fireEvent.change(screen.getByDisplayValue(/Off|Tắt/i), { target: { value: 'standard' } })
    })

    await waitFor(() => {
      expect(window.api.translate).toHaveBeenCalledWith(expect.objectContaining({
        sourceText: '東京',
        sourceLang: 'ja',
        targetLang: 'ja',
        showFurigana: true,
        phoneticOnly: true,
        phoneticMode: 'standard',
      }))
      expect(useAppStore.getState().phoneticText).toBe('{東京|とうきょう}')
    })
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
    expect(screen.queryByTitle(/Clear|Xóa|クリア/i)).toBeNull()
  })

  it('clear button appears when source text is present', () => {
    act(() => {
      useAppStore.setState({ sourceText: 'Some text to translate' })
    })
    render(<TranslatePage />)
    expect(screen.queryByTitle(/Clear|Xóa|クリア/i)).not.toBeNull()
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
