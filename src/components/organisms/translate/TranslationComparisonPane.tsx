import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../../store/useAppStore'
import type { TranslationComparisonResult, TranslationModelSelection } from '../../../types'
import { formatModelName, getProviderDisplayName } from '../../../utils/modelDisplay'
import { MarkdownText } from '../../MarkdownText'
import { ProviderIcon } from '../../ProviderIcon'
import { Button } from '../../ui/atoms'
import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  InfoCircleIcon,
  RefreshIcon,
  SpeakerIcon,
  SpinnerIcon,
  StopIcon,
} from '../../ui/icons'

interface TranslationComparisonPaneProps {
  headingId: string
  results: TranslationComparisonResult[]
  copiedResultKey: string | null
  speakingResultKey: string | null
  speakLoading: boolean
  isTranslating: boolean
  isResultStale: boolean
  canRetry: boolean
  onCopy: (result: TranslationComparisonResult) => void
  onSpeak: (result: TranslationComparisonResult) => void
  onRetry: (selection: TranslationModelSelection) => void
  onOpenSettings: () => void
}

/** Parallel translation results with desktop comparison columns and compact tabs. */
export function TranslationComparisonPane({
  headingId,
  results,
  copiedResultKey,
  speakingResultKey,
  speakLoading,
  isTranslating,
  isResultStale,
  canRetry,
  onCopy,
  onSpeak,
  onRetry,
  onOpenSettings,
}: TranslationComparisonPaneProps) {
  const t = useT()
  const tabsId = useId()
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())
  const [compactResultKey, setCompactResultKey] = useState(results[0]?.key ?? null)
  const completedCount = results.filter((result) => (
    result.status === 'success' || result.status === 'error'
  )).length
  const liveStatus = t.translate_compare_progress(completedCount, results.length)

  useEffect(() => {
    const availableKeys = new Set(results.map((result) => result.key))
    if (!compactResultKey || !availableKeys.has(compactResultKey)) {
      setCompactResultKey(results[0]?.key ?? null)
    }
  }, [compactResultKey, results])

  const selectCompactTab = (key: string, focus = false) => {
    setCompactResultKey(key)
    if (focus) requestAnimationFrame(() => tabRefs.current.get(key)?.focus())
  }

  const handleTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    let nextIndex = index
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + results.length) % results.length
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % results.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = results.length - 1
    const nextResult = results[nextIndex]
    if (nextResult) selectCompactTab(nextResult.key, true)
  }

  return (
    <section
      className="translate-pane translate-result-pane translate-comparison-pane"
      aria-labelledby={headingId}
      aria-busy={isTranslating}
    >
      {isTranslating && (
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {liveStatus}
        </span>
      )}

      <div className="translate-comparison-summary">
        <strong>{t.translate_compare_heading(results.length)}</strong>
        {isTranslating && <span>{liveStatus}</span>}
      </div>

      <div
        className="translate-comparison-mobile-tabs"
        role="tablist"
        aria-label={t.translate_compare_mobile_tabs}
      >
        {results.map((result, index) => {
          const modelName = formatModelName(result.provider, result.model)
          const providerName = getProviderDisplayName(result.provider)
          const statusLabel = result.status === 'loading'
            ? t.translate_btn_loading
            : result.status === 'success'
              ? t.translate_result_ready
              : result.status === 'error'
                ? t.translate_error_generic
                : t.translate_compare_idle_short
          const tabId = `${tabsId}-tab-${index}`
          return (
            <Button
              key={result.key}
              ref={(node) => {
                if (node) tabRefs.current.set(result.key, node)
                else tabRefs.current.delete(result.key)
              }}
              id={tabId}
              size="sm"
              shape="rect"
              variant={compactResultKey === result.key ? 'primary' : 'neutral'}
              appearance={compactResultKey === result.key ? 'soft' : 'ghost'}
              role="tab"
              aria-label={`${modelName} · ${providerName} · ${statusLabel}`}
              aria-selected={compactResultKey === result.key}
              aria-controls={`${tabsId}-panel-${index}`}
              aria-busy={result.status === 'loading'}
              tabIndex={compactResultKey === result.key ? 0 : -1}
              onClick={() => selectCompactTab(result.key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <ProviderIcon provider={result.provider} size={14} />
              <span className="translate-comparison-tab-label">{modelName}</span>
              <span
                className={`translate-comparison-tab-status translate-comparison-tab-status-${result.status}`}
                aria-hidden="true"
              >
                {result.status === 'loading' && <SpinnerIcon />}
                {result.status === 'success' && <CheckIcon />}
                {result.status === 'error' && <AlertTriangleIcon />}
                {result.status === 'idle' && <ClockIcon />}
              </span>
            </Button>
          )
        })}
      </div>

      <div className="translate-pane-body translate-comparison-body">
        {isResultStale && !isTranslating && (
          <div className="translate-result-state-banner">
            <InfoCircleIcon className="translate-result-state-icon" />
            <span>{t.translate_result_stale_manual}</span>
          </div>
        )}

        <div className="translate-comparison-list">
          {results.map((result, index) => (
            <div
              key={result.key}
              id={`${tabsId}-panel-${index}`}
              className="translate-comparison-card-shell"
              role="tabpanel"
              aria-labelledby={`${tabsId}-tab-${index}`}
              data-compact-active={compactResultKey === result.key}
            >
              <ComparisonResultCard
                result={result}
                isCopied={copiedResultKey === result.key}
                isSpeaking={speakingResultKey === result.key}
                speakLoading={speakLoading}
                canRetry={canRetry && result.status !== 'loading'}
                onCopy={onCopy}
                onSpeak={onSpeak}
                onRetry={onRetry}
                onOpenSettings={onOpenSettings}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

interface ComparisonResultCardProps {
  result: TranslationComparisonResult
  isCopied: boolean
  isSpeaking: boolean
  speakLoading: boolean
  canRetry: boolean
  onCopy: (result: TranslationComparisonResult) => void
  onSpeak: (result: TranslationComparisonResult) => void
  onRetry: (selection: TranslationModelSelection) => void
  onOpenSettings: () => void
}

function ComparisonResultCard({
  result,
  isCopied,
  isSpeaking,
  speakLoading,
  canRetry,
  onCopy,
  onSpeak,
  onRetry,
  onOpenSettings,
}: ComparisonResultCardProps) {
  const t = useT()
  const modelName = formatModelName(result.provider, result.model)
  const providerName = getProviderDisplayName(result.provider)
  const isApiKeyError = result.errorCode === 'NO_API_KEY' || result.errorCode === 'INVALID_KEY'
  const duration = result.durationMs === null
    ? null
    : t.translate_compare_duration((result.durationMs / 1000).toFixed(result.durationMs < 10_000 ? 1 : 0))

  return (
    <article
      className="translate-comparison-card"
      aria-label={`${modelName} · ${providerName}`}
      aria-busy={result.status === 'loading'}
    >
      <header className="translate-comparison-card-header">
        <span className="translate-comparison-card-icon" aria-hidden="true">
          <ProviderIcon provider={result.provider} size={18} />
        </span>
        <span className="translate-comparison-card-heading">
          <strong>{modelName}</strong>
          <span>{providerName}</span>
        </span>
        <span className={`translate-comparison-status translate-comparison-status-${result.status}`}>
          {result.status === 'loading' && <SpinnerIcon />}
          {result.status === 'error' && <AlertTriangleIcon />}
          <span>
            {result.status === 'loading'
              ? t.translate_btn_loading
              : result.status === 'success'
                ? duration
                : result.status === 'error'
                  ? t.translate_error_generic
                  : t.translate_compare_idle_short}
          </span>
        </span>
      </header>

      <div className="translate-comparison-card-body">
        {result.status === 'loading' ? (
          <div className="translate-comparison-skeleton" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : result.status === 'error' ? (
          <div className="translate-comparison-error" role="alert">
            <p>{result.error}</p>
            <div className="translate-comparison-error-actions">
              <Button
                size="sm"
                shape="rect"
                variant="neutral"
                appearance="outline"
                disabled={!canRetry}
                onClick={() => onRetry(result)}
              >
                <RefreshIcon />
                {t.translate_compare_retry}
              </Button>
              {isApiKeyError && (
                <Button size="sm" shape="rect" variant="primary" appearance="soft" onClick={onOpenSettings}>
                  {t.translate_error_open_settings}
                </Button>
              )}
            </div>
          </div>
        ) : result.status === 'success' ? (
          <MarkdownText text={result.translatedText} className="translate-comparison-text" />
        ) : (
          <p className="translate-comparison-idle">{t.translate_compare_idle}</p>
        )}
      </div>

      {result.status === 'success' && (
        <footer className="translate-comparison-card-footer">
          <Button
            size="sm"
            shape="icon"
            variant={isSpeaking ? 'danger' : 'neutral'}
            appearance="ghost"
            aria-label={`${isSpeaking ? t.translate_speak_stop : t.translate_speak}: ${modelName} · ${providerName}`}
            onClick={() => onSpeak(result)}
          >
            {speakLoading && isSpeaking
              ? <SpinnerIcon />
              : isSpeaking
                ? <StopIcon />
                : <SpeakerIcon />}
          </Button>
          <Button
            size="sm"
            shape="rect"
            variant={isCopied ? 'primary' : 'neutral'}
            appearance={isCopied ? 'soft' : 'ghost'}
            aria-label={`${isCopied ? t.translate_copied : t.translate_copy}: ${modelName} · ${providerName}`}
            onClick={() => onCopy(result)}
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
            {isCopied ? t.translate_copied : t.translate_copy}
          </Button>
        </footer>
      )}
    </article>
  )
}
