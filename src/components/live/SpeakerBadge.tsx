/**
 * SpeakerBadge — colored pill badge for a speaker in live transcript.
 *
 * Two modes:
 *  - Read-only (no onRename): renders as a <span>
 *  - Renameable (onRename provided): renders as a <button>, click reveals
 *    an inline text input for renaming the speaker.
 *
 * Used by SegmentRow (renameable), TranslationRow (read-only),
 * and SpeakerAnalysisText (read-only).
 */
import { useState } from 'react'
import { PencilIcon } from '../ui/icons'

interface SpeakerBadgeProps {
  /** Display name of the speaker */
  name: string
  /** Tailwind bg+text color class from SPEAKER_COLORS */
  colorClass: string
  /**
   * When provided the badge becomes a rename button.
   * Called with the new name when the user confirms.
   */
  onRename?: (newName: string) => void
  /** Extra Tailwind utility to override margin/spacing */
  className?: string
}

export function SpeakerBadge({
  name,
  colorClass,
  onRename,
  className = '',
}: SpeakerBadgeProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [value, setValue] = useState(name)

  if (isRenaming) {
    const submit = () => {
      if (value.trim()) onRename?.(value.trim())
      setIsRenaming(false)
    }
    return (
      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
        <input
          // biome-ignore lint/a11y/noAutofocus: intentional for rename UX
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setIsRenaming(false)
          }}
          onBlur={submit}
          className="w-20 px-1.5 py-0.5 text-[10px] rounded-full border border-blue-300 dark:border-blue-700
                     bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                     focus:outline-none focus:border-blue-500"
        />
      </div>
    )
  }

  if (onRename) {
    return (
      <button
        type="button"
        onClick={() => { setValue(name); setIsRenaming(true) }}
        title="Click to rename speaker"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                    flex-shrink-0 mt-0.5 cursor-pointer hover:opacity-80 group ${colorClass} ${className}`}
      >
        {name}
        <PencilIcon className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
    )
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold
                  flex-shrink-0 mt-0.5 ${colorClass} ${className}`}
    >
      {name}
    </span>
  )
}
