import type { AudioTranscriptionErrorCode } from '../types'

const SETTINGS_ACTIONABLE_VOICE_ERRORS = new Set<AudioTranscriptionErrorCode>([
  'NO_API_KEY',
  'INVALID_KEY',
  'ALL_PROVIDERS_FAILED',
  'ALL_PROVIDERS_EXHAUSTED',
])

/** App Settings can resolve only provider-configuration failures. */
export function canResolveVoiceErrorInSettings(code: AudioTranscriptionErrorCode): boolean {
  return SETTINGS_ACTIONABLE_VOICE_ERRORS.has(code)
}

/** No-speech outcomes need guidance, not destructive/error emphasis. */
export function getVoiceNotificationTone(
  code: AudioTranscriptionErrorCode,
): 'warning' | 'error' {
  return code === 'AUDIO_TOO_SHORT' || code === 'NO_SPEECH' ? 'warning' : 'error'
}
