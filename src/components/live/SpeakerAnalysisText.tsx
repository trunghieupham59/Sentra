/**
 * SpeakerAnalysisText — renders an AI-generated meeting analysis text that
 * uses the `[SpeakerName]: content` format produced by the summarization model.
 *
 * Each `[Speaker]: ...` line is rendered with a colored speaker badge.
 * Plain lines (no bracket prefix) are rendered as paragraphs.
 *
 * Extracted from LiveTranslatePage.tsx (was 33 inline lines).
 * Feature-specific: belongs to the Live Translate / post-meeting analysis feature.
 */
import { SpeakerBadge } from './SpeakerBadge'
import { SPEAKER_COLORS } from './speakerColors'

interface SpeakerAnalysisTextProps {
  text: string
}

export function SpeakerAnalysisText({ text }: SpeakerAnalysisTextProps) {
  const lines = text.split('\n').filter(Boolean)
  const speakerColorMap = new Map<string, string>()

  return (
    <div className="space-y-1.5 text-xs">
      {lines.map((line, i) => {
        const match = line.match(/^\[([^\]]+)\]:\s*(.*)/)
        if (match) {
          const label = match[1]
          const content = match[2]
          if (!speakerColorMap.has(label)) {
            speakerColorMap.set(label, SPEAKER_COLORS[speakerColorMap.size % SPEAKER_COLORS.length])
          }
          const colorClass = speakerColorMap.get(label) ?? SPEAKER_COLORS[0]
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable index for conversation lines
            <div key={i} className="flex items-start gap-2">
              <SpeakerBadge name={label} colorClass={colorClass} className="mt-0" />
              <span className="text-gray-700 dark:text-gray-300 leading-relaxed pt-0.5">{content}</span>
            </div>
          )
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable index for conversation lines
          <p key={i} className="text-gray-600 dark:text-gray-400 leading-relaxed">{line}</p>
        )
      })}
    </div>
  )
}
