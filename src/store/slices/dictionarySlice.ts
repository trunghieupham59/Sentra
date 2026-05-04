/**
 * dictionarySlice — persisted dictionary lookup history and favorites.
 */
import type { DictionaryEntry } from '../../types'
import type { SliceSet } from './sliceTypes'

const MAX_NON_FAVORITE_DICTIONARY_HISTORY = 100

function sameDictionaryEntry(a: DictionaryEntry, b: DictionaryEntry): boolean {
  return (
    a.normalizedTerm === b.normalizedTerm &&
    a.sourceLang === b.sourceLang &&
    a.targetLang === b.targetLang &&
    (a.context?.trim() ?? '') === (b.context?.trim() ?? '')
  )
}

function capDictionaryEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
  const favorites = entries.filter((entry) => entry.favorite)
  const history = entries
    .filter((entry) => !entry.favorite)
    .slice(0, MAX_NON_FAVORITE_DICTIONARY_HISTORY)
  return [...favorites, ...history].sort((a, b) => b.createdAt - a.createdAt)
}

export interface DictionarySlice {
  dictionaryEntries: DictionaryEntry[]
  addDictionaryEntry: (entry: DictionaryEntry) => void
  toggleDictionaryFavorite: (id: string) => void
  deleteDictionaryEntry: (id: string) => void
  clearDictionaryHistory: () => void
}

export const createDictionarySlice = (set: SliceSet): DictionarySlice => ({
  dictionaryEntries: [],

  addDictionaryEntry: (entry) =>
    set((state: DictionarySlice) => {
      const existing = state.dictionaryEntries.find((item) => sameDictionaryEntry(item, entry))
      const mergedEntry: DictionaryEntry = existing
        ? { ...entry, id: existing.id, favorite: existing.favorite, createdAt: entry.createdAt }
        : entry
      const nextEntries = [
        mergedEntry,
        ...state.dictionaryEntries.filter((item) => item.id !== mergedEntry.id),
      ]
      return { dictionaryEntries: capDictionaryEntries(nextEntries) }
    }),

  toggleDictionaryFavorite: (id) =>
    set((state: DictionarySlice) => ({
      dictionaryEntries: state.dictionaryEntries.map((entry) =>
        entry.id === id ? { ...entry, favorite: !entry.favorite } : entry
      ),
    })),

  deleteDictionaryEntry: (id) =>
    set((state: DictionarySlice) => ({
      dictionaryEntries: state.dictionaryEntries.filter((entry) => entry.id !== id),
    })),

  clearDictionaryHistory: () =>
    set((state: DictionarySlice) => ({
      dictionaryEntries: state.dictionaryEntries.filter((entry) => entry.favorite),
    })),
})
