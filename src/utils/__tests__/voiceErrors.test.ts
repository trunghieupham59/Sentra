import { describe, expect, it } from 'vitest'
import type { AudioTranscriptionErrorCode } from '../../types'
import { canResolveVoiceErrorInSettings, getVoiceNotificationTone } from '../voiceErrors'

describe('canResolveVoiceErrorInSettings', () => {
  it.each<AudioTranscriptionErrorCode>([
    'NO_API_KEY',
    'INVALID_KEY',
    'ALL_PROVIDERS_FAILED',
    'ALL_PROVIDERS_EXHAUSTED',
  ])('offers Settings for provider configuration error %s', (code) => {
    expect(canResolveVoiceErrorInSettings(code)).toBe(true)
  })

  it.each<AudioTranscriptionErrorCode>([
    'PERMISSION_DENIED',
    'AUDIO_TOO_SHORT',
    'NO_SPEECH',
    'CONNECTION_ERROR',
  ])('does not offer irrelevant app Settings for %s', (code) => {
    expect(canResolveVoiceErrorInSettings(code)).toBe(false)
  })

  it('uses warning emphasis only for recoverable no-speech outcomes', () => {
    expect(getVoiceNotificationTone('AUDIO_TOO_SHORT')).toBe('warning')
    expect(getVoiceNotificationTone('NO_SPEECH')).toBe('warning')
    expect(getVoiceNotificationTone('PERMISSION_DENIED')).toBe('error')
  })
})
