/**
 * FuriganaText — renders text that may contain furigana annotations.
 *
 * Expected format from AI: {漢字|かんじ}
 * Example: "私は{学生|がくせい}です。{東京|とうきょう}に住んでいます。"
 * Renders using HTML <ruby> / <rt> elements.
 */

interface FuriganaTextProps {
  text: string
  className?: string
}

interface TextSegment {
  type: 'plain' | 'ruby'
  base: string
  reading?: string
}

function parseSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const pattern = /\{([^|{}]+)\|([^|{}]+)\}/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const matchIndex = match.index ?? 0
    if (matchIndex > lastIndex) {
      segments.push({ type: 'plain', base: text.slice(lastIndex, matchIndex) })
    }
    segments.push({ type: 'ruby', base: match[1], reading: match[2] })
    lastIndex = matchIndex + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'plain', base: text.slice(lastIndex) })
  }

  return segments
}

export function FuriganaText({ text, className }: FuriganaTextProps) {
  const segments = parseSegments(text)

  // If no ruby segments found, render as plain text
  const hasRuby = segments.some((s) => s.type === 'ruby')
  if (!hasRuby) {
    return (
      <p className={className} style={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </p>
    )
  }

  return (
    <p className={className} style={{ whiteSpace: 'pre-wrap', lineHeight: '2.6' }}>
      {/* Fix HC-NEW: use index-based keys to avoid collision when same base/reading repeats */}
      {segments.map((seg, idx) =>
        seg.type === 'ruby' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable index — segment order is fixed after parsing
          <ruby key={`seg-${idx}`}>
            {seg.base}
            <rt style={{ fontSize: '0.55em', color: 'inherit', opacity: 0.75 }}>
              {seg.reading}
            </rt>
          </ruby>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable index
          <span key={`seg-${idx}`}>{seg.base}</span>
        )
      )}
    </p>
  )
}
