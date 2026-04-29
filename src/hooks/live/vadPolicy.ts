export interface VadParams {
  speechRmsThreshold: number
  peakRmsThreshold: number
  minSpeechSamples: number
  hangoverSamples: number
}

export type LiveAudioMode = 'mic' | 'system' | 'both'

export function getInitialVadPolicy(mode: LiveAudioMode): VadParams {
  switch (mode) {
    case 'system':
      return { speechRmsThreshold: 10, peakRmsThreshold: 18, minSpeechSamples: 3, hangoverSamples: 6 }
    case 'both':
      return { speechRmsThreshold: 9, peakRmsThreshold: 16, minSpeechSamples: 2, hangoverSamples: 5 }
    default:
      return { speechRmsThreshold: 8, peakRmsThreshold: 15, minSpeechSamples: 2, hangoverSamples: 5 }
  }
}

export const VAD_SAMPLE_INTERVAL = 80
export const VAD_MAX_HANGOVER_SAMPLES = 8
export const VAD_FLIP_RATE_HIGH = 10
export const VAD_FLIP_RATE_LOW = 3

export const MIN_CHUNK_RECORD_MS = 300
export const MAX_WORDS_PER_CHUNK = 60
export const MAX_WORDS_PER_SEC = 15
export const SILENCE_RESET_CHUNKS = 10

export const NO_SPEECH_PROB_MAX = 0.90
export const AVG_LOGPROB_MIN = -2.0
export const COMPRESSION_RATIO_MAX = 3.5

export const MIC_GAIN = 4.0
export const SYSTEM_AUD_GAIN = 2.0

export const MAX_RAW_TRANSCRIPT_CHARS = 50_000
export const CHUNK_MAX_QUEUE_AGE_MS = 4_000

export const ADAPTIVE_VAD_MIN_CHUNKS = 6
export const ADAPTIVE_VAD_DISCARD_THRESHOLD = 0.40
export const ADAPTIVE_VAD_EVAL_WINDOW = 12

