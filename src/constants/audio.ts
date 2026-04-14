/**
 * Shared audio / language constants used by multiple modules.
 * Single source of truth — import from here instead of duplicating.
 */

/** Map app language codes → BCP-47 tags understood by SpeechSynthesis and MediaRecorder APIs */
export const LANG_TO_BCP47: Record<string, string> = {
  auto: 'en-US',
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-PT',
  ru: 'ru-RU',
  ar: 'ar-SA',
  th: 'th-TH',
  id: 'id-ID',
  it: 'it-IT',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  hi: 'hi-IN',
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
