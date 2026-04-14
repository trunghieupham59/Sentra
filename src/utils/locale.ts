/**
 * Locale utilities — single source of truth for supported locales
 * and system locale detection.
 *
 * Extracted from App.tsx and SettingsPage.tsx (was duplicated in both).
 */
import type { AppLocale } from '../i18n'

/** All locales the application supports. Add new entries here when adding a new UI language. */
export const SUPPORTED_LOCALES: AppLocale[] = ['en', 'vi', 'ja']

/**
 * Detect the best matching AppLocale from the browser/OS language setting.
 * Falls back to 'en' when the system language is not in SUPPORTED_LOCALES.
 */
export function detectSystemLocale(): AppLocale {
  const lang = (navigator.language || 'en').split('-')[0]
  return SUPPORTED_LOCALES.includes(lang as AppLocale) ? (lang as AppLocale) : 'en'
}
