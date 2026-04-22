/**
 * Language code → English name mapping for AI prompts.
 *
 * DUP-01: Single source of truth replacing two separate LANG_NAMES constants in:
 *   - src/hooks/useLiveTranslate.ts (for AI translation prompts)
 *   - electron/ipc/imageTranslate.ts (for image translation prompts)
 *
 * NOTE: electron/ipc/imageTranslate.ts cannot import from src/ due to separate
 * tsconfig.electron.json build target. That file keeps its own copy but should
 * be kept in sync with this file when adding new languages.
 *
 * Usage (renderer side):
 *   import { LANG_NAMES_FOR_AI } from '../constants/langNames'
 */
export const LANG_NAMES_FOR_AI: Record<string, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  ar: 'Arabic',
  th: 'Thai',
  id: 'Indonesian',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  hi: 'Hindi',
}
