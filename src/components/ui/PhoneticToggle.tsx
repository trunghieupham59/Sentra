/**
 * PhoneticToggle — styled dropdown to choose phonetic reading mode.
 *
 * Options:
 *  - off      — no phonetic annotations
 *  - standard — ruby/furigana annotations above original characters ({word|reading} format)
 *  - phonetic — pure phonetic transcription (hiragana-only, pinyin-only, romanization-only, IPA)
 */
import type { PhoneticMode } from '../../types'
import { ChevronDownIcon, SpinnerIcon } from './icons'

interface PhoneticToggleProps {
  phoneticMode: PhoneticMode
  onChange: (mode: PhoneticMode) => void
  /** Label for the "off" option */
  labelOff: string
  /** Label for the "standard" option */
  labelStandard: string
  /** Label for the "full phonetic transcription" option */
  labelPhonetic: string
  /** Show a loading spinner when phonetic text is being generated */
  isLoading?: boolean
}

export function PhoneticToggle({
  phoneticMode,
  onChange,
  labelOff,
  labelStandard,
  labelPhonetic,
  isLoading = false,
}: PhoneticToggleProps) {
  const currentLabel =
    phoneticMode === 'off' ? labelOff
    : phoneticMode === 'standard' ? labelStandard
    : labelPhonetic

  const isActive = phoneticMode !== 'off'

  return (
    <div className="relative">
      {/* Visible styled button */}
      <div className={[
        'btn-select w-44 pointer-events-none whitespace-nowrap',
        isActive ? 'btn-select-active' : '',
      ].join(' ')}>
        <span>{currentLabel}</span>
        {isLoading
          ? <SpinnerIcon className="w-3 h-3 animate-spin opacity-70 flex-shrink-0" />
          : <ChevronDownIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
        }
      </div>

      {/* Native select overlay */}
      <select
        value={phoneticMode}
        onChange={(e) => onChange(e.target.value as PhoneticMode)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
      >
        <option value="off">{labelOff}</option>
        <option value="standard">{labelStandard}</option>
        <option value="phonetic">{labelPhonetic}</option>
      </select>
    </div>
  )
}
