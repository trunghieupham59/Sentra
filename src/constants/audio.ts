/**
 * Shared audio-capture constants used by multiple modules.
 * Single source of truth — import from here instead of duplicating.
 */

/** Capture in short slices so the renderer can enforce its byte budget while recording. */
export const DICTATION_RECORDER_TIMESLICE_MS = 1_000

/** Dictation is intentionally bounded; longer continuous audio belongs to Live Translate. */
export const DICTATION_MAX_RECORDING_MS = 2 * 60 * 1_000

/** Stay below the Main-process 10 MiB validation limit to leave serialization headroom. */
export const DICTATION_MAX_AUDIO_BYTES = 9 * 1024 * 1024

/** Tiny captures are not useful speech and should never consume a provider request. */
export const DICTATION_MIN_AUDIO_BYTES = 1_000

/** Browser capture hints tuned for a single-speaker dictation control. */
export const DICTATION_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

let fallbackRequestSequence = 0

/**
 * Generate an opaque correlation ID without assuming `crypto.randomUUID` exists
 * in every Electron test/web-preview environment.
 */
export function createAudioTranscriptionRequestId(): string {
  const browserCrypto = globalThis.crypto
  if (typeof browserCrypto?.randomUUID === 'function') {
    return browserCrypto.randomUUID()
  }

  fallbackRequestSequence += 1
  const randomParts = new Uint32Array(4)
  if (typeof browserCrypto?.getRandomValues === 'function') {
    browserCrypto.getRandomValues(randomParts)
  } else {
    for (let index = 0; index < randomParts.length; index += 1) {
      randomParts[index] = Math.floor(Math.random() * 0x1_0000_0000)
    }
  }

  const entropy = Array.from(randomParts, (part) => part.toString(16).padStart(8, '0')).join('')
  return `audio-${Date.now().toString(36)}-${fallbackRequestSequence.toString(36)}-${entropy}`
}

/**
 * Returns the first MIME type supported by MediaRecorder in this browser.
 * Falls back to empty string (browser default) if none match.
 */
export function getSupportedAudioMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}
