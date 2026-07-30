import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createAudioTranscriptionRequestId,
  DICTATION_AUDIO_CONSTRAINTS,
  DICTATION_MAX_AUDIO_BYTES,
  DICTATION_MAX_RECORDING_MS,
  DICTATION_MIN_AUDIO_BYTES,
  DICTATION_RECORDER_TIMESLICE_MS,
  getSupportedAudioMimeType,
} from '../constants/audio'
import { useAppStore, useT } from '../store/useAppStore'
import type {
  AudioTranscriptionErrorCode,
  SttProvider,
  TranscribeAudioParams,
} from '../types'
import { Button, type ButtonSize, type ButtonVariant } from './ui/atoms/Button'
import { MicrophoneIcon, SpinnerIcon, StopSquareIcon, XIcon } from './ui/icons'

export type VoiceRecordingState =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopping'
  | 'transcribing'
  | 'error'

interface VoiceRecorderProps {
  /** Dictation produces one final transcript after the completed recording is processed. */
  onTranscript: (text: string, isFinal: boolean) => void
  /** True from operation start so the owner can snapshot/lock its draft before permission resolves. */
  onRecordingChange?: (isRecording: boolean) => void
  onStateChange?: (state: VoiceRecordingState) => void
  onCancel?: () => void
  onError?: (code: AudioTranscriptionErrorCode) => void
  sourceLang: string
  /** Changing this value discards any capture/result owned by the previous context. */
  contextKey?: string | null
  disabled?: boolean
  titleRecord?: string
  titleStop?: string
  buttonClassName?: string
  buttonSize?: ButtonSize
  /** Shows a text label beside the idle microphone icon for discoverability. */
  showIdleLabel?: boolean
  idleLabel?: string
  labelRequesting?: string
  labelTranscribing?: string
  labelRecording?: string
  labelStopping?: string
  labelCancel?: string
  showCancel?: boolean
  showPulse?: boolean
}

interface RecordingOperation {
  generation: number
  requestId: string
  sourceLang: string
  sttProvider: SttProvider
  contextKey?: string | null
  mimeType: string
}

type StopIntent = 'submit' | 'discard' | 'audio-too-large'

function formatRecordingDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function microphoneErrorCode(error: unknown): AudioTranscriptionErrorCode {
  const errorName = typeof error === 'object' && error !== null && 'name' in error
    ? String(error.name)
    : ''
  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
    return 'PERMISSION_DENIED'
  }
  return 'RECORDING_FAILED'
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop()
  })
}

export function VoiceRecorder({
  onTranscript,
  onRecordingChange,
  onStateChange,
  onCancel,
  onError,
  sourceLang,
  contextKey,
  disabled,
  titleRecord,
  titleStop,
  buttonClassName,
  buttonSize = 'md',
  showIdleLabel = false,
  idleLabel,
  labelRequesting,
  labelTranscribing,
  labelRecording,
  labelStopping,
  labelCancel,
  showCancel = false,
  showPulse = true,
}: VoiceRecorderProps) {
  const t = useT()
  const sttProvider = useAppStore((store) => store.sttProvider)
  const resolvedTitleRecord = titleRecord ?? t.voice_record
  const resolvedTitleStop = titleStop ?? t.voice_stop
  const resolvedLabelRequesting = labelRequesting ?? t.voice_preparing_microphone
  const resolvedLabelTranscribing = labelTranscribing ?? t.voice_transcribing
  const resolvedLabelRecording = labelRecording ?? t.voice_recording
  const resolvedLabelStopping = labelStopping ?? t.voice_finishing_recording
  const resolvedLabelCancel = labelCancel ?? t.voice_cancel
  const isSupported = typeof MediaRecorder !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'

  const [state, setState] = useState<VoiceRecordingState>('idle')
  const [errorCode, setErrorCode] = useState<AudioTranscriptionErrorCode | null>(null)
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const mountedRef = useRef(true)
  const stateRef = useRef<VoiceRecordingState>('idle')
  const generationRef = useRef(0)
  const activeOperationRef = useRef<RecordingOperation | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioBytesRef = useRef(0)
  const stopIntentRef = useRef<StopIntent>('submit')
  const maximumDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordingPresenceRef = useRef(false)
  const callbacksRef = useRef({ onTranscript, onRecordingChange, onCancel, onError })
  callbacksRef.current = { onTranscript, onRecordingChange, onCancel, onError }

  const setLifecycleState = useCallback((nextState: VoiceRecordingState) => {
    if (!mountedRef.current) return
    stateRef.current = nextState
    setState(nextState)
  }, [])

  const setRecordingPresence = useCallback((isRecording: boolean) => {
    if (recordingPresenceRef.current === isRecording) return
    recordingPresenceRef.current = isRecording
    if (mountedRef.current) callbacksRef.current.onRecordingChange?.(isRecording)
  }, [])

  const clearMaximumDurationTimer = useCallback(() => {
    if (maximumDurationTimerRef.current !== null) {
      clearTimeout(maximumDurationTimerRef.current)
      maximumDurationTimerRef.current = null
    }
  }, [])

  const isCurrentOperation = useCallback((operation: RecordingOperation) => (
    mountedRef.current
    && generationRef.current === operation.generation
    && activeOperationRef.current?.generation === operation.generation
  ), [])

  const discardCaptureResources = useCallback(() => {
    clearMaximumDurationTimer()
    const recorder = mediaRecorderRef.current
    mediaRecorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // Tracks are stopped below even if the recorder already transitioned.
        }
      }
    }

    stopStream(mediaStreamRef.current)
    mediaStreamRef.current = null
    audioChunksRef.current = []
    audioBytesRef.current = 0
    stopIntentRef.current = 'discard'
  }, [clearMaximumDurationTimer])

  const finishWithError = useCallback((
    operation: RecordingOperation,
    code: AudioTranscriptionErrorCode,
  ) => {
    if (!isCurrentOperation(operation)) return
    generationRef.current += 1
    activeOperationRef.current = null
    discardCaptureResources()
    setRecordingPresence(false)
    setErrorCode(code)
    setLifecycleState('error')
    callbacksRef.current.onError?.(code)
  }, [discardCaptureResources, isCurrentOperation, setLifecycleState, setRecordingPresence])

  const cancelOperation = useCallback((explicit: boolean) => {
    const operation = activeOperationRef.current
    if (!operation) return
    const shouldCancelBackend = stateRef.current === 'transcribing'

    generationRef.current += 1
    activeOperationRef.current = null
    discardCaptureResources()
    setRecordingPresence(false)

    if (shouldCancelBackend) {
      const cancelAudioTranscription = window.api.cancelAudioTranscription
      if (typeof cancelAudioTranscription === 'function') {
        void cancelAudioTranscription({ requestId: operation.requestId }).catch(() => undefined)
      }
    }
    if (mountedRef.current) {
      setErrorCode(null)
      setLifecycleState('idle')
      if (explicit) callbacksRef.current.onCancel?.()
    }
  }, [discardCaptureResources, setLifecycleState, setRecordingPresence])

  const submitCapturedAudio = useCallback(async (
    operation: RecordingOperation,
    actualMimeType: string,
  ) => {
    if (!isCurrentOperation(operation)) return

    const chunks = audioChunksRef.current
    audioChunksRef.current = []
    audioBytesRef.current = 0
    const blob = new Blob(chunks, { type: actualMimeType })

    if (!actualMimeType.startsWith('audio/')) {
      finishWithError(operation, 'UNSUPPORTED_FORMAT')
      return
    }
    if (blob.size < DICTATION_MIN_AUDIO_BYTES) {
      finishWithError(operation, 'AUDIO_TOO_SHORT')
      return
    }
    if (blob.size > DICTATION_MAX_AUDIO_BYTES) {
      finishWithError(operation, 'AUDIO_TOO_LARGE')
      return
    }

    setLifecycleState('transcribing')

    try {
      const audioData = await blob.arrayBuffer()
      if (!isCurrentOperation(operation)) return

      const params: TranscribeAudioParams = {
        requestId: operation.requestId,
        purpose: 'dictation',
        audioData,
        mimeType: actualMimeType,
        language: operation.sourceLang === 'auto' ? undefined : operation.sourceLang,
        sttProvider: operation.sttProvider,
      }
      const result = await window.api.transcribeAudio(params)
      if (!isCurrentOperation(operation)) return

      if (!result.success) {
        finishWithError(operation, result.errorCode)
        return
      }
      if (!result.text) {
        finishWithError(operation, 'NO_SPEECH')
        return
      }

      generationRef.current += 1
      activeOperationRef.current = null
      setErrorCode(null)
      setLifecycleState('idle')
      callbacksRef.current.onTranscript(result.text, true)
    } catch {
      finishWithError(operation, 'UNKNOWN')
    }
  }, [finishWithError, isCurrentOperation, setLifecycleState])

  const stopRecording = useCallback(() => {
    const operation = activeOperationRef.current
    const recorder = mediaRecorderRef.current
    if (!operation || stateRef.current !== 'recording' || !recorder) return

    clearMaximumDurationTimer()
    stopIntentRef.current = 'submit'
    setRecordingPresence(false)
    setLifecycleState('stopping')
    try {
      recorder.stop()
    } catch {
      finishWithError(operation, 'RECORDING_FAILED')
    }
  }, [clearMaximumDurationTimer, finishWithError, setLifecycleState, setRecordingPresence])

  const startRecording = useCallback(async () => {
    if (stateRef.current !== 'idle' && stateRef.current !== 'error') return

    const operation: RecordingOperation = {
      generation: generationRef.current + 1,
      requestId: createAudioTranscriptionRequestId(),
      sourceLang,
      sttProvider,
      contextKey,
      mimeType: '',
    }
    generationRef.current = operation.generation
    activeOperationRef.current = operation
    audioChunksRef.current = []
    audioBytesRef.current = 0
    stopIntentRef.current = 'submit'
    setErrorCode(null)
    setLifecycleState('requesting')
    setRecordingPresence(true)

    if (!isSupported) {
      finishWithError(operation, 'RECORDING_FAILED')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: DICTATION_AUDIO_CONSTRAINTS })
    } catch (error) {
      finishWithError(operation, microphoneErrorCode(error))
      return
    }

    if (!isCurrentOperation(operation)) {
      stopStream(stream)
      return
    }
    mediaStreamRef.current = stream

    const preferredMimeType = getSupportedAudioMimeType()
    let recorder: MediaRecorder
    try {
      recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream)
    } catch {
      try {
        recorder = new MediaRecorder(stream)
      } catch {
        finishWithError(operation, 'RECORDING_FAILED')
        return
      }
    }

    operation.mimeType = recorder.mimeType || preferredMimeType
    mediaRecorderRef.current = recorder

    recorder.ondataavailable = (event) => {
      if (!isCurrentOperation(operation) || event.data.size === 0) return
      const nextByteCount = audioBytesRef.current + event.data.size
      if (nextByteCount > DICTATION_MAX_AUDIO_BYTES) {
        audioChunksRef.current = []
        audioBytesRef.current = nextByteCount
        stopIntentRef.current = 'audio-too-large'
        clearMaximumDurationTimer()
        setRecordingPresence(false)
        setLifecycleState('stopping')
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop()
          } catch {
            finishWithError(operation, 'AUDIO_TOO_LARGE')
          }
        }
        return
      }
      audioBytesRef.current = nextByteCount
      audioChunksRef.current.push(event.data)
    }

    recorder.onstop = () => {
      clearMaximumDurationTimer()
      if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null
      if (mediaStreamRef.current === stream) mediaStreamRef.current = null
      stopStream(stream)
      setRecordingPresence(false)

      if (!isCurrentOperation(operation)) return
      if (stopIntentRef.current === 'audio-too-large') {
        finishWithError(operation, 'AUDIO_TOO_LARGE')
        return
      }
      if (stopIntentRef.current !== 'submit') return

      const actualMimeType = recorder.mimeType || operation.mimeType || audioChunksRef.current[0]?.type || ''
      void submitCapturedAudio(operation, actualMimeType)
    }

    recorder.onerror = () => {
      finishWithError(operation, 'RECORDING_FAILED')
    }

    try {
      recorder.start(DICTATION_RECORDER_TIMESLICE_MS)
    } catch {
      finishWithError(operation, 'RECORDING_FAILED')
      return
    }

    if (!isCurrentOperation(operation)) {
      discardCaptureResources()
      return
    }
    setLifecycleState('recording')
    setRecordingPresence(true)
    maximumDurationTimerRef.current = setTimeout(stopRecording, DICTATION_MAX_RECORDING_MS)
  }, [
    clearMaximumDurationTimer,
    contextKey,
    discardCaptureResources,
    finishWithError,
    isCurrentOperation,
    isSupported,
    setLifecycleState,
    setRecordingPresence,
    sourceLang,
    stopRecording,
    sttProvider,
    submitCapturedAudio,
  ])

  useEffect(() => {
    onStateChange?.(state)
  }, [onStateChange, state])

  useEffect(() => {
    if (state !== 'recording') {
      setRecordingSeconds(0)
      return
    }
    const timerId = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1)
    }, 1_000)
    return () => window.clearInterval(timerId)
  }, [state])

  useEffect(() => {
    const operation = activeOperationRef.current
    if (
      operation
      && (operation.sourceLang !== sourceLang || operation.contextKey !== contextKey)
    ) {
      cancelOperation(false)
    }
  }, [cancelOperation, contextKey, sourceLang])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cancelOperation(false)
    }
  }, [cancelOperation])

  const handleClick = () => {
    if (stateRef.current === 'recording') stopRecording()
    else if (stateRef.current === 'idle' || stateRef.current === 'error') void startRecording()
  }

  const isRecording = state === 'recording'
  const isTranscribing = state === 'transcribing'
  const isTransitioning = state === 'requesting' || state === 'stopping'
  const isBusy = isRecording || isTranscribing || isTransitioning
  const showVisibleIdleLabel = showIdleLabel && !isBusy
  const showMainButton = !showCancel || isRecording || !isBusy
  const resolvedButtonClassName = isBusy
    ? 'btn-icon relative'
    : (buttonClassName ?? (showVisibleIdleLabel ? 'relative' : 'btn-icon relative'))
  const buttonVariant: ButtonVariant = isRecording || state === 'error'
    ? 'danger'
    : isBusy
      ? 'primary'
      : 'neutral'
  const busyStatusLabel = state === 'requesting'
    ? resolvedLabelRequesting
    : state === 'stopping'
      ? resolvedLabelStopping
      : resolvedLabelTranscribing

  return (
    <div
      className="voice-recorder relative flex items-center gap-1.5"
      data-state={state}
      data-error-code={errorCode ?? undefined}
    >
      {showCancel && isRecording && (
        <span className="voice-recorder-status" role="status" aria-live="polite">
          <span className="voice-recorder-status-dot" aria-hidden="true" />
          <span>{resolvedLabelRecording}</span>
          <time className="voice-recorder-duration" dateTime={`PT${recordingSeconds}S`} aria-hidden="true">
            {formatRecordingDuration(recordingSeconds)}
          </time>
        </span>
      )}

      {showCancel && (isTransitioning || isTranscribing) && (
        <span className="voice-recorder-status voice-recorder-status--transcribing" role="status" aria-live="polite">
          <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
          <span>{busyStatusLabel}</span>
        </span>
      )}

      {showCancel && isBusy && (
        <Button
          size={buttonSize}
          shape={showVisibleIdleLabel ? 'rect' : 'icon'}
          variant="neutral"
          appearance="ghost"
          onClick={() => cancelOperation(true)}
          title={resolvedLabelCancel}
          aria-label={resolvedLabelCancel}
          className="voice-recorder-cancel"
        >
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      )}

      {showMainButton && (
        <Button
          size={buttonSize}
          shape={showVisibleIdleLabel ? 'rect' : 'icon'}
          variant={buttonVariant}
          appearance={isBusy ? 'soft' : 'ghost'}
          onClick={handleClick}
          disabled={disabled || isTransitioning || isTranscribing}
          title={isRecording ? resolvedTitleStop : resolvedTitleRecord}
          aria-label={isRecording ? resolvedTitleStop : resolvedTitleRecord}
          className={resolvedButtonClassName}
        >
          {showPulse && isBusy && (
            <span className={[
              'absolute inset-0 rounded-full animate-ping opacity-40',
              isRecording ? 'ui-status-ping-danger' : 'bg-gray-400',
            ].join(' ')} />
          )}

          {isTransitioning || isTranscribing ? (
            <SpinnerIcon className="w-3.5 h-3.5 relative z-10 animate-spin" />
          ) : isRecording ? (
            <StopSquareIcon className="w-3.5 h-3.5 relative z-10" />
          ) : (
            <MicrophoneIcon className="w-4 h-4 relative z-10" />
          )}
          {showVisibleIdleLabel && <span>{idleLabel ?? resolvedTitleRecord}</span>}
        </Button>
      )}

      {!showCancel && (isTransitioning || isTranscribing) && (
        <span className="text-xs text-gray-500 dark:text-gray-400 animate-pulse whitespace-nowrap">
          {busyStatusLabel}
        </span>
      )}
      {!showCancel && isRecording && (
        <span className="voice-recording-text text-xs animate-pulse whitespace-nowrap">
          {resolvedLabelRecording}
        </span>
      )}

      {!showCancel && state === 'error' && errorCode && (
        <span className="absolute left-full ml-2 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-2 py-1 rounded-md z-10">
          {t.voice_transcription_failed}
        </span>
      )}
    </div>
  )
}
