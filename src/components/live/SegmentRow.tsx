/**
 * SegmentRow — one realtime transcript segment with a click-to-rename speaker
 * badge and a word-by-word typewriter reveal animation.
 *
 * Extracted from LiveTranslatePage.tsx (was 62 inline lines).
 * Feature-specific: belongs to the Live Translate feature.
 */
import { useTypewriter } from '../../hooks/useTypewriter'
import { SpeakerBadge } from './SpeakerBadge'
import { SPEAKER_COLORS } from './speakerColors'

interface SegmentRowProps {
  speaker: string
  text: string
  speakerNameMap: Record<string, string>
  onRename: (original: string, newName: string) => void
}

export function SegmentRow({ speaker, text, speakerNameMap, onRename }: SegmentRowProps) {
  const displayName = speakerNameMap[speaker] || speaker
  const colorIdx = (Number(speaker.replace(/\D/g, '')) - 1) % SPEAKER_COLORS.length
  const colorClass = SPEAKER_COLORS[Math.max(0, colorIdx)]

  // Typewriter effect — reveals text word by word when segment first appears
  const displayedText = useTypewriter(text)

  return (
    <div className="flex items-start gap-2">
      <SpeakerBadge
        name={displayName}
        colorClass={colorClass}
        onRename={(newName) => onRename(speaker, newName)}
      />
      <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {displayedText}
        {displayedText !== text && (
          <span className="inline-block ml-0.5 w-0.5 h-3.5 bg-gray-400 dark:bg-gray-500 animate-pulse align-middle" />
        )}
      </span>
    </div>
  )
}
