/**
 * WAV encoder utility for Silero VAD output.
 *
 * Silero VAD (`@ricky0123/vad-web`) delivers speech segments as raw Float32Array
 * PCM samples at 16 kHz mono.  The OpenAI Whisper API requires an audio file
 * (wav / webm / mp4 / ogg).  This module converts the raw samples to a valid
 * WAV Blob so processChunk can pass it directly to Whisper without any additional
 * encoding step.
 *
 * Format written: RIFF PCM, 16-bit signed little-endian, mono, 16 000 Hz.
 * This is the native input format Whisper was trained on, so no resampling
 * is performed — the samples arrive from Silero already at 16 kHz.
 */

/**
 * Encode a Float32Array of mono PCM samples into a WAV Blob.
 *
 * @param samples    Raw audio samples in the [-1.0, 1.0] range.
 *                   Silero VAD always outputs 16 kHz mono PCM in this range.
 * @param sampleRate Sample rate of the input (default 16 000 Hz).
 * @returns          A `Blob` with MIME type `'audio/wav'` ready to send to Whisper.
 */
export function float32ToWav(samples: Float32Array, sampleRate = 16_000): Blob {
  const numChannels  = 1
  const bitsPerSample = 16
  const byteRate     = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign   = numChannels * (bitsPerSample / 8)
  const dataLength   = samples.length * (bitsPerSample / 8)

  // 44-byte WAV header + PCM data
  const buffer = new ArrayBuffer(44 + dataLength)
  const view   = new DataView(buffer)

  // ── RIFF chunk descriptor ──────────────────────────────────────────────────
  _writeString(view,  0, 'RIFF')
  view.setUint32(4,  36 + dataLength, true)   // ChunkSize
  _writeString(view,  8, 'WAVE')

  // ── fmt sub-chunk ──────────────────────────────────────────────────────────
  _writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)                // SubchunkSize = 16 for PCM
  view.setUint16(20,  1, true)                // AudioFormat  = 1 (PCM, no compression)
  view.setUint16(22, numChannels,   true)
  view.setUint32(24, sampleRate,    true)
  view.setUint32(28, byteRate,      true)
  view.setUint16(32, blockAlign,    true)
  view.setUint16(34, bitsPerSample, true)

  // ── data sub-chunk ─────────────────────────────────────────────────────────
  _writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // Convert float32 [-1, 1] → int16 and write sample by sample
  const offset = 44
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    // Asymmetric mapping preserves full 16-bit range for both polarities
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF
    view.setInt16(offset + i * 2, int16, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

/** Write an ASCII string byte-by-byte into a DataView at the given offset. */
function _writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
