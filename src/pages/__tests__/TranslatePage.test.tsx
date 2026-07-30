import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRANSLATE_INPUT_WARNING_CHARS } from '../../constants/providers'
import { IMAGE_AUTO_TRANSLATE_DELAY_MS } from '../../constants/ui'
import { TRANSLATIONS } from '../../i18n'
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
  const configButton = screen.getByTitle(/Choose the model|Chọn mô hình|モデル/i)
  act(() => {
    fireEvent.click(configButton)
  })
}

function getSourcePane() {
  return screen.getByRole('region', { name: /Source content|Nội dung gốc|原文/i })
}

function getSourceInput() {
  return screen.getByRole('textbox', { name: /Source content|Nội dung gốc|原文/i })
}

// Reset store before each test
beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.mocked(window.api.translate).mockReset()
  vi.mocked(window.api.translate).mockResolvedValue({ success: false })
  vi.mocked(window.api.translateImage).mockReset()
  vi.mocked(window.api.translateImage).mockResolvedValue({ success: false })
  vi.mocked(window.api.transcribeAudio).mockReset()
  vi.mocked(window.api.transcribeAudio).mockResolvedValue({
    success: false,
    errorCode: 'UNKNOWN',
    retryable: false,
  })
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
      translationReasoningEffort: 'auto',
      locale: 'en',
      localeAuto: false,
      sttProvider: 'auto',
      dynamicModels: {
        ...useAppStore.getState().dynamicModels,
        gemini: [{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '' }],
      },
      modelsLoading: { gemini: false, claude: false, openai: false, local: false },
      modelsError: { gemini: null, claude: null, openai: null, local: null },
    })
  })
})

describe('TranslatePage', () => {
  it('renders the translate page without crashing', () => {
    const { container } = render(<TranslatePage />)
    expect(container).not.toBeNull()
  })

  it.each(['en', 'vi', 'ja'] as const)('renders the bilingual editor chrome in %s', (locale) => {
    act(() => {
      useAppStore.setState({ locale, localeAuto: false })
    })

    render(<TranslatePage />)
    const t = TRANSLATIONS[locale]

    expect(screen.getByRole('button', { name: t.translate_options })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(t.translate_from_label, 'i') }))
      .toHaveTextContent(t.lang_names.auto)
    expect(screen.getByRole('button', { name: new RegExp(t.translate_to_label, 'i') }))
      .toHaveTextContent(t.lang_names.vi)
    expect(screen.getByRole('heading', { name: t.translate_source_content_label }))
      .toHaveClass('translate-pane-heading')
    expect(getSourcePane()).toHaveAccessibleName(t.translate_source_content_label)
    expect(screen.getByRole('heading', { name: t.translate_result_content_label }))
      .toHaveClass('translate-pane-heading')
    expect(screen.getByRole('region', { name: t.translate_result_content_label }))
      .toHaveAccessibleName(t.translate_result_content_label)
    expect(screen.getByText(t.translate_empty_manual_hint)).toBeInTheDocument()
  })

  it('shows Translate button in manual mode', () => {
    render(<TranslatePage />)
    expect(screen.getByRole('button', { name: /^Translate$/i })).toBeDisabled()
  })

  it('shows a safe localized top-right notification when microphone access is denied', async () => {
    const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
    const mediaRecorderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder')
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: class MediaRecorderSupportStub {},
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(
          new DOMException('Sensitive browser permission detail', 'NotAllowedError'),
        ),
      },
    })

    try {
      render(<TranslatePage />)
      fireEvent.click(screen.getByRole('button', { name: TRANSLATIONS.en.voice_record }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(TRANSLATIONS.en.voice_error_permission_denied)
      expect(alert.closest('.notification-viewport')).toBeInTheDocument()
      expect(within(alert).queryByRole('button', { name: /Open Settings/i })).not.toBeInTheDocument()
      expect(screen.queryByText('Sensitive browser permission detail')).not.toBeInTheDocument()
    } finally {
      if (mediaDevicesDescriptor) {
        Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor)
      } else {
        Reflect.deleteProperty(navigator, 'mediaDevices')
      }
      if (mediaRecorderDescriptor) {
        Object.defineProperty(globalThis, 'MediaRecorder', mediaRecorderDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'MediaRecorder')
      }
    }
  })

  it('does not auto-translate a pasted image while manual mode is active', async () => {
    vi.useFakeTimers()
    const file = new File(['image'], 'manual.png', { type: 'image/png' })
    vi.mocked(extractImageFromClipboard).mockReturnValue(file)

    render(<TranslatePage />)

    act(() => {
      fireEvent.paste(getSourcePane(), {
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
      fireEvent.paste(getSourcePane(), {
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

  it('cancels an in-flight result when the source draft changes', async () => {
    type TranslateApiResult = Awaited<ReturnType<typeof window.api.translate>>
    let resolveRequest: ((value: TranslateApiResult) => void) | undefined

    vi.mocked(window.api.translate).mockImplementationOnce(() => (
      new Promise<TranslateApiResult>((resolve) => { resolveRequest = resolve })
    ))
    act(() => {
      useAppStore.setState({ sourceText: 'Original source' })
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Translate$/i }))

    await waitFor(() => expect(window.api.translate).toHaveBeenCalledTimes(1))
    fireEvent.change(getSourceInput(), { target: { value: 'Edited source' } })

    expect(window.api.cancelTranslate).toHaveBeenCalledWith({
      requestId: expect.any(String),
    })

    await act(async () => {
      resolveRequest?.({ success: true, translatedText: 'Outdated result' })
    })

    expect(useAppStore.getState().translatedText).toBe('')
    expect(screen.queryByText('Outdated result')).not.toBeInTheDocument()
  })

  it('clears the shared translating state when leaving during a request', async () => {
    vi.mocked(window.api.translate).mockImplementationOnce(() => new Promise(() => {}))
    act(() => {
      useAppStore.setState({ sourceText: 'Navigate away while translating' })
    })

    const view = render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Translate$/i }))
    await waitFor(() => expect(useAppStore.getState().isTranslating).toBe(true))

    view.unmount()

    expect(useAppStore.getState().isTranslating).toBe(false)
  })

  it('cancels an in-flight text result when an image replaces the source', async () => {
    type TranslateApiResult = Awaited<ReturnType<typeof window.api.translate>>
    let resolveRequest: ((value: TranslateApiResult) => void) | undefined
    const file = new File(['image'], 'replacement.png', { type: 'image/png' })

    vi.mocked(window.api.translate).mockImplementationOnce(() => (
      new Promise<TranslateApiResult>((resolve) => { resolveRequest = resolve })
    ))
    vi.mocked(extractImageFromClipboard).mockReturnValue(file)
    act(() => {
      useAppStore.setState({ sourceText: 'Original source' })
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Translate$/i }))
    await waitFor(() => expect(window.api.translate).toHaveBeenCalledTimes(1))

    fireEvent.paste(getSourcePane(), { clipboardData: { items: [] } })

    await waitFor(() => expect(resizeImageFile).toHaveBeenCalledWith(
      file,
      expect.any(Number),
      { useQualityLoop: true },
    ))
    expect(window.api.cancelTranslate).toHaveBeenCalledWith({ requestId: expect.any(String) })

    await act(async () => {
      resolveRequest?.({ success: true, translatedText: 'Outdated text result' })
    })

    expect(useAppStore.getState().translatedText).toBe('')
    expect(screen.queryByText('Outdated text result')).not.toBeInTheDocument()
  })

  it('does not attach an image whose preprocessing finishes after Clear', async () => {
    type ResizeResult = Awaited<ReturnType<typeof resizeImageFile>>
    let resolveResize: ((value: ResizeResult) => void) | undefined
    const file = new File(['image'], 'slow.png', { type: 'image/png' })

    vi.mocked(extractImageFromClipboard).mockReturnValue(file)
    vi.mocked(resizeImageFile).mockImplementationOnce(() => (
      new Promise<ResizeResult>((resolve) => { resolveResize = resolve })
    ))
    act(() => {
      useAppStore.setState({ sourceText: 'Keep the clear action available' })
    })

    render(<TranslatePage />)
    fireEvent.paste(getSourcePane(), { clipboardData: { items: [] } })
    fireEvent.click(screen.getByTitle(/Clear|Xóa/i))

    await act(async () => {
      resolveResize?.({
        base64: 'slow-image',
        mimeType: 'image/png',
        previewUrl: 'data:image/png;base64,slow-image',
        width: 100,
        height: 80,
        fileName: 'slow.png',
      })
    })

    expect(screen.queryByAltText('slow.png')).not.toBeInTheDocument()
    expect(useAppStore.getState().sourceText).toBe('')
  })

  it('does not let a delayed rewrite restore source text after Clear', async () => {
    type RewriteResult = Awaited<ReturnType<typeof window.api.rewriteText>>
    let resolveRewrite: ((value: RewriteResult) => void) | undefined

    vi.mocked(window.api.rewriteText).mockImplementationOnce(() => (
      new Promise<RewriteResult>((resolve) => { resolveRewrite = resolve })
    ))
    act(() => {
      useAppStore.setState({ sourceText: 'Rewrite this source' })
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByTitle(/^Rewrite$/i))
    fireEvent.click(screen.getByTitle(/^Clear$/i))

    await act(async () => {
      resolveRewrite?.({ success: true, translatedText: 'Delayed rewritten source' })
    })

    expect(useAppStore.getState().sourceText).toBe('')
    expect(screen.queryByText('Delayed rewritten source')).not.toBeInTheDocument()
  })

  it('marks a completed manual result stale after the source changes', async () => {
    vi.mocked(window.api.translate).mockResolvedValueOnce({
      success: true,
      translatedText: 'Xin chào',
    })
    act(() => {
      useAppStore.setState({ sourceText: 'Hello' })
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Translate$/i }))
    await waitFor(() => expect(useAppStore.getState().translatedText).toBe('Xin chào'))

    fireEvent.change(getSourceInput(), { target: { value: 'Hello there' } })

    expect(screen.getAllByText(/The source changed\. Translate again/i)).not.toHaveLength(0)
  })

  it('preserves stale-result tracking after leaving and returning to the page', async () => {
    vi.mocked(window.api.translate).mockResolvedValueOnce({
      success: true,
      translatedText: 'Xin chào',
    })
    act(() => {
      useAppStore.setState({ sourceText: 'Hello' })
    })

    const firstRender = render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Translate$/i }))
    await waitFor(() => expect(useAppStore.getState().translatedText).toBe('Xin chào'))
    firstRender.unmount()

    render(<TranslatePage />)
    fireEvent.change(getSourceInput(), { target: { value: 'Hello again' } })

    expect(screen.getAllByText(/The source changed\. Translate again/i)).not.toHaveLength(0)
  })

  it('supports the manual translate keyboard shortcut without an IME composition', async () => {
    vi.mocked(window.api.translate).mockResolvedValueOnce({
      success: true,
      translatedText: 'Bản dịch',
    })
    act(() => {
      useAppStore.setState({ sourceText: 'Keyboard source' })
    })

    render(<TranslatePage />)
    fireEvent.keyDown(getSourceInput(), { key: 'Enter', metaKey: true })

    await waitFor(() => expect(window.api.translate).toHaveBeenCalledTimes(1))
  })

  it('does not submit the keyboard shortcut while an IME composition is active', () => {
    act(() => {
      useAppStore.setState({ sourceText: '入力中' })
    })

    render(<TranslatePage />)
    fireEvent.keyDown(getSourceInput(), {
      key: 'Enter',
      metaKey: true,
      isComposing: true,
    })

    expect(window.api.translate).not.toHaveBeenCalled()
  })

  it.each([
    ['en', 'Auto translate'],
    ['vi', 'Dịch tự động'],
    ['ja', '自動翻訳'],
  ] as const)('shows an explicit automatic-translation label in %s', (locale, label) => {
    act(() => {
      useAppStore.setState({ autoTranslate: true, locale, localeAuto: false })
    })

    render(<TranslatePage />)
    expect(screen.getByRole('button', { name: label, pressed: true })).toBeInTheDocument()
  })

  it('clicking Auto/Manual toggle switches autoTranslate state', () => {
    render(<TranslatePage />)
    expect(useAppStore.getState().autoTranslate).toBe(false)

    const toggle = screen.getByRole('button', { name: 'Manual translate', pressed: false })
    act(() => { fireEvent.click(toggle) })

    expect(useAppStore.getState().autoTranslate).toBe(true)
    expect(screen.getByRole('button', { name: 'Auto translate', pressed: true })).toBeInTheDocument()
  })

  it('uses one accurate auto-translate message after typing stops', () => {
    act(() => {
      useAppStore.setState({ autoTranslate: true, locale: 'vi', localeAuto: false })
    })

    render(<TranslatePage />)

    expect(screen.getByText(TRANSLATIONS.vi.translate_empty_auto_hint)).toBeInTheDocument()
    expect(screen.queryByText(/trong khi gõ/i)).not.toBeInTheDocument()
  })

  it('exposes labelled language controls and dismisses the AI options popover', async () => {
    act(() => {
      useAppStore.setState({
        selectedModels: {
          ...useAppStore.getState().selectedModels,
          gemini: 'gemini-2.5-flash',
        },
        dynamicModels: {
          ...useAppStore.getState().dynamicModels,
          gemini: [{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: '' }],
        },
      })
    })
    render(<TranslatePage />)

    expect(getSourcePane()).toHaveAccessibleName('Source content')
    expect(screen.getByRole('region', { name: /^Translation$/i }))
      .toHaveAccessibleName('Translation')
    expect(screen.getByRole('button', { name: /Translate from/i }))
      .toHaveTextContent('Auto Detect')
    expect(screen.getByRole('button', { name: /Translate to/i }))
      .toHaveTextContent('Vietnamese')

    const optionsButton = screen.getByRole('button', { name: 'AI settings' })
    expect(optionsButton).toHaveAttribute('aria-haspopup', 'dialog')
    fireEvent.click(optionsButton)
    expect(optionsButton).toHaveAttribute('aria-expanded', 'true')
    const optionsDialog = screen.getByRole('dialog', { name: 'AI settings' })
    expect(optionsDialog).toBeInTheDocument()
    expect(screen.getByLabelText('Style')).toBeInTheDocument()
    const reasoningSelect = screen.getByLabelText('Reasoning')
    expect(reasoningSelect).toBeEnabled()
    fireEvent.change(reasoningSelect, { target: { value: 'high' } })
    expect(useAppStore.getState().translationReasoningEffort).toBe('high')

    const modelTrigger = optionsDialog.querySelector<HTMLButtonElement>('.model-picker-trigger')
    expect(modelTrigger).not.toBeNull()
    expect(modelTrigger).toHaveAttribute('data-control-shape', 'rect')
    expect(modelTrigger).toHaveAttribute('data-control-appearance', 'outline')
    fireEvent.click(modelTrigger as HTMLButtonElement)
    expect(screen.getByRole('dialog', { name: 'Choose model' })).toBe(optionsDialog)
    const modelGroup = screen.getByRole('group', { name: 'Model' })
    expect(optionsDialog).toContainElement(modelGroup)
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search models…' })).toHaveFocus())
    expect(screen.queryByRole('button', { name: /^Model:/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument()
    expect(optionsDialog.querySelector('.model-picker-trigger')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Style')).not.toBeInTheDocument()
    fireEvent.pointerDown(modelGroup)
    expect(optionsDialog).toBeInTheDocument()

    const modelBackButton = screen.getByRole('button', { name: 'Back' })
    fireEvent.pointerDown(modelBackButton)
    fireEvent.click(modelBackButton)
    expect(screen.queryByRole('group', { name: 'Model' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'AI settings' })).toBe(optionsDialog)
    expect(screen.getByLabelText('Style')).toBeInTheDocument()
    await waitFor(() => {
      expect(optionsDialog.querySelector('.model-picker-trigger')).toHaveFocus()
    })

    fireEvent.click(optionsDialog.querySelector<HTMLButtonElement>('.model-picker-trigger') as HTMLButtonElement)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('group', { name: 'Model' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'AI settings' })).toBe(optionsDialog)

    fireEvent.pointerDown(document.body)
    expect(optionsButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog', { name: 'AI settings' })).not.toBeInTheDocument()

    fireEvent.click(optionsButton)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(optionsButton).toHaveAttribute('aria-expanded', 'false')
    expect(optionsButton).toHaveFocus()

    fireEvent.click(optionsButton)
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByRole('dialog', { name: 'AI settings' })).not.toBeInTheDocument()
  })

  it('swaps an explicit language pair before a translation exists', () => {
    act(() => {
      useAppStore.setState({ sourceLang: 'en', targetLang: 'vi' })
    })

    render(<TranslatePage />)
    const swapButton = screen.getByRole('button', { name: 'Swap languages' })
    expect(swapButton.parentElement).not.toHaveAttribute('tabindex')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.click(swapButton)

    expect(screen.getByRole('button', { name: /Translate from/i })).toHaveTextContent('Vietnamese')
    expect(screen.getByRole('button', { name: /Translate to/i })).toHaveTextContent('English')
  })

  it('keeps swap disabled for Auto until the source language is detected', async () => {
    vi.mocked(window.api.translate).mockResolvedValueOnce({
      success: true,
      translatedText: 'Xin chào',
    })
    act(() => {
      useAppStore.setState({ sourceText: 'Hello', sourceLang: 'auto' })
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Translate$/i }))
    await waitFor(() => expect(useAppStore.getState().translatedText).toBe('Xin chào'))

    expect(screen.getByRole('button', { name: 'Swap languages' })).toBeDisabled()
  })

  it('makes the disabled swap reason discoverable from the keyboard', () => {
    render(<TranslatePage />)

    const swapButton = screen.getByRole('button', { name: 'Swap languages' })
    const swapGroup = screen.getByRole('group', { name: 'Swap languages' })
    const reason = TRANSLATIONS.en.translate_swap_disabled_auto

    expect(swapButton).toBeDisabled()
    expect(swapButton).toHaveAccessibleDescription(reason)
    expect(swapGroup).toHaveAttribute('tabindex', '0')
    expect(swapGroup).toHaveAttribute('aria-disabled', 'true')
    expect(swapGroup).toHaveAccessibleDescription(reason)
    expect(screen.getByRole('tooltip')).toHaveTextContent(reason)
  })

  it('localizes structured provider errors instead of rendering backend English', async () => {
    vi.mocked(window.api.translate).mockResolvedValueOnce({
      success: false,
      error: 'Invalid API key. Please check your key in Settings.',
      errorCode: 'INVALID_KEY',
    })
    act(() => {
      useAppStore.setState({ sourceText: 'Hello', locale: 'vi', localeAuto: false })
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Dịch$/i }))

    expect(await screen.findByText('API key không hợp lệ. Vui lòng kiểm tra trong Cài đặt.')).toBeInTheDocument()
  })

  it('does not leak an unstructured backend exception into the localized UI', async () => {
    vi.mocked(window.api.translate).mockRejectedValueOnce(new Error('Backend exploded in English'))
    act(() => {
      useAppStore.setState({ sourceText: 'Hello', locale: 'vi', localeAuto: false })
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Dịch$/i }))

    expect(await screen.findByText('Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.')).toBeInTheDocument()
    expect(screen.queryByText('Backend exploded in English')).not.toBeInTheDocument()
  })

  it('uses translation-specific copy for an empty model response', async () => {
    vi.mocked(window.api.translate).mockResolvedValueOnce({
      success: false,
      error: 'The model returned an empty response.',
      errorCode: 'EMPTY_RESPONSE',
    })
    act(() => {
      useAppStore.setState({ sourceText: 'Hello', locale: 'vi', localeAuto: false })
    })

    render(<TranslatePage />)
    fireEvent.click(screen.getByRole('button', { name: /^Dịch$/i }))

    expect(await screen.findByText(
      'Mô hình không trả về bản dịch. Hãy thử lại hoặc chọn mô hình khác.',
    )).toBeInTheDocument()
  })

  it('shows result placeholder when no translation yet', () => {
    render(<TranslatePage />)
    expect(screen.queryByRole('heading', { name: /Ready to translate|Sẵn sàng dịch/i })).not.toBeInTheDocument()
    expect(screen.getByText(/appear here after you choose Translate|xuất hiện ở đây sau khi bạn chọn Dịch/i)).toBeInTheDocument()
  })

  it('shows labelled voice and image entry points only while the source is empty', () => {
    render(<TranslatePage />)
    const voiceButton = screen.getByRole('button', { name: TRANSLATIONS.en.voice_record })
    const imageButton = screen.getByRole('button', { name: TRANSLATIONS.en.translate_add_image })

    expect(voiceButton).toHaveTextContent(TRANSLATIONS.en.voice_record)
    expect(imageButton).toHaveTextContent(TRANSLATIONS.en.translate_add_image)

    fireEvent.change(getSourceInput(), { target: { value: 'Hello' } })

    expect(voiceButton).not.toHaveTextContent(TRANSLATIONS.en.voice_record)
    expect(imageButton).not.toHaveTextContent(TRANSLATIONS.en.translate_add_image)
  })

  it('renders a text input area for source text', () => {
    render(<TranslatePage />)
    expect(getSourceInput().getAttribute('placeholder')).toMatch(/Enter or paste text|Nhập hoặc dán văn bản/i)
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
    expect(screen.getByDisplayValue(/Do not show|Không hiển thị|表示しない/i)).toBeInTheDocument()
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
      fireEvent.change(screen.getByDisplayValue(/Do not show|Không hiển thị|表示しない/i), { target: { value: 'standard' } })
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
    expect(getSourceInput()).toHaveValue('Hello world')
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
    expect(document.querySelector('.translate-char-count')).toHaveTextContent(/^5 chars$/)
  })

  it('explains the soft threshold and still submits the full long text', async () => {
    const longText = 'x'.repeat(TRANSLATE_INPUT_WARNING_CHARS + 1)
    act(() => {
      useAppStore.setState({ sourceText: longText })
    })

    render(<TranslatePage />)
    const translateButton = screen.getByRole('button', { name: /^Translate$/i })
    const counter = document.querySelector('.translate-char-count')
    const notice = TRANSLATIONS.en.translate_long_text_notice(TRANSLATE_INPUT_WARNING_CHARS)

    expect(translateButton).toBeEnabled()
    expect(counter).toHaveClass('translate-char-count-notice')
    expect(counter).toHaveTextContent('5,001 chars·May take longer')
    expect(getSourceInput()).toHaveAccessibleDescription(new RegExp(notice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    fireEvent.click(translateButton)
    await waitFor(() => expect(window.api.translate).toHaveBeenCalledTimes(1))
    expect(window.api.translate).toHaveBeenCalledWith(expect.objectContaining({ sourceText: longText }))
  })
})
