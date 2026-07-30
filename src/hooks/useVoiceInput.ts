/**
 * useVoiceInput — shared hook for voice recording & transcript handling.
 *
 * Extracted from TranslatePage.tsx and ChatPage.tsx which had near-identical
 * voice recording logic. Centralises:
 *   - `isVoiceActive` / `isVoiceInterim` UI state
 *   - `voicePrefixRef` — captures text already in the field before recording starts
 *                         so that voice appends rather than replaces
 *   - `handleVoiceRecordingChange` — called by VoiceRecorder on start/stop
 *   - `handleVoiceTranscript`      — called by VoiceRecorder on each transcript chunk
 *   - `cancelVoiceInput`           — restores the text captured before recording
 *   - `resetVoicePrefix`           — call when user manually edits the field mid-recording
 *
 * Usage:
 *   const { isVoiceActive, isVoiceInterim, handleVoiceRecordingChange,
 *           handleVoiceTranscript, resetVoicePrefix } = useVoiceInput({
 *     currentText: inputText,
 *     onTextChange: setInputText,
 *   })
 */
import { useCallback, useRef, useState } from 'react'

interface UseVoiceInputOptions {
  /** Current value of the text field (used to build the prefix when recording starts). */
  currentText: string
  /** Callback to update the text field with the combined prefix + transcript. */
  onTextChange: (text: string) => void
}

interface UseVoiceInputReturn {
  isVoiceActive: boolean
  isVoiceInterim: boolean
  voicePrefixRef: React.MutableRefObject<string>
  handleVoiceRecordingChange: (recording: boolean) => void
  handleVoiceTranscript: (transcript: string, isFinal: boolean) => void
  /** Restore the text that existed before recording started. */
  cancelVoiceInput: () => void
  /**
   * Reset the voice prefix to empty. Call this when the user manually edits the
   * text field while voice recording is active — subsequent transcript chunks
   * should replace the field value, not append to stale prefix content.
   */
  resetVoicePrefix: () => void
}

export function useVoiceInput({
  currentText,
  onTextChange,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isVoiceActive, setIsVoiceActive] = useState(false)
  const [isVoiceInterim, setIsVoiceInterim] = useState(false)

  /**
   * Captures the text that was already in the field when recording started.
   * Voice transcript is appended after this prefix so the user doesn't lose
   * what they'd typed before hitting the microphone button.
   */
  const voicePrefixRef = useRef('')
  /** Exact pre-recording value, including intentional trailing spaces/newlines. */
  const voiceOriginalTextRef = useRef('')
  if (!isVoiceActive) voiceOriginalTextRef.current = currentText

  const handleVoiceRecordingChange = useCallback(
    (recording: boolean) => {
      if (recording) {
        voiceOriginalTextRef.current = currentText
        // Add a separator only when the existing draft does not already provide one.
        voicePrefixRef.current = currentText && !/\s$/u.test(currentText)
          ? `${currentText} `
          : currentText
        setIsVoiceActive(true)
      } else {
        setIsVoiceActive(false)
        setIsVoiceInterim(false)
      }
    },
    [currentText],
  )

  const handleVoiceTranscript = useCallback(
    (transcript: string, isFinal: boolean) => {
      onTextChange(voicePrefixRef.current + transcript)
      setIsVoiceInterim(!isFinal)
    },
    [onTextChange],
  )

  const cancelVoiceInput = useCallback(() => {
    onTextChange(voiceOriginalTextRef.current)
    setIsVoiceActive(false)
    setIsVoiceInterim(false)
  }, [onTextChange])

  const resetVoicePrefix = useCallback(() => {
    voicePrefixRef.current = ''
  }, [])

  return {
    isVoiceActive,
    isVoiceInterim,
    voicePrefixRef,
    handleVoiceRecordingChange,
    handleVoiceTranscript,
    cancelVoiceInput,
    resetVoicePrefix,
  }
}
