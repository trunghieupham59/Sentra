import React, { useState, useMemo, memo } from 'react'
import { useAppStore, useT } from '../store/useAppStore'
import type { Translations } from '../i18n'
import type { HistoryItem, ChatSession, LiveSession } from '../types'
import {
  IconTrash, IconSearch,
  IconChevronDown, IconChevronUp,
} from '../components/icons/AppIcons'
import ProviderIcon from '../components/ProviderIcon'

type TabId = 'translations' | 'chat' | 'live'

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatDateShort(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Card components receive t as a prop — no per-card store subscriptions ─────

const TranslationCard = memo(function TranslationCard({ item, onDelete, t }: { item: HistoryItem; onDelete: () => void; t: Translations }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="card" style={{ borderRadius: 12, padding: '10px 13px', cursor: 'pointer' }} onClick={() => setExpanded((e) => !e)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <ProviderIcon provider={item.provider} size={15} />
            <span className="badge badge-glass" style={{ fontSize: 10 }}>{item.sourceLang.toUpperCase()} → {item.targetLang.toUpperCase()}</span>
            {item.translationStyle && item.translationStyle !== 'general' && (
              <span className="badge badge-glass" style={{ fontSize: 10, textTransform: 'capitalize' }}>{item.translationStyle}</span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{formatDate(item.timestamp)}</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: 'vertical' as const, whiteSpace: expanded ? 'pre-wrap' : undefined }}>
            {item.sourceText}
          </p>
          {expanded && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--glass-border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.history_translation_label}</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.translatedText}</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn-icon" onClick={() => setExpanded((e) => !e)} style={{ padding: 5 }}>
            {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </button>
          <button type="button" className="btn-icon" onClick={onDelete} style={{ padding: 5 }} data-tooltip={t.history_delete}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
    </div>
  )
})

const ChatCard = memo(function ChatCard({ session, onDelete, t }: { session: ChatSession; onDelete: () => void; t: Translations }) {
  return (
    <div className="card" style={{ borderRadius: 12, padding: '10px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <ProviderIcon provider={session.provider} size={15} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.title || t.history_chat_untitled}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="badge badge-glass" style={{ fontSize: 10 }}>{session.messages.length} {t.history_chat_messages}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDateShort(session.createdAt)}</span>
          </div>
          {session.messages.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.messages[0]?.content.map((c) => c.text ?? '').join('').slice(0, 100)}
            </p>
          )}
        </div>
        <button type="button" className="btn-icon" onClick={onDelete} style={{ padding: 5, flexShrink: 0 }} data-tooltip={t.history_delete}>
          <IconTrash size={13} />
        </button>
      </div>
    </div>
  )
})

const LiveCard = memo(function LiveCard({ session, t }: { session: LiveSession; t: Translations }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="card" style={{ borderRadius: 12, padding: '10px 13px', cursor: 'pointer' }} onClick={() => setExpanded((e) => !e)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <ProviderIcon provider={session.provider} size={15} />
            <span className="badge badge-glass" style={{ fontSize: 10 }}>{session.sourceLang.toUpperCase()} → {session.targetLang.toUpperCase()}</span>
            <span className="badge badge-glass" style={{ fontSize: 10 }}>{session.wordCount} {t.history_live_words}</span>
            {session.summary && <span className="badge badge-success" style={{ fontSize: 10 }}>{t.history_summary_badge}</span>}
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{formatDate(session.createdAt)}</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 2, WebkitBoxOrient: 'vertical' as const, whiteSpace: expanded ? 'pre-wrap' : undefined }}>
            {session.rawTranscript || t.history_no_transcript}
          </p>
          {expanded && session.translation && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--glass-border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.history_translation_label}</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{session.translation}</p>
            </div>
          )}
          {expanded && session.summary && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--glass-border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.history_summary_badge}</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{session.summary}</p>
            </div>
          )}
        </div>
        <button type="button" className="btn-icon" onClick={() => setExpanded((e) => !e)} style={{ padding: 5, flexShrink: 0 }}>
          {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </button>
      </div>
    </div>
  )
})

function ClearButton({ onClear, disabled, t }: { onClear: () => void; disabled?: boolean; t: Translations }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) {
    return (
      <div style={{ display: 'flex', gap: 5 }}>
        <button type="button" className="btn btn-danger" onClick={() => { onClear(); setConfirm(false) }} style={{ padding: '4px 10px', fontSize: 11 }}>
          {t.history_confirm}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)} style={{ padding: '4px 10px', fontSize: 11 }}>
          {t.history_cancel}
        </button>
      </div>
    )
  }
  return (
    <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)} disabled={disabled} style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}>
      <IconTrash size={12} />
      {t.history_clear_all}
    </button>
  )
}

export default function HistoryPage() {
  const t = useT()
  const history        = useAppStore((s) => s.history)
  const chatSessions   = useAppStore((s) => s.chatSessions)
  const liveSessions   = useAppStore((s) => s.liveSessions)
  const clearHistory   = useAppStore((s) => s.clearHistory)
  const deleteHistoryItem  = useAppStore((s) => s.deleteHistoryItem)
  const deleteChatSession  = useAppStore((s) => s.deleteChatSession)
  const clearLiveSessions  = useAppStore((s) => s.clearLiveSessions)

  const [tab, setTab]       = useState<TabId>('translations')
  const [search, setSearch] = useState('')

  const filteredTranslations = useMemo(() => {
    if (!search.trim()) return history
    const q = search.toLowerCase()
    return history.filter((h) =>
      h.sourceText.toLowerCase().includes(q) || h.translatedText.toLowerCase().includes(q) ||
      h.provider.toLowerCase().includes(q) || h.sourceLang.toLowerCase().includes(q) || h.targetLang.toLowerCase().includes(q)
    )
  }, [history, search])

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chatSessions
    const q = search.toLowerCase()
    return chatSessions.filter((s) =>
      s.title.toLowerCase().includes(q) || s.messages.some((m) => m.content.some((c) => c.text?.toLowerCase().includes(q)))
    )
  }, [chatSessions, search])

  const filteredLive = useMemo(() => {
    if (!search.trim()) return liveSessions
    const q = search.toLowerCase()
    return liveSessions.filter((s) =>
      s.rawTranscript.toLowerCase().includes(q) || s.translation.toLowerCase().includes(q) || (s.summary?.toLowerCase().includes(q) ?? false)
    )
  }, [liveSessions, search])

  const tabCounts = useMemo(() => ({
    translations: history.length,
    chat: chatSessions.length,
    live: liveSessions.length,
  }), [history.length, chatSessions.length, liveSessions.length])

  const TABS = useMemo(() => [
    { id: 'translations' as TabId, label: t.history_tab_translate },
    { id: 'chat' as TabId,         label: t.history_tab_chat },
    { id: 'live' as TabId,         label: t.history_tab_live },
  ], [t])

  return (
    <div className="page-container" style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <div className="tab-bar">
          {TABS.map(({ id, label }) => (
            <button key={id} type="button" className={`tab-item${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {label}
              {tabCounts[id] > 0 && (
                <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 999, background: tab === id ? 'rgba(255,255,255,0.2)' : 'var(--glass-bg)', color: tab === id ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                  {tabCounts[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, position: 'relative', minWidth: 160 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none', display: 'flex' }}>
            <IconSearch size={13} />
          </span>
          <input className="search-input" type="text" placeholder={t.history_search_placeholder} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {tab === 'translations' && history.length > 0 && <ClearButton onClear={clearHistory} t={t} />}
        {tab === 'live' && liveSessions.length > 0 && <ClearButton onClear={clearLiveSessions} t={t} />}
      </div>

      <div className="scroll-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tab === 'translations' && (
          filteredTranslations.length === 0 ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <span style={{ fontSize: 28, opacity: 0.4 }}>🔤</span>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{search ? t.history_no_results : t.history_empty}</p>
              <p style={{ fontSize: 12, maxWidth: 220, textAlign: 'center' }}>{search ? t.history_no_results_desc : t.history_empty_desc}</p>
            </div>
          ) : filteredTranslations.map((item) => (
            <TranslationCard key={item.id} item={item} t={t} onDelete={() => deleteHistoryItem(item.id)} />
          ))
        )}
        {tab === 'chat' && (
          filteredChats.length === 0 ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <span style={{ fontSize: 28, opacity: 0.4 }}>💬</span>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{search ? t.history_no_results : t.history_chat_empty}</p>
              <p style={{ fontSize: 12, maxWidth: 220, textAlign: 'center' }}>{search ? t.history_no_results_desc : t.history_chat_empty_desc}</p>
            </div>
          ) : filteredChats.map((session) => (
            <ChatCard key={session.id} session={session} t={t} onDelete={() => deleteChatSession(session.id)} />
          ))
        )}
        {tab === 'live' && (
          filteredLive.length === 0 ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <span style={{ fontSize: 28, opacity: 0.4 }}>🎙️</span>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{search ? t.history_no_results : t.history_live_empty}</p>
              <p style={{ fontSize: 12, maxWidth: 220, textAlign: 'center' }}>{search ? t.history_no_results_desc : t.history_live_empty_desc}</p>
            </div>
          ) : filteredLive.map((session) => (
            <LiveCard key={session.id} session={session} t={t} />
          ))
        )}
      </div>
    </div>
  )
}
