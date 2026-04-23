/**
 * PhoneticToggle — styled dropdown to choose phonetic reading mode.
 * Options: off | standard | full phonetic transcription
 */
import { useRef } from 'react'
import { ChevronDownIcon, SpinnerIcon } from './icons'

type PhoneticInternalMode = 'off' | 'standard' | 'phonetic'

interface PhoneticToggleProps {
  showFurigana: boolean
  onChange: (value: boolean) => void
  /** Label for the "off" option */
  labelOff: string
  /** Label for the "standard" option */
  labelStandard: string
  /** Label for the "full phonetic" option */
  labelPhonetic: string
  /** Show a loading spinner when phonetic text is being generated */
  isLoading?: boolean
}

export function PhoneticToggle({
  showFurigana,
  onChange,
  labelOff,
  labelStandard,
  labelPhonetic,
  isLoading = false,
}: PhoneticToggleProps) {
  // Remember which "on" sub-mode was last selected
  const lastOnMode = useRef<'standard' | 'phonetic'>('standard')

  const currentMode: PhoneticInternalMode = showFurigana ? lastOnMode.current : 'off'

  const handleChange = (mode: PhoneticInternalMode) => {
    if (mode === 'off') {
      onChange(false)
    } else {
      lastOnMode.current = mode
      onChange(true)
    }
  }

  const currentLabel =
    currentMode === 'off' ? labelOff
    : currentMode === 'standard' ? labelStandard
    : labelPhonetic

  return (
    <div className="relative">
      {/* Visible styled button */}
      <div className={[
        'flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-full text-[13px] font-medium w-44',
        'border pointer-events-none select-none whitespace-nowrap',
        showFurigana
          ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400'
          : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400',
      ].join(' ')}>
        <span>{currentLabel}</span>
        {isLoading
          ? <SpinnerIcon className="w-3 h-3 animate-spin opacity-70 flex-shrink-0" />
          : <ChevronDownIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
        }
      </div>

      {/* Native select overlay */}
      <select
        value={currentMode}
        onChange={(e) => handleChange(e.target.value as PhoneticInternalMode)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[13px]"
      >
        <option value="off">{labelOff}</option>
        <option value="standard">{labelStandard}</option>
        <option value="phonetic">{labelPhonetic}</option>
      </select>
    </div>
  )
}
