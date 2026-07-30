import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { VoiceRecorder } from '../VoiceRecorder'

class MediaRecorderMock {
  static emittedBlob = new Blob([new Uint8Array(1_200)], { type: 'audio/webm' })

  static isTypeSupported() {
    return true
  }

  state: RecordingState = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null

  start() {
    this.state = 'recording'
  }

  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: MediaRecorderMock.emittedBlob })
    this.onstop?.()
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('VoiceRecorder', () => {
  const originalMediaRecorder = globalThis.MediaRecorder
  const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
  const stopTrack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAppStore.setState({ locale: 'en', sttProvider: 'auto' })
    MediaRecorderMock.emittedBlob = new Blob(
      [new Uint8Array(1_200)],
      { type: 'audio/webm' },
    )
    vi.mocked(window.api.transcribeAudio).mockResolvedValue({
      success: true,
      text: 'final transcript',
      usedProvider: 'whisper',
    })
    vi.mocked(window.api.cancelAudioTranscription).mockResolvedValue({
      success: true,
      cancelled: true,
    })
    stopTrack.mockReset()
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: MediaRecorderMock,
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    })
  })

  it('uses a rectangular control when the idle label is visible', () => {
    render(
      <VoiceRecorder
        sourceLang="auto"
        onTranscript={vi.fn()}
        showIdleLabel
        idleLabel="Record voice"
      />,
    )

    expect(screen.getByRole('button', { name: 'Record voice' }))
      .toHaveAttribute('data-control-shape', 'rect')
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: originalMediaRecorder,
    })
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices)
    }
  })

  it('shows a compact recording status and cancels without transcribing', async () => {
    const onCancel = vi.fn()
    const onRecordingChange = vi.fn()
    const onStateChange = vi.fn()
    const onTranscript = vi.fn()

    render(
      <VoiceRecorder
        sourceLang="auto"
        onTranscript={onTranscript}
        onRecordingChange={onRecordingChange}
        onStateChange={onStateChange}
        onCancel={onCancel}
        labelRecording="Recording…"
        labelTranscribing="Transcribing…"
        labelCancel="Cancel recording"
        showCancel
        showPulse={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }))

    await screen.findByRole('button', { name: 'Stop recording' })
    expect(screen.getByRole('status')).toHaveTextContent('Recording…')
    expect(screen.getByText('00:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel recording' }))

    await waitFor(() => expect(onCancel).toHaveBeenCalledOnce())
    expect(onTranscript).not.toHaveBeenCalled()
    expect(window.api.transcribeAudio).not.toHaveBeenCalled()
    expect(stopTrack).toHaveBeenCalledOnce()
    expect(onRecordingChange).toHaveBeenLastCalledWith(false)
    expect(onStateChange).toHaveBeenCalledWith('recording')
    await waitFor(() => expect(onStateChange).toHaveBeenCalledWith('idle'))
  })

  it('records a complete clip before sending one typed dictation request', async () => {
    const onTranscript = vi.fn()
    const onStateChange = vi.fn()

    render(
      <VoiceRecorder
        sourceLang="vi"
        contextKey="chat:session-1:draft"
        onTranscript={onTranscript}
        onStateChange={onStateChange}
        showCancel
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))

    await waitFor(() => expect(window.api.transcribeAudio).toHaveBeenCalledOnce())
    expect(window.api.transcribeAudio).toHaveBeenCalledWith(expect.objectContaining({
      requestId: expect.any(String),
      purpose: 'dictation',
      audioData: expect.any(ArrayBuffer),
      mimeType: 'audio/webm',
      language: 'vi',
      sttProvider: 'auto',
    }))
    expect(onStateChange).toHaveBeenCalledWith('transcribing')
    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('final transcript', true))
    expect(onStateChange).toHaveBeenLastCalledWith('idle')
    expect(stopTrack).toHaveBeenCalledOnce()
  })

  it('rejects a tiny capture locally without consuming a provider request', async () => {
    MediaRecorderMock.emittedBlob = new Blob(['tiny'], { type: 'audio/webm' })
    const onError = vi.fn()

    render(<VoiceRecorder sourceLang="auto" onTranscript={vi.fn()} onError={onError} />)

    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('AUDIO_TOO_SHORT'))
    expect(window.api.transcribeAudio).not.toHaveBeenCalled()
  })

  it('cancels an in-flight backend request and ignores its late result', async () => {
    const backend = deferred<Awaited<ReturnType<typeof window.api.transcribeAudio>>>()
    vi.mocked(window.api.transcribeAudio).mockReturnValueOnce(backend.promise)
    const onTranscript = vi.fn()
    const onCancel = vi.fn()

    render(
      <VoiceRecorder
        sourceLang="auto"
        onTranscript={onTranscript}
        onCancel={onCancel}
        showCancel
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))
    await waitFor(() => expect(window.api.transcribeAudio).toHaveBeenCalledOnce())
    const request = vi.mocked(window.api.transcribeAudio).mock.calls[0][0]

    fireEvent.click(screen.getByRole('button', { name: 'Cancel recording' }))

    expect(window.api.cancelAudioTranscription).toHaveBeenCalledWith({
      requestId: request.requestId,
    })
    expect(onCancel).toHaveBeenCalledOnce()

    await act(async () => {
      backend.resolve({ success: true, text: 'stale transcript', usedProvider: 'whisper' })
    })
    expect(onTranscript).not.toHaveBeenCalled()
  })

  it('invalidates transcription when its owning context changes', async () => {
    const backend = deferred<Awaited<ReturnType<typeof window.api.transcribeAudio>>>()
    vi.mocked(window.api.transcribeAudio).mockReturnValueOnce(backend.promise)
    const onTranscript = vi.fn()
    const view = render(
      <VoiceRecorder
        sourceLang="auto"
        contextKey="chat:session-a:draft"
        onTranscript={onTranscript}
        showCancel
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Stop recording' }))
    await waitFor(() => expect(window.api.transcribeAudio).toHaveBeenCalledOnce())
    const request = vi.mocked(window.api.transcribeAudio).mock.calls[0][0]

    view.rerender(
      <VoiceRecorder
        sourceLang="auto"
        contextKey="chat:session-b:draft"
        onTranscript={onTranscript}
        showCancel
      />,
    )

    await waitFor(() => expect(window.api.cancelAudioTranscription).toHaveBeenCalledWith({
      requestId: request.requestId,
    }))
    await act(async () => {
      backend.resolve({ success: true, text: 'belongs to session A', usedProvider: 'whisper' })
    })
    expect(onTranscript).not.toHaveBeenCalled()
  })

  it('stops capture on unmount and never uploads the abandoned audio', async () => {
    const view = render(<VoiceRecorder sourceLang="auto" onTranscript={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }))
    await screen.findByRole('button', { name: 'Stop recording' })
    view.unmount()

    expect(stopTrack).toHaveBeenCalledOnce()
    expect(window.api.transcribeAudio).not.toHaveBeenCalled()
  })

  it('prevents duplicate permission requests and safely cancels while permission is pending', async () => {
    const permission = deferred<MediaStream>()
    const getUserMedia = vi.fn().mockReturnValue(permission.promise)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    })
    const onRecordingChange = vi.fn()
    const onCancel = vi.fn()
    render(
      <VoiceRecorder
        sourceLang="auto"
        onTranscript={vi.fn()}
        onRecordingChange={onRecordingChange}
        onCancel={onCancel}
        showCancel
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel recording' }))

    expect(getUserMedia).toHaveBeenCalledOnce()
    expect(onRecordingChange.mock.calls).toEqual([[true], [false]])
    expect(onCancel).toHaveBeenCalledOnce()

    const lateStopTrack = vi.fn()
    await act(async () => {
      permission.resolve({ getTracks: () => [{ stop: lateStopTrack }] } as unknown as MediaStream)
    })
    expect(lateStopTrack).toHaveBeenCalledOnce()
    expect(window.api.transcribeAudio).not.toHaveBeenCalled()
  })

  it('maps microphone denial to a safe structured error code', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue({
          name: 'NotAllowedError',
          message: 'raw browser permission detail',
        }),
      },
    })
    const onError = vi.fn()
    render(<VoiceRecorder sourceLang="auto" onTranscript={vi.fn()} onError={onError} />)

    fireEvent.click(screen.getByRole('button', { name: 'Record voice' }))

    await waitFor(() => expect(onError).toHaveBeenCalledWith('PERMISSION_DENIED'))
    expect(screen.queryByText('raw browser permission detail')).not.toBeInTheDocument()
  })
})
