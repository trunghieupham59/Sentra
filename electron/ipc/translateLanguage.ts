const KNOWN_LANG_CODES = ['vi', 'en', 'zh', 'zh-tw', 'ja', 'ko', 'fr', 'de', 'es', 'pt', 'ru', 'ar', 'th', 'id', 'it', 'nl', 'pl', 'tr', 'hi']

export function normalizeDetectedLang(raw: string): string | null {
  const cleaned = raw.toLowerCase().replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/\s+/g, '-')
  if (KNOWN_LANG_CODES.includes(cleaned)) {
    if (cleaned === 'zh-tw') return 'zh-TW'
    return cleaned
  }

  const partial = KNOWN_LANG_CODES.find(l => cleaned.startsWith(l) || l.startsWith(cleaned))
  if (partial) return partial === 'zh-tw' ? 'zh-TW' : partial
  return null
}
