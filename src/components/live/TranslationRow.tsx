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
import { getSpeakerColorClass } from './speakerColors'

interface TranslationRowProps {
  speaker: string
  text: string
  speakerNameMap: Record<string, string>
}

export function TranslationRow({ speaker, text, speakerNameMap }: TranslationRowProps) {
  const displayName = speakerNameMap[speaker] || speaker
  const colorClass = getSpeakerColorClass(speaker)

  // Typewriter with slight delay so translation appears after transcript
  const displayedText = useTypewriter(text, 55)

  return (
    <div className="flex items-start gap-2">
      <SpeakerBadge name={displayName} colorClass={colorClass} />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed">
        {displayedText}
        {displayedText !== text && (
          <span className="inline-block ml-0.5 w-0.5 h-3.5 bg-gray-400 dark:bg-gray-600 animate-pulse align-middle" />
        )}
      </span>
    </div>
  )
}
