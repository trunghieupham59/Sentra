import { TARGET_LANGUAGES } from '../../constants/providers'

function scoreLang(
  code: string,
  langUsage: Record<string, { count: number; lastUsed: number }>,
  now: number,
): number {
  const u = langUsage[code]
  if (!u) return 0
  const hrs = (now - u.lastUsed) / 3_600_000
  const recency = hrs < 1 ? 5 : hrs < 24 ? 3 : hrs < 168 ? 1 : 0
  return u.count + recency * 2
}

/**
 * Return the smartest N language codes to show as quick-access pills.
 * - Sorts by score (usage count × recency bonus), with alphabetical tiebreak
 * - Initial state (no usage): first N alphabetically
 * - Ensures the currently-selected language is always visible
 */
export function getSmartTopLangs(
  langUsage: Record<string, { count: number; lastUsed: number }>,
  currentLang: string,
  n = 3,
): string[] {
  const now = Date.now()

  const scored = TARGET_LANGUAGES.map((l) => ({
    code: l.code,
    score: scoreLang(l.code, langUsage, now),
  })).sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))

  const top = scored.slice(0, n).map((s) => s.code)

  // Pin currently-selected lang into last slot if absent
  if (currentLang && currentLang !== 'auto' && !top.includes(currentLang)) {
    top[n - 1] = currentLang
  }

  return top
}
