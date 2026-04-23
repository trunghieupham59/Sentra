/**
 * Unit tests for src/store/slices/settingsSlice.ts
 *
 * Tests cover all settings actions independently via the real Zustand store.
 */

import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../useAppStore'

// Reset settings slice state before each test
// Explicitly reset all provider-keyed maps to avoid cross-test state leakage.
beforeEach(() => {
  act(() => {
    useAppStore.setState({
      locale: 'en',
      localeAuto: true,
      autoTranslate: false,
      autoTranslateDelay: 500,
      showFurigana: false,
      translationStyle: 'neutral',
      ttsVoice: 'nova',
      fontSize: 'medium',
      keyStatus: { gemini: false, claude: false, openai: false } as Record<string, boolean>,
      dynamicModels: { gemini: [], claude: [], openai: [] } as Record<string, []>,
      modelsLoading: { gemini: false, claude: false, openai: false } as Record<string, boolean>,
      modelsError: { gemini: null, claude: null, openai: null } as Record<string, null>,
    })
  })
})

// ── Locale ────────────────────────────────────────────────────────────────────

describe('setLocale', () => {
  it('sets locale and disables localeAuto', () => {
    act(() => useAppStore.getState().setLocale('vi'))
    const state = useAppStore.getState()
    expect(state.locale).toBe('vi')
    expect(state.localeAuto).toBe(false)
  })

  it('switching locale to ja disables auto-follow', () => {
    act(() => useAppStore.getState().setLocale('ja'))
    expect(useAppStore.getState().locale).toBe('ja')
    expect(useAppStore.getState().localeAuto).toBe(false)
  })
})

describe('setLocaleFromSystem', () => {
  it('sets locale WITHOUT changing localeAuto', () => {
    act(() => {
      useAppStore.setState({ localeAuto: true })
      useAppStore.getState().setLocaleFromSystem('vi')
    })
    const state = useAppStore.getState()
    expect(state.locale).toBe('vi')
    expect(state.localeAuto).toBe(true) // unchanged
  })
})

describe('setLocaleAuto', () => {
  it('can disable localeAuto', () => {
    act(() => useAppStore.getState().setLocaleAuto(false))
    expect(useAppStore.getState().localeAuto).toBe(false)
  })

  it('can re-enable localeAuto', () => {
    act(() => {
      useAppStore.getState().setLocaleAuto(false)
      useAppStore.getState().setLocaleAuto(true)
    })
    expect(useAppStore.getState().localeAuto).toBe(true)
  })
})

// ── UI preferences ────────────────────────────────────────────────────────────

describe('setAutoTranslate', () => {
  it('enables auto-translate', () => {
    act(() => useAppStore.getState().setAutoTranslate(true))
    expect(useAppStore.getState().autoTranslate).toBe(true)
  })

  it('disables auto-translate', () => {
    act(() => {
      useAppStore.getState().setAutoTranslate(true)
      useAppStore.getState().setAutoTranslate(false)
    })
    expect(useAppStore.getState().autoTranslate).toBe(false)
  })
})

describe('setAutoTranslateDelay', () => {
  it('sets delay in milliseconds', () => {
    act(() => useAppStore.getState().setAutoTranslateDelay(1000))
    expect(useAppStore.getState().autoTranslateDelay).toBe(1000)
  })

  it('accepts zero delay', () => {
    act(() => useAppStore.getState().setAutoTranslateDelay(0))
    expect(useAppStore.getState().autoTranslateDelay).toBe(0)
  })
})

describe('setShowFurigana', () => {
  it('enables furigana display', () => {
    act(() => useAppStore.getState().setShowFurigana(true))
    expect(useAppStore.getState().showFurigana).toBe(true)
  })

  it('disables furigana display', () => {
    act(() => {
      useAppStore.getState().setShowFurigana(true)
      useAppStore.getState().setShowFurigana(false)
    })
    expect(useAppStore.getState().showFurigana).toBe(false)
  })
})

describe('setTranslationStyle', () => {
  it('sets style to friendly', () => {
    act(() => useAppStore.getState().setTranslationStyle('friendly'))
    expect(useAppStore.getState().translationStyle).toBe('friendly')
  })

  it('sets style to technical', () => {
    act(() => useAppStore.getState().setTranslationStyle('technical'))
    expect(useAppStore.getState().translationStyle).toBe('technical')
  })

  it('sets style to professional', () => {
    act(() => useAppStore.getState().setTranslationStyle('professional'))
    expect(useAppStore.getState().translationStyle).toBe('professional')
  })
})

describe('setTtsVoice', () => {
  it('sets TTS voice to alloy', () => {
    act(() => useAppStore.getState().setTtsVoice('alloy'))
    expect(useAppStore.getState().ttsVoice).toBe('alloy')
  })

  it('sets TTS voice to shimmer', () => {
    act(() => useAppStore.getState().setTtsVoice('shimmer'))
    expect(useAppStore.getState().ttsVoice).toBe('shimmer')
  })
})

describe('setFontSize', () => {
  it('sets fontSize to small', () => {
    act(() => useAppStore.getState().setFontSize('small'))
    expect(useAppStore.getState().fontSize).toBe('small')
  })

  it('sets fontSize to large', () => {
    act(() => useAppStore.getState().setFontSize('large'))
    expect(useAppStore.getState().fontSize).toBe('large')
  })
})

// ── Provider / key status ─────────────────────────────────────────────────────

describe('setKeyStatus', () => {
  it('marks gemini as having a key', () => {
    act(() => useAppStore.getState().setKeyStatus('gemini', true))
    expect(useAppStore.getState().keyStatus.gemini).toBe(true)
  })

  it('marks openai as NOT having a key', () => {
    act(() => {
      useAppStore.getState().setKeyStatus('openai', true)
      useAppStore.getState().setKeyStatus('openai', false)
    })
    expect(useAppStore.getState().keyStatus.openai).toBe(false)
  })

  it('updating one provider does not affect others', () => {
    act(() => {
      useAppStore.getState().setKeyStatus('gemini', true)
      useAppStore.getState().setKeyStatus('claude', true)
    })
    const { keyStatus } = useAppStore.getState()
    expect(keyStatus.gemini).toBe(true)
    expect(keyStatus.claude).toBe(true)
    expect(keyStatus.openai).toBe(false) // untouched
  })
})

describe('setDynamicModels', () => {
  it('sets dynamic models for a provider', () => {
    const models = [{ id: 'gpt-4o', name: 'GPT-4o', description: '' }]
    act(() => useAppStore.getState().setDynamicModels('openai', models))
    expect(useAppStore.getState().dynamicModels.openai).toEqual(models)
  })

  it('updating one provider does not affect others', () => {
    const geminiModels = [{ id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '' }]
    act(() => useAppStore.getState().setDynamicModels('gemini', geminiModels))
    expect(useAppStore.getState().dynamicModels.openai).toEqual([]) // untouched
    expect(useAppStore.getState().dynamicModels.gemini).toEqual(geminiModels)
  })
})

describe('setModelsLoading', () => {
  it('sets loading state to true for a provider', () => {
    act(() => useAppStore.getState().setModelsLoading('gemini', true))
    expect(useAppStore.getState().modelsLoading.gemini).toBe(true)
  })

  it('resets loading state to false', () => {
    act(() => {
      useAppStore.getState().setModelsLoading('gemini', true)
      useAppStore.getState().setModelsLoading('gemini', false)
    })
    expect(useAppStore.getState().modelsLoading.gemini).toBe(false)
  })
})

describe('setModelsError', () => {
  it('sets an error message for a provider', () => {
    act(() => useAppStore.getState().setModelsError('openai', 'Network error'))
    expect(useAppStore.getState().modelsError.openai).toBe('Network error')
  })

  it('clears error by setting null', () => {
    act(() => {
      useAppStore.getState().setModelsError('openai', 'Network error')
      useAppStore.getState().setModelsError('openai', null)
    })
    expect(useAppStore.getState().modelsError.openai).toBeNull()
  })

  it('updating one provider error does not affect others', () => {
    act(() => useAppStore.getState().setModelsError('gemini', 'Rate limit'))
    expect(useAppStore.getState().modelsError.openai).toBeNull()
    expect(useAppStore.getState().modelsError.gemini).toBe('Rate limit')
  })
})
