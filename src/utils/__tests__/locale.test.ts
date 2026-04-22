import { afterEach, describe, expect, it } from 'vitest'
import { detectSystemLocale, SUPPORTED_LOCALES } from '../locale'

describe('SUPPORTED_LOCALES', () => {
  it('contains exactly en, vi, ja', () => {
    expect(SUPPORTED_LOCALES).toContain('en')
    expect(SUPPORTED_LOCALES).toContain('vi')
    expect(SUPPORTED_LOCALES).toContain('ja')
    expect(SUPPORTED_LOCALES).toHaveLength(3)
  })
})

describe('detectSystemLocale', () => {
  const originalNavigatorLanguage = Object.getOwnPropertyDescriptor(navigator, 'language')

  afterEach(() => {
    // Restore original language after each test
    if (originalNavigatorLanguage) {
      Object.defineProperty(navigator, 'language', originalNavigatorLanguage)
    }
  })

  const setLanguage = (lang: string) => {
    Object.defineProperty(navigator, 'language', {
      value: lang,
      configurable: true,
      writable: true,
    })
  }

  it('detects Vietnamese (vi-VN → vi)', () => {
    setLanguage('vi-VN')
    expect(detectSystemLocale()).toBe('vi')
  })

  it('detects Vietnamese (vi → vi)', () => {
    setLanguage('vi')
    expect(detectSystemLocale()).toBe('vi')
  })

  it('detects Japanese (ja-JP → ja)', () => {
    setLanguage('ja-JP')
    expect(detectSystemLocale()).toBe('ja')
  })

  it('detects English (en-US → en)', () => {
    setLanguage('en-US')
    expect(detectSystemLocale()).toBe('en')
  })

  it('detects English (en-GB → en)', () => {
    setLanguage('en-GB')
    expect(detectSystemLocale()).toBe('en')
  })

  it('falls back to English for unsupported locale (fr-FR)', () => {
    setLanguage('fr-FR')
    expect(detectSystemLocale()).toBe('en')
  })

  it('falls back to English for unsupported locale (zh-CN)', () => {
    setLanguage('zh-CN')
    expect(detectSystemLocale()).toBe('en')
  })

  it('falls back to English for unsupported locale (ko)', () => {
    setLanguage('ko')
    expect(detectSystemLocale()).toBe('en')
  })
})
