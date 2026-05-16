/**
 * SPEAKER_COLORS — rotating Tailwind color classes for speaker badges.
 * Shared across SegmentRow, TranslationRow, and SpeakerAnalysisText.
 */
export const SPEAKER_COLORS = [
  'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
  'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
]

/**
 * Resolve a Tailwind color class for a speaker label like "Speaker 3".
 * Falls back to index 0 when the label has no trailing digits (e.g. legacy
 * data) — Number('') is NaN and would otherwise read SPEAKER_COLORS[NaN] = undefined.
 */
export function getSpeakerColorClass(speaker: string): string {
  const digits = speaker.replace(/\D/g, '')
  const n = digits ? Number(digits) : 1
  const idx = Number.isFinite(n) && n > 0 ? (n - 1) % SPEAKER_COLORS.length : 0
  return SPEAKER_COLORS[idx]
}
