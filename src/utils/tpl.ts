import type { AppLocale } from '../i18n'

/**
 * Simple template helper — replaces {key} placeholders with values.
 * Usage: tpl('Hello {name}!', { name: 'World' }) → 'Hello World!'
 */
export function tpl(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

/** Map app locale → browser locale string cho toLocaleDateString */
const LOCALE_TO_BCP47: Record<string, string> = {
  vi: 'vi-VN', en: 'en-US', ja: 'ja-JP',
}

/** Format date theo app locale hiện tại */
export function formatDate(ts: number, locale: AppLocale): string {
  const bcp47 = LOCALE_TO_BCP47[locale] ?? 'en-US'
  return new Date(ts).toLocaleDateString(bcp47, { day: '2-digit', month: '2-digit', year: 'numeric' })
}
