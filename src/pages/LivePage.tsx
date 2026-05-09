import React, { useState, useCallback, memo } from 'react'
import { useLiveTranslate } from '../hooks/useLiveTranslate'
import { useT } from '../store/useAppStore'
import type { Translations } from '../i18n'
import {
  IconMic, IconStop, IconTrash, IconSpeaker, IconSpinner,
  IconChevronDown, IconChevronUp,
} from '../components/icons/AppIcons'

const ResultCard = memo(function ResultCard({ title, content, isLoading, generatingLabel }: { title: string; content: string | null; isLoading: boolean; generatingLabel: string }) {
  const [open, setOpen] = useState(true)
  if (!isLoading && !content) return null
  return (
    <div className="card" style={{ borderRadius: 12, overflow: 'hidden' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', borderBottom: open ? '1px solid var(--glass-border)' : 'none' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>{open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}</span>
      </div>
      {open && (
        <div style={{ padding: '10px 14px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
              <IconSpinner size={13} />
              {generatingLabel}
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{content}</p>
          )}
        </div>
      )}
    </div>
  )
})

export default function LivePage() {
  const t = useT()
  const {
    audioMode, setAudioMode,
    isActive,
    rawTranscript, translation,
    isTranscribing, isTranslating,
    pipelineError, micError,
    pendingText,
    wordCount,
    activeSttProvider,
    hasAnyKey,
    isMac,
    rawEndRef, txEndRef,
    showSummaryBtn,
    summary, isSummarizing,
    speakerAnalysis, isAnalyzingSpeakers,
    actionItems, isExtractingActionItems,
    decisions, isExtractingDecisions,
    handleStart, handleStop, handleClear,
    handleSummarize, handleAnalyzeSpeakers,
    handleExtractActionItems, handleExtractDecisions,
  } = useLiveTranslate()

  const hasPostContent = showSummaryBtn || summary || speakerAnalysis || actionItems || decisions

  return (
    <div className="page-container" style={{ gap: 10 }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <div className="tab-bar">
          <button type="button" className={`tab-item${audioMode === 'mic' ? ' active' : ''}`} onClick={() => setAudioMode('mic')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconMic size={13} />
            {t.live_audio_mic}
          </button>
          <button type="button" className={`tab-item${audioMode === 'system' ? ' active' : ''}`} onClick={() => setAudioMode('system')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconSpeaker size={13} />
            {t.live_audio_system}
          </button>
          <button type="button" className={`tab-item${audioMode === 'both' ? ' active' : ''}`} onClick={() => setAudioMode('both')}>
            {t.live_audio_mode_both}
          </button>
        </div>

        {isActive ? (
          <button type="button" className="btn btn-danger" onClick={handleStop} style={{ gap: 6, padding: '7px 14px', fontSize: 12 }}>
            <IconStop size={13} />
            {t.live_stop}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void handleStart()} style={{ gap: 6, padding: '7px 14px', fontSize: 12, background: 'var(--success)', boxShadow: '0 0 12px rgba(48,209,88,0.3)' }}>
            <IconMic size={13} />
            {t.live_start}
          </button>
        )}

        {!hasAnyKey && <span className="badge badge-warning" style={{ fontSize: 11 }}>{t.live_no_key_warning}</span>}
        {wordCount > 0 && <span className="badge badge-glass">{wordCount} {t.live_words}</span>}
        {activeSttProvider && activeSttProvider !== 'none' && (
          <span className="badge badge-glass" style={{ textTransform: 'capitalize' }}>{activeSttProvider}</span>
        )}
        {(isTranscribing || isTranslating) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-tertiary)', fontSize: 11 }}>
            <IconSpinner size={12} />
            {isTranscribing ? t.live_status_stt : t.live_status_translating}
          </div>
        )}

        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={handleClear} style={{ padding: '6px 12px', fontSize: 12, gap: 5 }} disabled={isActive}>
          <IconTrash size={13} />
          {t.live_clear}
        </button>
      </div>

      {/* ── Errors ── */}
      {(micError || pipelineError) && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', color: 'var(--danger)', fontSize: 12, flexShrink: 0 }}>
          {micError || pipelineError}
        </div>
      )}

      {!isMac && (audioMode === 'system' || audioMode === 'both') && (
        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)', color: 'var(--warning)', fontSize: 12, flexShrink: 0 }}>
          {t.live_system_audio_macos}
        </div>
      )}

      {/* ── Two-column transcript + translation ── */}
      <div className="panel-grid" style={{ flex: 1 }}>
        <div className="panel glass" style={{ padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.live_transcript_header}</span>
            {isActive && (
              <div className="voice-wave">
                {[1,2,3,4,5].map((i) => <div key={i} className="voice-bar" />)}
              </div>
            )}
          </div>
          <div className="scroll-area" style={{ flex: 1, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-primary)' }}>
            {!rawTranscript && !pendingText ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <span style={{ opacity: 0.3 }}><IconMic size={28} /></span>
                <p style={{ fontSize: 12 }}>{t.live_start_recording_hint}</p>
              </div>
            ) : (
              <>
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{rawTranscript}</span>
                {pendingText && (
                  <span style={{ color: 'var(--text-tertiary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {rawTranscript ? ' ' : ''}{pendingText}
                  </span>
                )}
                <div ref={rawEndRef} />
              </>
            )}
          </div>
        </div>

        <div className="panel glass" style={{ padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.live_panel_translation}</span>
            {isTranslating && <span style={{ color: 'var(--accent)' }}><IconSpinner size={13} /></span>}
          </div>
          <div className="scroll-area" style={{ flex: 1, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-primary)' }}>
            {!translation ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <span style={{ opacity: 0.3 }}><IconSpeaker size={28} /></span>
                <p style={{ fontSize: 12 }}>{t.live_translation_empty}</p>
              </div>
            ) : (
              <>
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{translation}</span>
                <div ref={txEndRef} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Post-session ── */}
      {hasPostContent && (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {showSummaryBtn && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 4 }}>{t.live_post_session}</span>
              <button type="button" className="btn btn-glass" onClick={() => void handleSummarize()} disabled={isSummarizing} style={{ padding: '5px 12px', fontSize: 12, gap: 5 }}>
                {isSummarizing && <IconSpinner size={12} />}
                {t.live_summarize_btn}
              </button>
              <button type="button" className="btn btn-glass" onClick={() => void handleAnalyzeSpeakers()} disabled={isAnalyzingSpeakers} style={{ padding: '5px 12px', fontSize: 12, gap: 5 }}>
                {isAnalyzingSpeakers && <IconSpinner size={12} />}
                {t.live_analyze_btn}
              </button>
              <button type="button" className="btn btn-glass" onClick={() => void handleExtractActionItems()} disabled={isExtractingActionItems} style={{ padding: '5px 12px', fontSize: 12, gap: 5 }}>
                {isExtractingActionItems && <IconSpinner size={12} />}
                {t.live_post_tab_actions}
              </button>
              <button type="button" className="btn btn-glass" onClick={() => void handleExtractDecisions()} disabled={isExtractingDecisions} style={{ padding: '5px 12px', fontSize: 12, gap: 5 }}>
                {isExtractingDecisions && <IconSpinner size={12} />}
                {t.live_post_tab_decisions}
              </button>
            </div>
          )}
          {(summary || isSummarizing) && <ResultCard title={t.live_post_tab_summary} content={summary} isLoading={isSummarizing} generatingLabel={t.live_generating} />}
          {(speakerAnalysis || isAnalyzingSpeakers) && <ResultCard title={t.live_speakers_title} content={speakerAnalysis} isLoading={isAnalyzingSpeakers} generatingLabel={t.live_generating} />}
          {(actionItems || isExtractingActionItems) && <ResultCard title={t.live_post_tab_actions} content={actionItems} isLoading={isExtractingActionItems} generatingLabel={t.live_generating} />}
          {(decisions || isExtractingDecisions) && <ResultCard title={t.live_post_tab_decisions} content={decisions} isLoading={isExtractingDecisions} generatingLabel={t.live_generating} />}
        </div>
      )}
    </div>
  )
}
