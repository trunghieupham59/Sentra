/**
 * useTTS — Text-to-Speech custom hook
 *
 * Extracted from TranslatePage.tsx (was a 110-line inline function).
 * Handles:
 *   - Web Audio API (primary — supports MP3, WAV, OGG, PCM)
 *   - Backend TTS routing (Edge TTS for free mode, API providers for paid modes)
 *   - Toggle off when already speaking
 *
 * Usage:
 *   const { speakingPanel, speakLoading, handleSpeak, stopSpeak } = useTTS({ ttsMode, ttsVoice })
 *   <button onClick={() => handleSpeak(text, lang, 'translated')} />
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TtsMode, TtsVoice } from '../types'

/** Tốc độ phát audio TTS — thấp hơn 1.0 để dễ nghe hơn */
const TTS_PLAYBACK_RATE = 0.9

export type SpeakPanel = 'source' | 'translated'

interface UseTTSOptions {
  ttsMode: TtsMode
  ttsVoice: TtsVoice
}

interface UseTTSReturn {
  speakingPanel: SpeakPanel | null
  speakLoading: boolean
  handleSpeak: (text: string, lang: string, panel: SpeakPanel) => Promise<void>
  stopSpeak: () => void
}

export function useTTS({ ttsMode, ttsVoice }: UseTTSOptions): UseTTSReturn {
  const [speakingPanel, setSpeakingPanel] = useState<SpeakPanel | null>(null)
  const [speakLoading, setSpeakLoading] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const playbackGenerationRef = useRef(0)

  const stopAudio = useCallback((updateState: boolean) => {
    playbackGenerationRef.current++
    const source = audioSourceRef.current
    audioSourceRef.current = null
    try { source?.stop() } catch { /* node may already be stopped */ }
    try { source?.disconnect() } catch { /* node may not be connected */ }
    if (updateState) {
      setSpeakingPanel(null)
      setSpeakLoading(false)
    }
  }, [])

  const stopSpeak = useCallback(() => stopAudio(true), [stopAudio])

  useEffect(() => () => {
    stopAudio(false)
    const audioContext = audioCtxRef.current
    audioCtxRef.current = null
    if (
      audioContext
      && audioContext.state !== 'closed'
      && typeof audioContext.close === 'function'
    ) {
      void audioContext.close()
    }
  }, [stopAudio])

  const handleSpeak = useCallback(async (
    text: string,
    lang: string,
    panel: SpeakPanel,
  ) => {
    // Toggle off if already speaking this panel
    if (speakingPanel === panel || speakLoading) {
      stopSpeak()
      return
    }
    stopSpeak()
    const playbackGeneration = playbackGenerationRef.current
    setSpeakingPanel(panel)

    // Unlock / create AudioContext BEFORE the first await (must stay in user-gesture context)
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext()
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume()
      }
      if (playbackGenerationRef.current !== playbackGeneration) return
    } catch {
      if (playbackGenerationRef.current === playbackGeneration) setSpeakingPanel(null)
      return
    }

    // ── Backend TTS: Edge/API routing is selected by the main process mode ──
    try {
      setSpeakLoading(true)
      const result = await window.api.speakText({ text, voice: ttsVoice, mode: ttsMode, lang })
      if (playbackGenerationRef.current !== playbackGeneration) return
      setSpeakLoading(false)

      if (result.success && result.audioBase64) {
        const audioCtx = audioCtxRef.current
        if (!audioCtx || audioCtx.state === 'closed') {
          setSpeakingPanel(null)
          return
        }

        // Decode base64 → ArrayBuffer
        const binaryStr = atob(result.audioBase64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)

        let audioBuffer: AudioBuffer
        try {
          // decodeAudioData supports MP3, WAV, OGG, AAC, FLAC
          audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0))
        } catch {
          if (playbackGenerationRef.current !== playbackGeneration) return
          // Gemini may return raw PCM (audio/pcm;rate=24000) — decode manually
          if (result.mimeType?.includes('pcm') || result.mimeType?.includes('l16')) {
            const rateMatch = result.mimeType.match(/rate=(\d+)/)
            const sampleRate = rateMatch ? Number.parseInt(rateMatch[1], 10) : 24000
            const numSamples = bytes.length / 2
            audioBuffer = audioCtx.createBuffer(1, numSamples, sampleRate)
            const channel = audioBuffer.getChannelData(0)
            const view = new DataView(bytes.buffer)
            for (let i = 0; i < numSamples; i++) {
              channel[i] = view.getInt16(i * 2, true) / 32768
            }
          } else {
            setSpeakingPanel(null)
            return
          }
        }

        if (playbackGenerationRef.current !== playbackGeneration) return

        const source = audioCtx.createBufferSource()
        source.buffer = audioBuffer
        source.playbackRate.value = TTS_PLAYBACK_RATE // slightly slower for comprehension
        source.connect(audioCtx.destination)
        source.onended = () => {
          if (
            audioSourceRef.current !== source
            || playbackGenerationRef.current !== playbackGeneration
          ) return
          audioSourceRef.current = null
          setSpeakingPanel(null)
        }
        audioSourceRef.current = source
        source.start(0)
        return
      }

      setSpeakingPanel(null)
    } catch {
      if (playbackGenerationRef.current === playbackGeneration) {
        setSpeakLoading(false)
        setSpeakingPanel(null)
      }
    }
  }, [speakingPanel, speakLoading, ttsMode, ttsVoice, stopSpeak])

  return { speakingPanel, speakLoading, handleSpeak, stopSpeak }
}
