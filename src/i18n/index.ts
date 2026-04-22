export type { AppLocale, Translations } from './types'

import en from './locales/en'
import ja from './locales/ja'
import vi from './locales/vi'
import type { AppLocale, Translations } from './types'

export const TRANSLATIONS: Record<AppLocale, Translations> = { en, vi, ja }

export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  ja: '日本語',
}
