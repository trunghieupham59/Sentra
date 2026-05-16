/**
 * dictionarySlice — persisted dictionary lookup history and favorites.
 */
import type { DictionaryEntry } from '../../types'
import type { SliceSet } from './sliceTypes'

const MAX_NON_FAVORITE_DICTIONARY_HISTORY = 100
/**
 * Soft cap on favorites — keeps the persisted state from outgrowing
 * localStorage. Older favorites past this threshold are unstarred (kept as
 * regular history) so the user does not silently lose entries.
 */
const MAX_FAVORITE_DICTIONARY_ENTRIES = 500

function normalizeContextKey(context: string | undefined): string {
  return (context ?? '').trim().toLocaleLowerCase()
}

function sameDictionaryEntry(a: DictionaryEntry, b: DictionaryEntry): boolean {
  return (
    a.normalizedTerm === b.normalizedTerm &&
    a.sourceLang === b.sourceLang &&
    a.targetLang === b.targetLang &&
    normalizeContextKey(a.context) === normalizeContextKey(b.context)
  )
}

function capDictionaryEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
  const sorted = [...entries].sort((a, b) => b.createdAt - a.createdAt)
  const favorites: DictionaryEntry[] = []
  const history: DictionaryEntry[] = []
  for (const entry of sorted) {
    if (entry.favorite && favorites.length < MAX_FAVORITE_DICTIONARY_ENTRIES) {
      favorites.push(entry)
    } else if (entry.favorite) {
      // Demote excess favorites instead of dropping them outright.
      history.push({ ...entry, favorite: false })
    } else {
      history.push(entry)
    }
  }
  const trimmedHistory = history.slice(0, MAX_NON_FAVORITE_DICTIONARY_HISTORY)
  return [...favorites, ...trimmedHistory].sort((a, b) => b.createdAt - a.createdAt)
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
      dictionaryEntries: capDictionaryEntries(
        state.dictionaryEntries.map((entry) =>
          entry.id === id ? { ...entry, favorite: !entry.favorite } : entry,
        ),
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
