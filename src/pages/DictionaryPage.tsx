import React, { useState, useCallback, useRef, memo } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import type { Translations } from '../i18n'
import { dictionaryService, normalizeDictionaryTerm } from '../services/dictionaryService'
import type { DictionaryEntry } from '../types'
import { createClientId } from '../utils/id'
import {
  IconSearch, IconStar, IconStarFilled, IconTrash, IconSpinner,
  IconChevronLeft,
} from '../components/icons/AppIcons'
import ProviderIcon from '../components/ProviderIcon'

const COMMON_SOURCE_LANGS = ['auto', 'en', 'ja', 'ko', 'zh', 'vi']
const COMMON_TARGET_LANGS = ['vi', 'en', 'ja', 'ko', 'zh']

const LANG_LABELS: Record<string, string> = {
  auto: 'Auto', en: 'EN', ja: 'JA', ko: 'KO', zh: 'ZH', vi: 'VI',
  fr: 'FR', de: 'DE', es: 'ES', pt: 'PT', ru: 'RU', ar: 'AR',
  th: 'TH', id: 'ID', ms: 'MS', it: 'IT',
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// t passed as prop — no per-component store subscription
const DictionaryResultView = memo(function DictionaryResultView({ entry, onBack, t }: { entry: DictionaryEntry; onBack: () => void; t: Translations }) {
  const { result } = entry
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
        <button type="button" className="btn-icon" onClick={onBack} style={{ marginTop: 2 }}>
          <IconChevronLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{result.headword}</span>
            {result.pronunciation && <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{result.pronunciation}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            {result.partOfSpeech.map((pos) => <span key={pos} className="badge badge-glass" style={{ fontSize: 10.5 }}>{pos}</span>)}
            <span className="badge badge-glass" style={{ fontSize: 10.5 }}>{entry.sourceLang.toUpperCase()} → {entry.targetLang.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="scroll-area" style={{ flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.meaning && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{t.dictionary_meaning}</p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{result.meaning}</p>
            </div>
          )}
          {result.translations.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{t.dictionary_translations}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.translations.map((tx, i) => (
                  <div key={i} className="card" style={{ padding: '10px 12px', borderRadius: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: tx.meaning || tx.usage || tx.nuance ? 6 : 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{tx.text}</span>
                      {tx.pronunciation && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{tx.pronunciation}</span>}
                      {tx.partOfSpeech && <span className="badge badge-glass" style={{ fontSize: 10, marginLeft: 'auto' }}>{tx.partOfSpeech}</span>}
                    </div>
                    {tx.meaning && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, lineHeight: 1.5 }}>{tx.meaning}</p>}
                    {tx.usage && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginBottom: 3 }}><span style={{ fontWeight: 600 }}>{t.dictionary_translation_usage}: </span>{tx.usage}</p>}
                    {tx.nuance && <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}><span style={{ fontWeight: 600 }}>{t.dictionary_translation_nuance}: </span>{tx.nuance}</p>}
                    {tx.examples && tx.examples.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {tx.examples.map((ex, j) => (
                          <p key={j} style={{ fontSize: 11.5, color: 'var(--text-tertiary)', fontStyle: 'italic', paddingLeft: 8, borderLeft: '2px solid var(--glass-border)' }}>{ex}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.examples.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{t.dictionary_examples}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {result.examples.map((ex, i) => (
                  <p key={i} style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 10, borderLeft: '2px solid var(--accent)', opacity: 0.8 }}>{ex}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

const HistoryList = memo(function HistoryList({ entries, onSelect, onToggleFavorite, onDelete, onClear, t }: {
  entries: DictionaryEntry[]
  onSelect: (e: DictionaryEntry) => void
  onToggleFavorite: (id: string) => void
  onDelete: (id: string) => void
  onClear: () => void
  t: Translations
}) {
  const [confirmClear, setConfirmClear] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 10px', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t.dictionary_title}</span>
        {entries.length > 0 && <span className="badge badge-glass">{entries.length}</span>}
        <div style={{ flex: 1 }} />
        {entries.length > 0 && (
          confirmClear ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn-danger" onClick={() => { onClear(); setConfirmClear(false) }} style={{ padding: '4px 10px', fontSize: 11 }}>{t.dictionary_confirm_clear}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)} style={{ padding: '4px 10px', fontSize: 11 }}>{t.dictionary_cancel}</button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(true)} style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}>
              <IconTrash size={12} />{t.dictionary_clear_btn}
            </button>
          )
        )}
      </div>

      <div className="scroll-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {entries.length === 0 ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <span style={{ fontSize: 26, opacity: 0.4 }}>📖</span>
            <p style={{ fontSize: 12 }}>{t.dictionary_no_lookups}</p>
          </div>
        ) : entries.map((entry) => (
          <div key={entry.id} className="card" style={{ padding: '10px 12px', cursor: 'pointer', borderRadius: 12 }} onClick={() => onSelect(entry)}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.term}</span>
                  {entry.favorite && <span style={{ color: 'var(--warning)', flexShrink: 0, display: 'flex' }}><IconStarFilled size={13} /></span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{entry.sourceLang.toUpperCase()} → {entry.targetLang.toUpperCase()}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>·</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDate(entry.createdAt)}</span>
                  <ProviderIcon provider={entry.provider} size={14} />
                </div>
                {entry.result.meaning && <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.result.meaning}</p>}
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn-icon" onClick={() => onToggleFavorite(entry.id)} style={{ padding: 5, color: entry.favorite ? 'var(--warning)' : 'var(--text-tertiary)' }} data-tooltip={entry.favorite ? t.dictionary_unfavorite : t.dictionary_favorite}>
                  {entry.favorite ? <IconStarFilled size={13} /> : <IconStar size={13} />}
                </button>
                <button type="button" className="btn-icon" onClick={() => onDelete(entry.id)} style={{ padding: 5 }} data-tooltip={t.dictionary_delete}>
                  <IconTrash size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export default function DictionaryPage() {
  const t = useT()
  const dictionaryEntries        = useAppStore((s) => s.dictionaryEntries)
  const addDictionaryEntry       = useAppStore((s) => s.addDictionaryEntry)
  const toggleDictionaryFavorite = useAppStore((s) => s.toggleDictionaryFavorite)
  const deleteDictionaryEntry    = useAppStore((s) => s.deleteDictionaryEntry)
  const clearDictionaryHistory   = useAppStore((s) => s.clearDictionaryHistory)
  const storeSrcLang  = useAppStore((s) => s.sourceLang)
  const storeTgtLang  = useAppStore((s) => s.targetLang)
  const selectedProvider = useAppStore((s) => s.selectedProvider)
  const selectedModels   = useAppStore((s) => s.selectedModels)

  const [term, setTerm]       = useState('')
  const [context, setContext] = useState('')
  const [srcLang, setSrcLang] = useState(storeSrcLang)
  const [tgtLang, setTgtLang] = useState(storeTgtLang)
  const [isLooking, setIsLooking]     = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleLookup = useCallback(async () => {
    const trimmed = term.trim()
    if (!trimmed || isLooking) return
    setIsLooking(true)
    setLookupError(null)
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    try {
      const model = selectedModels[selectedProvider] ?? ''
      const result = await dictionaryService.lookup({ term: trimmed, context: context.trim() || undefined, sourceLang: srcLang, targetLang: tgtLang, provider: selectedProvider, model })
      if (result.success && result.result) {
        const entry: DictionaryEntry = {
          id: createClientId('dict'), term: trimmed,
          normalizedTerm: normalizeDictionaryTerm(trimmed),
          context: context.trim() || undefined,
          sourceLang: srcLang, targetLang: tgtLang,
          provider: selectedProvider, model,
          createdAt: Date.now(), favorite: false, result: result.result,
        }
        addDictionaryEntry(entry)
        setSelectedEntry(entry)
      } else {
        setLookupError(result.error ?? t.dictionary_error_failed)
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : t.dictionary_error_failed)
    } finally {
      setIsLooking(false)
    }
  }, [term, context, srcLang, tgtLang, selectedProvider, selectedModels, addDictionaryEntry, isLooking, t])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleLookup() }
  }, [handleLookup])

  return (
    <div className="page-container" style={{ gap: 12 }}>
      <div className="panel-grid" style={{ flex: 1 }}>
        <div className="panel glass" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            <p style={{ fontSize: 13, fontWeight: 600, flexShrink: 0 }}>{t.dictionary_look_up_word}</p>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', display: 'flex' }}><IconSearch size={14} /></span>
              <input className="search-input" type="text" placeholder={t.dictionary_term_placeholder} value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={handleKeyDown} style={{ paddingRight: 12 }} />
            </div>
            <textarea className="field-textarea" placeholder={t.dictionary_context_placeholder} value={context} onChange={(e) => setContext(e.target.value)} rows={3} style={{ flexShrink: 0, resize: 'none' }} />
            <div style={{ flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.dictionary_source_lang}</p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {COMMON_SOURCE_LANGS.map((lang) => (
                  <button key={lang} type="button" className={`lang-pill${srcLang === lang ? ' active' : ''}`} onClick={() => setSrcLang(lang)}>
                    {LANG_LABELS[lang] ?? lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.dictionary_target_lang}</p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {COMMON_TARGET_LANGS.map((lang) => (
                  <button key={lang} type="button" className={`lang-pill${tgtLang === lang ? ' active' : ''}`} onClick={() => setTgtLang(lang)}>
                    {LANG_LABELS[lang] ?? lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {lookupError && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', color: 'var(--danger)', fontSize: 12, flexShrink: 0 }}>
                {lookupError}
              </div>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary" onClick={() => void handleLookup()} disabled={!term.trim() || isLooking} style={{ width: '100%', gap: 6, flexShrink: 0 }}>
              {isLooking ? <IconSpinner size={14} /> : <IconSearch size={14} />}
              {isLooking ? t.dictionary_lookup_loading : t.dictionary_lookup}
            </button>
          </div>
        </div>

        <div className="panel glass" style={{ padding: '14px' }}>
          {selectedEntry ? (
            <DictionaryResultView entry={selectedEntry} onBack={() => setSelectedEntry(null)} t={t} />
          ) : (
            <HistoryList entries={dictionaryEntries} onSelect={setSelectedEntry} onToggleFavorite={toggleDictionaryFavorite} onDelete={deleteDictionaryEntry} onClear={clearDictionaryHistory} t={t} />
          )}
        </div>
      </div>
    </div>
  )
}
