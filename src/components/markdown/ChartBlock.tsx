type ChartType = 'bar' | 'line' | 'pie'

interface ChartSeries {
  name: string
  values: number[]
  color?: string
}

export interface ChartArtifact {
  type: ChartType
  title?: string
  labels: string[]
  series: ChartSeries[]
}

type ParseResult =
  | { ok: true; chart: ChartArtifact }
  | { ok: false; error: string }

const MAX_CHART_LABELS = 24
const MAX_CHART_SERIES = 4
const MAX_CHART_LABEL_CHARS = 40
const MAX_CHART_TITLE_CHARS = 80
const DEFAULT_SERIES_NAME = 'Value'

const CHART_COLORS = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#ea580c', '#0891b2']

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function cleanColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const color = value.trim()
  return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) ? color : undefined
}

function normalizeChartType(value: unknown): ChartType | null {
  if (value === 'bar' || value === 'line' || value === 'pie') return value
  return null
}

function parseFiniteValues(value: unknown, expectedLength: number): number[] | null {
  if (!Array.isArray(value) || value.length !== expectedLength) return null
  const values = value.map((item) => {
    if (typeof item === 'number') return item
    if (typeof item === 'string' && item.trim()) return Number(item)
    return Number.NaN
  })
  return values.every((item) => Number.isFinite(item)) ? values : null
}

export function parseChartArtifact(rawText: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    return { ok: false, error: 'Chart data must be valid JSON.' }
  }

  if (!isRecord(parsed)) return { ok: false, error: 'Chart data must be an object.' }

  const type = normalizeChartType(parsed.type ?? parsed.chartType)
  if (!type) return { ok: false, error: 'Chart type must be bar, line, or pie.' }

  if (!Array.isArray(parsed.labels) || parsed.labels.length === 0 || parsed.labels.length > MAX_CHART_LABELS) {
    return { ok: false, error: `Chart labels must contain 1-${MAX_CHART_LABELS} items.` }
  }

  const labels = parsed.labels.map((label) => cleanText(label, MAX_CHART_LABEL_CHARS))
  if (labels.some((label) => !label)) return { ok: false, error: 'Chart labels must be strings.' }

  const rawSeries = Array.isArray(parsed.series) ? parsed.series : null
  const series: ChartSeries[] = []

  if (rawSeries) {
    if (rawSeries.length === 0 || rawSeries.length > MAX_CHART_SERIES) {
      return { ok: false, error: `Chart series must contain 1-${MAX_CHART_SERIES} items.` }
    }

    for (const item of rawSeries) {
      if (!isRecord(item)) return { ok: false, error: 'Chart series entries must be objects.' }
      const values = parseFiniteValues(item.values, labels.length)
      if (!values) return { ok: false, error: 'Each chart series must match the label count.' }
      series.push({
        name: cleanText(item.name, MAX_CHART_LABEL_CHARS) || DEFAULT_SERIES_NAME,
        values,
        color: cleanColor(item.color),
      })
    }
  } else {
    const values = parseFiniteValues(parsed.values, labels.length)
    if (!values) return { ok: false, error: 'Chart values must match the label count.' }
    series.push({ name: cleanText(parsed.name, MAX_CHART_LABEL_CHARS) || DEFAULT_SERIES_NAME, values })
  }

  return {
    ok: true,
    chart: {
      type,
      title: cleanText(parsed.title, MAX_CHART_TITLE_CHARS) || undefined,
      labels,
      series,
    },
  }
}

function getValueRange(series: ChartSeries[]) {
  const values = series.flatMap((item) => item.values)
  const minValue = Math.min(0, ...values)
  const maxValue = Math.max(0, ...values)
  const span = maxValue - minValue
  return {
    minValue,
    maxValue,
    span: span > 0 ? span : 1,
  }
}

function formatValue(value: number): string {
  return Math.abs(value) >= 1000
    ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function truncateLabel(label: string): string {
  return label.length > 12 ? `${label.slice(0, 11)}...` : label
}

function BarChart({ chart }: { chart: ChartArtifact }) {
  const width = 640
  const height = 280
  const padding = { top: 28, right: 28, bottom: 52, left: 56 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const { minValue, maxValue, span } = getValueRange(chart.series)
  const zeroY = padding.top + ((maxValue - 0) / span) * plotHeight
  const groupWidth = plotWidth / chart.labels.length
  const barGap = 4
  const barWidth = Math.max(8, (groupWidth - 18) / chart.series.length - barGap)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title ?? 'Bar chart'} className="w-full h-auto">
      <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="currentColor" className="text-gray-300 dark:text-gray-700" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="currentColor" className="text-gray-300 dark:text-gray-700" />
      {[minValue, maxValue].map((value) => {
        const y = padding.top + ((maxValue - value) / span) * plotHeight
        return (
          <g key={value}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" className="text-gray-200 dark:text-gray-800" strokeDasharray="4 6" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-gray-500 dark:fill-gray-400 text-[11px]">
              {formatValue(value)}
            </text>
          </g>
        )
      })}
      {chart.labels.map((label, labelIndex) => {
        const xStart = padding.left + labelIndex * groupWidth + 9
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: chart labels may repeat; index keeps SVG groups deterministic
          <g key={`${label}-${labelIndex}`}>
            {chart.series.map((item, seriesIndex) => {
              const value = item.values[labelIndex]
              const y = padding.top + ((maxValue - Math.max(value, 0)) / span) * plotHeight
              const barHeight = Math.abs(value / span) * plotHeight
              const x = xStart + seriesIndex * (barWidth + barGap)
              const isNegative = value < 0
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: series order is part of the chart schema
                <rect
                  key={`${item.name}-${seriesIndex}`}
                  x={x}
                  y={isNegative ? zeroY : y}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  rx={3}
                  fill={item.color ?? CHART_COLORS[seriesIndex % CHART_COLORS.length]}
                />
              )
            })}
            <text x={padding.left + labelIndex * groupWidth + groupWidth / 2} y={height - 24} textAnchor="middle" className="fill-gray-600 dark:fill-gray-300 text-[11px]">
              {truncateLabel(label)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function LineChart({ chart }: { chart: ChartArtifact }) {
  const width = 640
  const height = 280
  const padding = { top: 28, right: 28, bottom: 52, left: 56 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const { minValue, maxValue, span } = getValueRange(chart.series)
  const xStep = chart.labels.length > 1 ? plotWidth / (chart.labels.length - 1) : plotWidth

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title ?? 'Line chart'} className="w-full h-auto">
      {[0, 0.5, 1].map((ratio) => {
        const value = maxValue - span * ratio
        const y = padding.top + plotHeight * ratio
        return (
          <g key={ratio}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" className="text-gray-200 dark:text-gray-800" strokeDasharray="4 6" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-gray-500 dark:fill-gray-400 text-[11px]">
              {formatValue(value)}
            </text>
          </g>
        )
      })}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="currentColor" className="text-gray-300 dark:text-gray-700" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="currentColor" className="text-gray-300 dark:text-gray-700" />
      {chart.series.map((item, seriesIndex) => {
        const points = item.values.map((value, valueIndex) => {
          const x = padding.left + valueIndex * xStep
          const y = padding.top + ((maxValue - value) / span) * plotHeight
          return { x, y }
        })
        const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
        const color = item.color ?? CHART_COLORS[seriesIndex % CHART_COLORS.length]
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: series order is part of the chart schema
          <g key={`${item.name}-${seriesIndex}`}>
            <path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, pointIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: point order is part of the chart series data
              <circle key={`${item.name}-${pointIndex}`} cx={point.x} cy={point.y} r={4} fill={color} stroke="white" strokeWidth={1.5} />
            ))}
          </g>
        )
      })}
      {chart.labels.map((label, labelIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: chart labels may repeat; index keeps SVG labels deterministic
        <text key={`${label}-${labelIndex}`} x={padding.left + labelIndex * xStep} y={height - 24} textAnchor="middle" className="fill-gray-600 dark:fill-gray-300 text-[11px]">
          {truncateLabel(label)}
        </text>
      ))}
    </svg>
  )
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  }
}

function describeArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle)
  const end = polarToCartesian(centerX, centerY, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
}

function PieChart({ chart }: { chart: ChartArtifact }) {
  const width = 640
  const height = 280
  const centerX = 176
  const centerY = 140
  const radius = 92
  const values = chart.series[0].values.map((value) => Math.max(0, value))
  const total = values.reduce((sum, value) => sum + value, 0) || 1
  let currentAngle = 0

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.title ?? 'Pie chart'} className="w-full h-auto">
      {values.map((value, index) => {
        const angle = (value / total) * 360
        const path = describeArc(centerX, centerY, radius, currentAngle, currentAngle + angle)
        currentAngle += angle
        // biome-ignore lint/suspicious/noArrayIndexKey: pie slices follow schema order and labels may repeat
        return <path key={`${chart.labels[index]}-${index}`} d={path} fill={CHART_COLORS[index % CHART_COLORS.length]} />
      })}
      <circle cx={centerX} cy={centerY} r={46} className="fill-white dark:fill-gray-950" />
      <text x={centerX} y={centerY - 3} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100 text-[18px] font-semibold">
        {formatValue(total)}
      </text>
      <text x={centerX} y={centerY + 17} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400 text-[11px]">
        Total
      </text>
      {chart.labels.map((label, index) => {
        const y = 62 + index * 24
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: legend rows follow label order and labels may repeat
          <g key={`${label}-${index}`}>
            <rect x={328} y={y - 11} width={12} height={12} rx={3} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            <text x={350} y={y} className="fill-gray-700 dark:fill-gray-200 text-[12px]">
              {truncateLabel(label)}
            </text>
            <text x={600} y={y} textAnchor="end" className="fill-gray-500 dark:fill-gray-400 text-[12px]">
              {formatValue(values[index])}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function ChartLegend({ chart }: { chart: ChartArtifact }) {
  if (chart.type === 'pie' || chart.series.length <= 1) return null
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pb-2">
      {chart.series.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: legend rows follow series order and names may repeat
        <span key={`${item.name}-${index}`} className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }}
          />
          {item.name}
        </span>
      ))}
    </div>
  )
}

export function ChartBlock({ chart }: { chart: ChartArtifact }) {
  return (
    <figure className="my-3 overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
      {chart.title && (
        <figcaption className="border-b border-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
          {chart.title}
        </figcaption>
      )}
      <div className="px-2 py-2">
        {chart.type === 'bar' && <BarChart chart={chart} />}
        {chart.type === 'line' && <LineChart chart={chart} />}
        {chart.type === 'pie' && <PieChart chart={chart} />}
      </div>
      <ChartLegend chart={chart} />
    </figure>
  )
}
