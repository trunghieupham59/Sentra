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
  /** Translated label: "Đang thu âm…" / "Recording…" */
  listeningLabel: string
}

export function VoiceOverlay({
  isVoiceActive,
  listeningLabel,
}: VoiceOverlayProps) {
  if (!isVoiceActive) return null

  return (
    <div className="absolute inset-x-0 top-0 bottom-12 z-10 flex flex-col items-center justify-center
                    bg-white dark:bg-gray-900 fade-in">

      {/* ── Two-ring mic design with ping animation ── */}
      <div className="relative flex items-center justify-center mb-4 w-28 h-28">
        {/* Outer ping ring — spreads out and fades, creating blinking effect */}
        <span className="absolute w-28 h-28 rounded-full bg-blue-300 dark:bg-blue-500 animate-ping opacity-30" />
        {/* Inner circle — medium, clearly blue, pulses subtly */}
        <span className="absolute w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/60 animate-pulse" />
        {/* Mic icon — centered, blue, no solid background */}
        <MicrophoneIcon
          className="relative z-10 w-7 h-7 text-blue-500 dark:text-blue-400"
        />
      </div>

      {/* Status label */}
      <p className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400">
        {listeningLabel}
      </p>
    </div>
  )
}
