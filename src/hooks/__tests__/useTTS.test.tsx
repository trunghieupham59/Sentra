import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTTS } from '../useTTS'

describe('useTTS', () => {
  const speak = vi.fn()
  const cancel = vi.fn()
  const getVoices = vi.fn<() => SpeechSynthesisVoice[]>()

  beforeEach(() => {
    vi.clearAllMocks()
    getVoices.mockReturnValue([])

    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak,
        cancel,
        getVoices,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
    })

    Object.defineProperty(window, 'AudioContext', {
      value: class MockAudioContext {
        state = 'running'
        destination = {}
        resume = vi.fn().mockResolvedValue(undefined)
        decodeAudioData = vi.fn()
        createBuffer = vi.fn()
        createBufferSource = vi.fn()
      },
      configurable: true,
    })
    Object.defineProperty(globalThis, 'AudioContext', {
      value: window.AudioContext,
      configurable: true,
    })

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class MockSpeechSynthesisUtterance {
        lang = ''
        voice: SpeechSynthesisVoice | null = null
        onend: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor(public text: string) {}
      },
      configurable: true,
    })
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      value: window.SpeechSynthesisUtterance,
      configurable: true,
    })

    vi.mocked(window.api.speakText).mockResolvedValue({ success: false })
  })

  it('routes free mode through backend TTS even when a matching local voice exists', async () => {
    getVoices.mockReturnValue([{
      default: false,
      lang: 'en-US',
      localService: true,
      name: 'en-US voice',
      voiceURI: 'en-US-voice',
    }])
    const { result } = renderHook(() => useTTS({ ttsMode: 'free', ttsVoice: 'nova' }))

    await act(async () => {
      await result.current.handleSpeak('Hello', 'en', 'source')
    })

    expect(speak).not.toHaveBeenCalled()
    expect(window.api.speakText).toHaveBeenCalledWith({
      text: 'Hello',
      voice: 'nova',
      mode: 'free',
      lang: 'en',
    })
  })

  it('does not fall back to SpeechSynthesis when backend TTS fails', async () => {
    vi.mocked(window.api.speakText).mockResolvedValue({ success: false, error: 'TTS failed' })
    const { result } = renderHook(() => useTTS({ ttsMode: 'free', ttsVoice: 'nova' }))

    await act(async () => {
      await result.current.handleSpeak('Hello', 'en', 'source')
    })

    expect(window.api.speakText).toHaveBeenCalledWith({
      text: 'Hello',
      voice: 'nova',
      mode: 'free',
      lang: 'en',
    })
    expect(speak).not.toHaveBeenCalled()
  })
})
