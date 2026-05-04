import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DictionaryEntry } from '../../types'
import { useAppStore } from '../useAppStore'

function makeEntry(id: string, overrides: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    id,
    term: `Term ${id}`,
    normalizedTerm: `term ${id}`,
    sourceLang: 'en',
    targetLang: 'vi',
    provider: 'local',
    model: 'local-auto',
    createdAt: Date.now(),
    favorite: false,
    result: {
      headword: `Term ${id}`,
      pronunciation: '',
      partOfSpeech: ['noun'],
      meaning: `Meaning ${id}`,
      translations: [{ text: `Translation ${id}`, pronunciation: `Reading ${id}` }],
      examples: [],
      notes: [],
    },
    ...overrides,
  }
}

beforeEach(() => {
  act(() => {
    useAppStore.setState({ dictionaryEntries: [] })
  })
})

describe('dictionarySlice', () => {
  it('adds dictionary entries newest first', () => {
    act(() => {
      useAppStore.getState().addDictionaryEntry(makeEntry('old', { createdAt: 100 }))
      useAppStore.getState().addDictionaryEntry(makeEntry('new', { createdAt: 200 }))
    })

    expect(useAppStore.getState().dictionaryEntries.map((entry) => entry.id)).toEqual(['new', 'old'])
  })

  it('dedupes by normalized term, language pair, and context while preserving favorite', () => {
    act(() => {
      useAppStore.getState().addDictionaryEntry(makeEntry('first', {
        normalizedTerm: 'kufu',
        context: 'work',
        favorite: true,
        createdAt: 100,
      }))
      useAppStore.getState().addDictionaryEntry(makeEntry('second', {
        normalizedTerm: 'kufu',
        context: 'work',
        createdAt: 200,
        result: {
          headword: '工夫',
          pronunciation: 'くふう',
          partOfSpeech: ['noun'],
          meaning: 'Updated meaning',
          translations: [{ text: 'cải tiến', pronunciation: 'cải tiến' }],
          examples: [],
          notes: [],
        },
      }))
    })

    const entries = useAppStore.getState().dictionaryEntries
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: 'first',
      favorite: true,
      createdAt: 200,
      result: { meaning: 'Updated meaning' },
    })
  })

  it('toggles favorite and clears only non-favorite history', () => {
    act(() => {
      useAppStore.getState().addDictionaryEntry(makeEntry('keep'))
      useAppStore.getState().addDictionaryEntry(makeEntry('remove'))
      useAppStore.getState().toggleDictionaryFavorite('keep')
      useAppStore.getState().clearDictionaryHistory()
    })

    expect(useAppStore.getState().dictionaryEntries).toHaveLength(1)
    expect(useAppStore.getState().dictionaryEntries[0]).toMatchObject({ id: 'keep', favorite: true })
  })

  it('caps non-favorite history at 100 entries', () => {
    act(() => {
      for (let i = 0; i < 105; i++) {
        useAppStore.getState().addDictionaryEntry(makeEntry(String(i), { createdAt: i }))
      }
    })

    const entries = useAppStore.getState().dictionaryEntries
    expect(entries).toHaveLength(100)
    expect(entries[0].id).toBe('104')
    expect(entries.map((entry) => entry.id)).not.toContain('0')
  })

  it('deletes one dictionary entry', () => {
    act(() => {
      useAppStore.getState().addDictionaryEntry(makeEntry('delete'))
      useAppStore.getState().addDictionaryEntry(makeEntry('keep'))
      useAppStore.getState().deleteDictionaryEntry('delete')
    })

    expect(useAppStore.getState().dictionaryEntries.map((entry) => entry.id)).toEqual(['keep'])
  })
})
