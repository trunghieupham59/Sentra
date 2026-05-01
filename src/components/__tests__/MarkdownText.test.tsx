import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownText } from '../MarkdownText'
import { parseChartArtifact } from '../markdown/ChartBlock'

const DEFAULT_SERIES_NAME = 'Value'

describe('parseChartArtifact', () => {
  it('normalizes simple chart JSON into a single-series artifact', () => {
    const result = parseChartArtifact(JSON.stringify({
      type: 'bar',
      title: 'Revenue',
      labels: ['Jan', 'Feb'],
      values: [120, 180],
    }), DEFAULT_SERIES_NAME)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.chart).toMatchObject({
        type: 'bar',
        title: 'Revenue',
        labels: ['Jan', 'Feb'],
        series: [{ name: 'Value', values: [120, 180] }],
      })
    }
  })

  it('rejects charts whose values do not match the label count', () => {
    const result = parseChartArtifact(JSON.stringify({
      type: 'line',
      labels: ['Jan', 'Feb'],
      values: [120],
    }), DEFAULT_SERIES_NAME)

    expect(result.ok).toBe(false)
  })
})

describe('MarkdownText chart fences', () => {
  it('renders valid chart fences as native chart blocks', () => {
    render(
      <MarkdownText
        text={`Before
\`\`\`chart
{ "type": "bar", "title": "Revenue", "labels": ["Jan", "Feb"], "values": [120, 180] }
\`\`\`
After`}
      />,
    )

    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Revenue' })).toBeInTheDocument()
    expect(screen.getByText('Jan')).toBeInTheDocument()
    expect(screen.getByText('After')).toBeInTheDocument()
  })

  it('falls back to code rendering for invalid chart JSON', () => {
    render(
      <MarkdownText
        text={`\`\`\`chart
not-json
\`\`\``}
      />,
    )

    expect(screen.getByText('not-json')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
