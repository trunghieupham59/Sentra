/**
 * VoiceOverlay — full-panel listening overlay shown while voice recording is active.
 *
 * Extracted from TranslatePage.tsx to keep that component focused on layout and
 * translation logic rather than animation details.
 */
import { MicrophoneIcon } from '../ui/icons'

interface VoiceOverlayProps {
  /** Whether the overlay is visible (voice recording is active) */
  isVoiceActive: boolean
  /** Whether the current transcript is interim (still being spoken) */
  isVoiceInterim: boolean
  /** Current transcript text to display as a preview */
  sourceText: string
  /** Translated label: "Đang nghe…" / "Listening…" */
  listeningLabel: string
  /** Translated label: "Nhấn để ghi âm" / "Press to record" */
  recordLabel: string
}

/** Ripple ring config — each ring has different size, opacity, speed and delay */
const RIPPLE_RINGS = [
  { size: 'w-28 h-28', color: 'bg-red-100 dark:bg-red-900/20', duration: '1.8s', delay: undefined },
  { size: 'w-20 h-20', color: 'bg-red-200 dark:bg-red-900/30', duration: '1.4s', delay: '0.2s' },
  { size: 'w-14 h-14', color: 'bg-red-300 dark:bg-red-900/50', duration: '1.1s', delay: '0.1s' },
] as const

export function VoiceOverlay({
  isVoiceActive,
  isVoiceInterim,
  sourceText,
  listeningLabel,
  recordLabel,
}: VoiceOverlayProps) {
  if (!isVoiceActive) return null

  return (
    <div className="absolute inset-x-0 top-0 bottom-12 z-10 flex flex-col items-center justify-center
                    bg-white dark:bg-gray-900 fade-in">
      {/* Animated rings */}
      <div className="relative flex items-center justify-center mb-5">
        {RIPPLE_RINGS.map((ring, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: stable ripple ring indices
            key={i}
            className={`absolute ${ring.size} rounded-full ${ring.color} animate-ping`}
            style={{
              animationDuration: ring.duration,
              ...(ring.delay ? { animationDelay: ring.delay } : {}),
            }}
          />
        ))}

        {/* Microphone circle */}
        <div className="relative w-16 h-16 rounded-full bg-red-500 dark:bg-red-600 flex items-center justify-center shadow-md">
          <MicrophoneIcon className="w-7 h-7 text-white" />
        </div>
      </div>

      {/* Status label */}
      <p className="text-sm font-semibold text-red-500 dark:text-red-400 animate-pulse tracking-wide mb-3">
        {listeningLabel}
      </p>

      {/* Sound-wave bars */}
      <div className="flex items-end gap-[3px] h-6 mb-4">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <span
            key={i}
            className="w-1 rounded-full bg-red-400 dark:bg-red-500 animate-bounce"
            style={{
              height: `${8 + (i % 3) * 6 + (i % 2) * 4}px`,
              animationDuration: `${0.6 + i * 0.08}s`,
              animationDelay: `${i * 0.07}s`,
            }}
          />
        ))}
      </div>

      {/* Interim / final transcript preview */}
      {sourceText ? (
        <p className={`max-w-[80%] text-center text-[13px] leading-relaxed line-clamp-3
                       ${isVoiceInterim
                         ? 'text-gray-400 dark:text-gray-500 italic'
                         : 'text-gray-700 dark:text-gray-300 font-medium'}`}>
          {sourceText}
        </p>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-600 select-none">
          {recordLabel}…
        </p>
      )}
    </div>
  )
}
