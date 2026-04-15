export type { AppLocale, Translations } from './types'

import type { AppLocale, Translations } from './types'
import en from './locales/en'
import vi from './locales/vi'
import ja from './locales/ja'

export const TRANSLATIONS: Record<AppLocale, Translations> = { en, vi, ja }

export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
  ja: '日本語',
}
