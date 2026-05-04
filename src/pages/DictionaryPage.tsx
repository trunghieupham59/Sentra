import { useEffect, useRef, useState } from 'react'
import { DictionaryHistoryPanel, type DictionaryListTab } from '../components/dictionary/DictionaryHistoryPanel'
import { DictionaryResultPanel } from '../components/dictionary/DictionaryResultPanel'
import { DictionarySearchPanel } from '../components/dictionary/DictionarySearchPanel'
import { ModelSelector } from '../components/ModelSelector'
import { GearIcon } from '../components/ui/icons'
import {
  dictionaryService,
  MAX_DICTIONARY_CONTEXT_CHARS,
  MAX_DICTIONARY_TERM_CHARS,
  normalizeDictionaryTerm,
} from '../services/dictionaryService'
import { useAppStore, useT } from '../store/useAppStore'
import type { DictionaryEntry, DictionaryTranslation } from '../types'

function createDictionaryEntryId(): string {
  return `dict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function formatDictionaryEntry(entry: DictionaryEntry): string {
  const translations = entry.result.translations
    .map((item: DictionaryTranslation | string) => {
      if (typeof item === 'string') return item
      return item.pronunciation ? `${item.text} /${item.pronunciation.replace(/^\/|\/$/g, '')}/` : item.text
    })
    .join(', ')
  const lines = [
    entry.result.headword,
    entry.result.pronunciation ? `${entry.result.pronunciation}` : '',
    entry.result.meaning,
    translations,
    ...entry.result.examples,
    ...entry.result.notes,
  ]
  return lines.filter(Boolean).join('\n')
}

export function DictionaryPage() {
  const t = useT()
  const {
    dictionaryEntries,
    addDictionaryEntry,
    toggleDictionaryFavorite,
    deleteDictionaryEntry,
    clearDictionaryHistory,
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang,
    selectedProvider,
    selectedModels,
    setSourceText,
    setTranslatedText,
    setPhoneticText,
    setActivePage,
  } = useAppStore()

  const [term, setTerm] = useState('')
  const [context, setContext] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    dictionaryEntries[0]?.id ?? null,
  )
  const [activeListTab, setActiveListTab] = useState<DictionaryListTab>('recent')
  const [copied, setCopied] = useState(false)

  /** Controls visibility of the AI config popup — mirrors TranslatePage. */
  const [showAIConfig, setShowAIConfig] = useState(false)
  const aiConfigRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showAIConfig) return
    const handleOutside = (e: MouseEvent) => {
      if (aiConfigRef.current && !aiConfigRef.current.contains(e.target as Node)) {
        setShowAIConfig(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showAIConfig])

  const selectedEntry =
    dictionaryEntries.find((entry) => entry.id === selectedEntryId) ?? dictionaryEntries[0] ?? null
  const model = selectedModels[selectedProvider] ?? ''

  const localizeError = (code?: string, fallback?: string) => {
    if (code === 'INVALID_RESPONSE') return t.dictionary_error_invalid_response
    if (code === 'NO_API_KEY') return t.translate_error_no_key
    return fallback || t.dictionary_error_failed
  }

  const runLookup = async () => {
    const cleanTerm = term.trim()
    const cleanContext = context.trim()
    if (!cleanTerm) {
      setError(t.dictionary_error_required)
      return
    }
    if (cleanTerm.length > MAX_DICTIONARY_TERM_CHARS) {
      setError(t.dictionary_error_too_long)
      return
    }
    if (cleanContext.length > MAX_DICTIONARY_CONTEXT_CHARS) {
      setError(t.dictionary_error_context_too_long)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const result = await dictionaryService.lookup({
        term: cleanTerm,
        context: cleanContext,
        sourceLang,
        targetLang,
        provider: selectedProvider,
        model,
      })
      if (!result.success || !result.result) {
        setError(localizeError(result.errorCode, result.error))
        return
      }

      const normalizedTerm = normalizeDictionaryTerm(cleanTerm)
      const existing = dictionaryEntries.find(
        (entry) =>
          entry.normalizedTerm === normalizedTerm &&
          entry.sourceLang === sourceLang &&
          entry.targetLang === targetLang &&
          (entry.context?.trim() ?? '') === cleanContext,
      )
      const entry: DictionaryEntry = {
        id: existing?.id ?? createDictionaryEntryId(),
        term: cleanTerm,
        normalizedTerm,
        context: cleanContext || undefined,
        sourceLang,
        targetLang,
        provider: selectedProvider,
        model,
        createdAt: Date.now(),
        favorite: existing?.favorite ?? false,
        result: result.result,
      }
      addDictionaryEntry(entry)
      setSelectedEntryId(entry.id)
      setActiveListTab('recent')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!selectedEntry) return
    await navigator.clipboard?.writeText?.(formatDictionaryEntry(selectedEntry))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const handleReuse = () => {
    if (!selectedEntry) return
    setSourceLang(selectedEntry.sourceLang)
    setTargetLang(selectedEntry.targetLang)
    setSourceText(selectedEntry.term)
    setTranslatedText('')
    setPhoneticText('')
    setActivePage('translate')
  }

  return (
    <div className="app-page">
      <div className="app-workspace">
        {/* ── Topbar: title + AI config gear (popup with ModelSelector) ── */}
        <div className="app-topbar justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 dark:text-gray-50">
              {t.dictionary_title}
            </h1>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              {t.dictionary_subtitle}
            </p>
          </div>

          <div className="relative flex-shrink-0" ref={aiConfigRef}>
            <button
              type="button"
              onClick={() => setShowAIConfig((v) => !v)}
              title={t.translate_ai_config_title}
              className={`toolbar-icon-button cursor-pointer ${showAIConfig ? 'toolbar-icon-button-active' : ''}`}
            >
              <GearIcon className="h-3.5 w-3.5" />
            </button>

            {showAIConfig && (
              <div className="floating-panel absolute top-full right-0 mt-2 z-50 w-[480px] p-4 flex flex-col gap-3">
                <h2 className="popover-title">{t.translate_ai_config_title}</h2>
                <ModelSelector />
              </div>
            )}
          </div>
        </div>

        {/* ── Search command bar ────────────────────────────────────────── */}
        <DictionarySearchPanel
          term={term}
          onTermChange={setTerm}
          context={context}
          onContextChange={setContext}
          sourceLang={sourceLang}
          onSourceLangChange={setSourceLang}
          targetLang={targetLang}
          onTargetLangChange={setTargetLang}
          isLoading={isLoading}
          canSubmit={Boolean(model)}
          error={error}
          maxTermChars={MAX_DICTIONARY_TERM_CHARS}
          maxContextChars={MAX_DICTIONARY_CONTEXT_CHARS}
          onSubmit={() => {
            void runLookup()
          }}
          t={t}
        />

        {/* ── Result + History (responsive: stacked on small screens) ──── */}
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="surface-panel min-h-0 order-2 lg:order-1">
            <DictionaryResultPanel
              entry={selectedEntry}
              copied={copied}
              onCopy={() => {
                void handleCopy()
              }}
              onFavorite={() => {
                if (selectedEntry) toggleDictionaryFavorite(selectedEntry.id)
              }}
              onReuse={handleReuse}
              t={t}
            />
          </div>

          <div className="order-1 min-h-0 lg:order-2 lg:flex lg:flex-col">
            <DictionaryHistoryPanel
              entries={dictionaryEntries}
              selectedEntryId={selectedEntry?.id ?? null}
              activeTab={activeListTab}
              onTabChange={setActiveListTab}
              onSelect={setSelectedEntryId}
              onToggleFavorite={toggleDictionaryFavorite}
              onDeleteSelected={() => {
                if (!selectedEntry) return
                deleteDictionaryEntry(selectedEntry.id)
                setSelectedEntryId(null)
              }}
              onClearHistory={clearDictionaryHistory}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
