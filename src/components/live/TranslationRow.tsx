/**
 * TranslationRow — translated counterpart of SegmentRow.
 * Shows the speaker badge (read-only) and the translated text with a slight
 * typewriter delay so translation appears after the original transcript.
 *
 * Extracted from LiveTranslatePage.tsx (was 28 inline lines).
 * Feature-specific: belongs to the Live Translate feature.
 */
import { useTypewriter } from '../../hooks/useTypewriter'
import { SpeakerBadge } from './SpeakerBadge'
import { SPEAKER_COLORS } from './speakerColors'

interface TranslationRowProps {
  speaker: string
  text: string
  speakerNameMap: Record<string, string>
}

export function TranslationRow({ speaker, text, speakerNameMap }: TranslationRowProps) {
  const displayName = speakerNameMap[speaker] || speaker
  const colorIdx = (Number(speaker.replace(/\D/g, '')) - 1) % SPEAKER_COLORS.length
  const colorClass = SPEAKER_COLORS[Math.max(0, colorIdx)]

  // Typewriter with slight delay so translation appears after transcript
  const displayedText = useTypewriter(text, 55)

  return (
    <div className="flex items-start gap-2">
      <SpeakerBadge name={displayName} colorClass={colorClass} />
      <span className="text-sm font-medium text-blue-700 dark:text-blue-300 leading-relaxed">
        {displayedText}
        {displayedText !== text && (
          <span className="inline-block ml-0.5 w-0.5 h-3.5 bg-blue-400 dark:bg-blue-600 animate-pulse align-middle" />
        )}
      </span>
    </div>
  )
}
