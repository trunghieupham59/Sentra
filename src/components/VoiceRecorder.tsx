import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupportedAudioMimeType, LANG_TO_BCP47 } from '../constants/audio'
import { useAppStore, useT } from '../store/useAppStore'
import { MicrophoneIcon, SpinnerIcon, StopSquareIcon } from './ui/icons'

// ─── SpeechRecognition retry config ──────────────────────────────────────────
/** Max reconnect attempts before giving up on SpeechRecognition (network errors) */
const VOICE_RECORDER_MAX_RETRIES = 3
/** Delay (ms) before restarting SpeechRecognition after a transient failure */
const VOICE_RECORDER_RESTART_DELAY_MS = 600

// ─── Local type definitions for cross-browser Speech Recognition ──────────────
interface SpeechRecResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): { transcript: string; confidence: number }
  [index: number]: { transcript: string; confidence: number }
}
interface SpeechRecResultList {
  readonly length: number
  item(index: number): SpeechRecResult
  [index: number]: SpeechRecResult
}
interface SpeechRecEvent {
  readonly resultIndex: number
  readonly results: SpeechRecResultList
}
interface SpeechRecErrorEvent {
  readonly error: string
  readonly message: string
}
interface SpeechRec {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecEvent) => void) | null
  onerror: ((event: SpeechRecErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function getSpeechRecognitionAPI(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  // biome-ignore lint/suspicious/noExplicitAny: cross-browser API
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// ─── Types ────────────────────────────────────────────────────────────────────
type RecordingState = 'idle' | 'recording' | 'transcribing' | 'error'

interface VoiceRecorderProps {
  /** Called with transcript text and whether it's final */
  onTranscript: (text: string, isFinal: boolean) => void
  /** Called when recording starts (true) or stops/finishes (false) */
  onRecordingChange?: (isRecording: boolean) => void
  sourceLang: string
  disabled?: boolean
  titleRecord?: string
  titleStop?: string
  /**
   * When true: force MediaRecorder + IPC path regardless of the store's sttProvider.
   * Use this for Live Translate where the pipeline specifically requires audio data.
   * When false (default): honour the store's sttProvider setting — may use
   * webkitSpeechRecognition if user chose 'webSpeech'.
   */
  useWhisper?: boolean
  labelTranscribing?: string
  labelRecording?: string
}

// ─── Component ────────────────────────────────────────────────────────────────
export function VoiceRecorder({
  onTranscript,
  onRecordingChange,
  sourceLang,
  disabled,
  titleRecord = 'Record voice',
  titleStop = 'Stop recording',
  useWhisper = false,
  labelTranscribing = 'Transcribing…',
  labelRecording = 'Recording…',
}: VoiceRecorderProps) {
  const t = useT()
  const { sttProvider } = useAppStore()

  const [state, setState] = useState<RecordingState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const sourceLangRef = useRef(sourceLang)
  const isRecordingRef = useRef(false)

  // ── Whisper mode refs ──
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // ── SpeechRecognition mode refs ──
  const recognitionRef = useRef<SpeechRec | null>(null)
  const finalRef = useRef<string>('')
  const retryCountRef = useRef(0)

  /**
   * Determine which recording path to use:
   *   - true  → MediaRecorder + IPC (Whisper / Google STT, routed by sttProvider)
   *   - false → webkitSpeechRecognition (browser-native, no API key needed)
   *
   * Priority:
   *   1. If `useWhisper` prop is explicitly true → always IPC (Live Translate forces this).
   *   2. If store's sttProvider is 'webSpeech' AND prop is not forced → browser path.
   *   3. Otherwise (auto / whisper / google) → IPC path.
   */
  const useMediaRecorder = useWhisper || sttProvider !== 'webSpeech'

  const isSupported =
    useMediaRecorder
      ? typeof navigator !== 'undefined' && !!navigator.mediaDevices
      : getSpeechRecognitionAPI() !== null

  // ── IPC/MediaRecorder MODE (Whisper or Google STT) ────────────────────────
  const stopMediaRecording = useCallback(() => {
    isRecordingRef.current = false
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop() // triggers onstop which sends to STT backend
    } else {
      mediaRecorderRef.current = null
      setState('idle')
      onRecordingChange?.(false)
    }
  }, [onRecordingChange])

  const startMediaRecording = useCallback(async () => {
    setErrorMsg(null)
    audioChunksRef.current = []

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Microphone access denied')
      return
    }

    const mimeType = getSupportedAudioMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, { mimeType })
    } catch {
      recorder = new MediaRecorder(stream)
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      // Stop all audio tracks
      stream.getTracks().forEach((t) => { t.stop() })
      mediaRecorderRef.current = null

      if (!isRecordingRef.current && audioChunksRef.current.length === 0) {
        setState('idle')
        onRecordingChange?.(false)
        return
      }

      setState('transcribing')
      onRecordingChange?.(false)

      const blob = new Blob(audioChunksRef.current, { type: mimeType })
      audioChunksRef.current = []

      try {
        const arrayBuffer = await blob.arrayBuffer()
        const lang = sourceLangRef.current !== 'auto' ? sourceLangRef.current : undefined

        const result = await window.api.transcribeAudio({
          audioData: arrayBuffer,
          mimeType,
          language: lang,
          // Forward the store's sttProvider so the main process can route
          // to the right backend. 'webSpeech' never reaches here (handled above).
          sttProvider,
        })

        if (result.success && result.text) {
          onTranscript(result.text, true)
          setState('idle')
        } else {
          setState('error')
          setErrorMsg(result.error ?? 'Transcription failed')
        }
      } catch (err) {
        setState('error')
        setErrorMsg(err instanceof Error ? err.message : 'Transcription failed')
      }
    }

    recorder.onerror = () => {
      stream.getTracks().forEach((t) => { t.stop() })
      mediaRecorderRef.current = null
      setState('error')
      setErrorMsg('Recording error')
      onRecordingChange?.(false)
    }

    mediaRecorderRef.current = recorder
    isRecordingRef.current = true
    recorder.start()
    setState('recording')
    onRecordingChange?.(true)
  }, [onTranscript, onRecordingChange, sttProvider])

  // ── SPEECH API MODE: webkitSpeechRecognition (browser native, Google) ────────
  const stopSpeechRecording = useCallback(() => {
    isRecordingRef.current = false
    const rec = recognitionRef.current
    recognitionRef.current = null
    if (rec) {
      try { rec.stop() } catch { /* ignore */ }
    }
    setState('idle')
    finalRef.current = ''
    onRecordingChange?.(false)
  }, [onRecordingChange])

  const startSpeechRecording = useCallback(() => {
    const API = getSpeechRecognitionAPI()
    if (!API) {
      setState('error')
      setErrorMsg('Speech recognition not supported')
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    const recognition = new API()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = LANG_TO_BCP47[sourceLangRef.current] ?? 'en-US'
    finalRef.current = ''
    retryCountRef.current = 0

    recognition.onstart = () => {
      isRecordingRef.current = true
      setState('recording')
      setErrorMsg(null)
      onRecordingChange?.(true)
    }

    recognition.onresult = (event: SpeechRecEvent) => {
      retryCountRef.current = 0
      let interim = ''
      let finalSegment = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalSegment += result[0].transcript
        else interim += result[0].transcript
      }
      if (finalSegment) {
        finalRef.current += finalSegment
        onTranscript(finalRef.current, true)
      }
      if (interim) onTranscript(finalRef.current + interim, false)
    }

    recognition.onerror = (event: SpeechRecErrorEvent) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      if (event.error === 'network') { retryCountRef.current++; return }
      setState('error')
      setErrorMsg(event.error)
      isRecordingRef.current = false
      recognitionRef.current = null
    }

    recognition.onend = () => {
      if (!isRecordingRef.current || recognitionRef.current !== recognition) return
      if (retryCountRef.current >= VOICE_RECORDER_MAX_RETRIES) {
        isRecordingRef.current = false
        recognitionRef.current = null
        setState('error')
        setErrorMsg('network')
        onRecordingChange?.(false)
        return
      }
      setTimeout(() => {
        if (!isRecordingRef.current || recognitionRef.current !== recognition) return
        retryCountRef.current++
        try { recognition.start() } catch {
          isRecordingRef.current = false
          recognitionRef.current = null
          setState('idle')
          onRecordingChange?.(false)
        }
      }, VOICE_RECORDER_RESTART_DELAY_MS)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [onTranscript, onRecordingChange])

  // ── Unified stop / start ───────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (useMediaRecorder) stopMediaRecording()
    else stopSpeechRecording()
  }, [useMediaRecorder, stopMediaRecording, stopSpeechRecording])

  const startRecording = useCallback(() => {
    if (useMediaRecorder) startMediaRecording()
    else startSpeechRecording()
  }, [useMediaRecorder, startMediaRecording, startSpeechRecording])

  // Keep sourceLangRef in sync; stop if language changes while recording
  useEffect(() => {
    const prev = sourceLangRef.current
    sourceLangRef.current = sourceLang
    if (prev !== sourceLang && isRecordingRef.current) stopRecording()
  }, [sourceLang, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const handleClick = () => {
    if (state === 'recording') stopRecording()
    else if (state === 'idle' || state === 'error') startRecording()
    // 'transcribing' → ignore clicks
  }

  if (!isSupported) return null

  const isTranscribing = state === 'transcribing'
  const isRecording = state === 'recording'

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        title={isRecording ? titleStop : titleRecord}
        className={[
          'relative flex items-center justify-center w-8 h-8 rounded-full',
          'transition-all duration-200 cursor-pointer',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          isRecording
            ? 'bg-red-500 text-white shadow-sm hover:bg-red-600'
            : isTranscribing
              ? 'bg-blue-500 text-white shadow-sm'
              : state === 'error'
                ? 'bg-orange-100 text-orange-500 border border-orange-200 dark:bg-orange-950 dark:border-orange-800 hover:bg-orange-200'
                : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 dark:hover:text-blue-400',
        ].join(' ')}
      >
        {/* Pulse ring */}
        {(isRecording || isTranscribing) && (
          <span className={[
            'absolute inset-0 rounded-full animate-ping opacity-40',
            isTranscribing ? 'bg-blue-400' : 'bg-red-400',
          ].join(' ')} />
        )}

        {isTranscribing ? (
          /* Spinner while transcribing */
          <SpinnerIcon className="w-3.5 h-3.5 relative z-10 animate-spin" />
        ) : isRecording ? (
          /* Stop square — SPLIT-ICON-02: use StopSquareIcon from icon registry */
          <StopSquareIcon className="w-3.5 h-3.5 relative z-10" />
        ) : (
          /* Microphone */
          <MicrophoneIcon className="w-4 h-4 relative z-10" />
        )}
      </button>

      {/* Inline status label */}
      {isTranscribing && (
        <span className="text-xs text-blue-500 dark:text-blue-400 animate-pulse whitespace-nowrap">
          {labelTranscribing}
        </span>
      )}
      {isRecording && useMediaRecorder && (
        <span className="text-xs text-red-500 dark:text-red-400 animate-pulse whitespace-nowrap">
          {labelRecording}
        </span>
      )}

      {/* Error tooltip */}
      {state === 'error' && errorMsg && (
        <span className="absolute left-full ml-2 whitespace-nowrap text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 px-2 py-1 rounded-md z-10">
          {errorMsg === 'network' ? t.voice_error_network : errorMsg}
        </span>
      )}
    </div>
  )
}
