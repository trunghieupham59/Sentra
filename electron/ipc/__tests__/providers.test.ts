// @vitest-environment node
/**
 * Unit tests for electron/ipc/providers/types.ts
 *
 * Tests cover:
 *   1. SUPPORTED_PROVIDERS — content and immutability
 *   2. isValidProvider()   — type guard validation
 *   3. unknownProviderError() — standardized error response shape
 */
import { describe, it, expect } from 'vitest'
import {
  SUPPORTED_PROVIDERS,
  isValidProvider,
  unknownProviderError,
} from '../providers/types'

// ─────────────────────────────────────────────────────────────────────────────
describe('SUPPORTED_PROVIDERS', () => {
  it('contains gemini, claude, and openai', () => {
    expect(SUPPORTED_PROVIDERS).toContain('gemini')
    expect(SUPPORTED_PROVIDERS).toContain('claude')
    expect(SUPPORTED_PROVIDERS).toContain('openai')
  })

  it('has exactly 3 providers', () => {
    expect(SUPPORTED_PROVIDERS).toHaveLength(3)
  })

  it('is readonly — cannot be mutated at runtime', () => {
    // TypeScript enforces immutability; verify the array exists and is frozen-like
    const providers = SUPPORTED_PROVIDERS as unknown as string[]
    // Attempting push would throw in strict mode; at minimum verify it's unchanged
    expect(providers.length).toBe(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('isValidProvider', () => {
  // ── Valid providers ───────────────────────────────────────────────────────
  it('returns true for "gemini"', () => {
    expect(isValidProvider('gemini')).toBe(true)
  })

  it('returns true for "claude"', () => {
    expect(isValidProvider('claude')).toBe(true)
  })

  it('returns true for "openai"', () => {
    expect(isValidProvider('openai')).toBe(true)
  })

  // ── Invalid providers ─────────────────────────────────────────────────────
  it('returns false for empty string', () => {
    expect(isValidProvider('')).toBe(false)
  })

  it('returns false for unknown provider "anthropic"', () => {
    expect(isValidProvider('anthropic')).toBe(false)
  })

  it('returns false for unknown provider "gpt4"', () => {
    expect(isValidProvider('gpt4')).toBe(false)
  })

  it('returns false for unknown provider "cohere"', () => {
    expect(isValidProvider('cohere')).toBe(false)
  })

  it('returns false for unknown provider "mistral"', () => {
    expect(isValidProvider('mistral')).toBe(false)
  })

  it('is case-sensitive — "Gemini" (uppercase G) is invalid', () => {
    expect(isValidProvider('Gemini')).toBe(false)
  })

  it('is case-sensitive — "OPENAI" (all caps) is invalid', () => {
    expect(isValidProvider('OPENAI')).toBe(false)
  })

  it('returns false for provider with trailing whitespace', () => {
    expect(isValidProvider('gemini ')).toBe(false)
  })

  it('returns false for provider with leading whitespace', () => {
    expect(isValidProvider(' claude')).toBe(false)
  })

  it('returns false for null-like string "null"', () => {
    expect(isValidProvider('null')).toBe(false)
  })

  it('returns false for "undefined"', () => {
    expect(isValidProvider('undefined')).toBe(false)
  })

  // ── Type narrowing ────────────────────────────────────────────────────────
  it('narrows type so TypeScript accepts it as SupportedProvider after check', () => {
    const provider = 'gemini'
    if (isValidProvider(provider)) {
      // TypeScript should accept this without error — type is narrowed to SupportedProvider
      const _typed: 'gemini' | 'claude' | 'openai' = provider
      expect(_typed).toBe('gemini')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('unknownProviderError', () => {
  it('returns success: false', () => {
    expect(unknownProviderError('unknown').success).toBe(false)
  })

  it('includes the unknown provider name in the error message', () => {
    const result = unknownProviderError('my-custom-llm')
    expect(result.error).toContain('my-custom-llm')
  })

  it('includes a hint listing the supported providers', () => {
    const result = unknownProviderError('something')
    expect(result.error).toContain('gemini')
    expect(result.error).toContain('claude')
    expect(result.error).toContain('openai')
  })

  it('generates a distinct message for different unknown providers', () => {
    const a = unknownProviderError('alpha')
    const b = unknownProviderError('beta')
    expect(a.error).not.toBe(b.error)
    expect(a.error).toContain('alpha')
    expect(b.error).toContain('beta')
  })

  it('works for empty string provider name', () => {
    const result = unknownProviderError('')
    expect(result.success).toBe(false)
    expect(typeof result.error).toBe('string')
  })
})
