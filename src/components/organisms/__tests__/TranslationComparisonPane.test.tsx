import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../../store/useAppStore'
import type { TranslationComparisonResult } from '../../../types'
import { TranslationComparisonPane } from '../translate/TranslationComparisonPane'

const IDLE_RESULTS: TranslationComparisonResult[] = [
  {
    key: 'gemini:gemini-2.0-flash',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    status: 'idle',
    translatedText: '',
    error: null,
    errorCode: null,
    durationMs: null,
  },
  {
    key: 'openai:gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    status: 'idle',
    translatedText: '',
    error: null,
    errorCode: null,
    durationMs: null,
  },
  {
    key: 'claude:claude-sonnet-4',
    provider: 'claude',
    model: 'claude-sonnet-4',
    status: 'idle',
    translatedText: '',
    error: null,
    errorCode: null,
    durationMs: null,
  },
]

function renderComparison(results = IDLE_RESULTS) {
  return render(
    <>
      <h2 id="translation-results-heading">Translation results</h2>
      <TranslationComparisonPane
        headingId="translation-results-heading"
        results={results}
        copiedResultKey={null}
        speakingResultKey={null}
        speakLoading={false}
        isTranslating={results.some((result) => result.status === 'loading')}
        isResultStale={false}
        canRetry
        onCopy={vi.fn()}
        onSpeak={vi.fn()}
        onRetry={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    </>,
  )
}

beforeEach(() => {
  useAppStore.setState({ locale: 'en', localeAuto: false })
})

describe('TranslationComparisonPane compact tabs', () => {
  it('selects one result with linked tab and panel semantics', () => {
    renderComparison()

    const tabs = within(screen.getByRole('tablist', { name: 'Translation results' }))
      .getAllByRole('tab')
    const panels = screen.getAllByRole('tabpanel')

    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[0]).toHaveAttribute('tabindex', '0')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[1]).toHaveAttribute('tabindex', '-1')
    expect(tabs[0]).toHaveAttribute('aria-controls', panels[0].id)
    expect(panels[0]).toHaveAttribute('aria-labelledby', tabs[0].id)
    expect(panels[0]).toHaveAttribute('data-compact-active', 'true')
    expect(panels[1]).toHaveAttribute('data-compact-active', 'false')

    fireEvent.click(tabs[1])

    expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[0]).toHaveAttribute('tabindex', '-1')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('tabindex', '0')
    expect(panels[0]).toHaveAttribute('data-compact-active', 'false')
    expect(panels[1]).toHaveAttribute('data-compact-active', 'true')
  })

  it('supports arrow, Home, and End navigation with roving focus', async () => {
    renderComparison()

    const tabs = within(screen.getByRole('tablist', { name: 'Translation results' }))
      .getAllByRole('tab')
    tabs[0].focus()

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
    await waitFor(() => expect(tabs[1]).toHaveFocus())

    fireEvent.keyDown(tabs[1], { key: 'End' })
    await waitFor(() => expect(tabs[2]).toHaveFocus())

    fireEvent.keyDown(tabs[2], { key: 'ArrowRight' })
    await waitFor(() => expect(tabs[0]).toHaveFocus())

    fireEvent.keyDown(tabs[0], { key: 'End' })
    await waitFor(() => expect(tabs[2]).toHaveFocus())

    fireEvent.keyDown(tabs[2], { key: 'Home' })
    await waitFor(() => expect(tabs[0]).toHaveFocus())
  })

  it('exposes each hidden model status from its tab', () => {
    renderComparison([
      { ...IDLE_RESULTS[0], status: 'loading' },
      {
        ...IDLE_RESULTS[1],
        status: 'success',
        translatedText: 'Completed translation',
        durationMs: 800,
      },
      {
        ...IDLE_RESULTS[2],
        status: 'error',
        error: 'Provider unavailable',
        errorCode: 'NETWORK',
      },
    ])

    const tablist = screen.getByRole('tablist', { name: 'Translation results' })
    expect(within(tablist).getByRole('tab', { name: /Gemini 2.0 Flash.*Translating/i }))
      .toHaveAttribute('aria-busy', 'true')
    expect(within(tablist).getByRole('tab', { name: /GPT 4o.*Translation ready/i }))
      .toHaveAttribute('aria-busy', 'false')
    expect(within(tablist).getByRole('tab', { name: /Claude Sonnet 4.*Translation failed/i }))
      .toHaveAttribute('aria-busy', 'false')
  })

  it('keeps the selected model across status updates and falls back when it is removed', () => {
    const view = renderComparison()
    const tablist = screen.getByRole('tablist', { name: 'Translation results' })
    fireEvent.click(within(tablist).getAllByRole('tab')[1])

    view.rerender(
      <>
        <h2 id="translation-results-heading">Translation results</h2>
        <TranslationComparisonPane
          headingId="translation-results-heading"
          results={IDLE_RESULTS.map((result) => (
            result.key === IDLE_RESULTS[1].key
              ? { ...result, status: 'success', translatedText: 'Done', durationMs: 500 }
              : result
          ))}
          copiedResultKey={null}
          speakingResultKey={null}
          speakLoading={false}
          isTranslating={false}
          isResultStale={false}
          canRetry
          onCopy={vi.fn()}
          onSpeak={vi.fn()}
          onRetry={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </>,
    )

    expect(within(tablist).getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true')

    view.rerender(
      <>
        <h2 id="translation-results-heading">Translation results</h2>
        <TranslationComparisonPane
          headingId="translation-results-heading"
          results={[IDLE_RESULTS[0], IDLE_RESULTS[2]]}
          copiedResultKey={null}
          speakingResultKey={null}
          speakLoading={false}
          isTranslating={false}
          isResultStale={false}
          canRetry
          onCopy={vi.fn()}
          onSpeak={vi.fn()}
          onRetry={vi.fn()}
          onOpenSettings={vi.fn()}
        />
      </>,
    )

    expect(within(tablist).getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true')
  })
})
