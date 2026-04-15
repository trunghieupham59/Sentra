/**
 * TtsVoicePicker — coloured badge-buttons for picking a TTS voice.
 * Extracted from SettingsPage (TTS Voice › Voice preview badges row).
 */
import type { TtsVoice } from '../../types'
import { RadioCheckedIcon } from './icons'

const VOICE_COLORS: Record<TtsVoice, string> = {
  alloy:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  echo:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  fable:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  onyx:    'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  nova:    'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  shimmer: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

interface TtsVoicePickerProps {
  value: TtsVoice
  onChange: (voice: TtsVoice) => void
}

export function TtsVoicePicker({ value, onChange }: TtsVoicePickerProps) {
  return (
    <div className="px-4 py-3 flex flex-wrap gap-2">
      {(Object.keys(VOICE_COLORS) as TtsVoice[]).map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            'border transition-all duration-150 cursor-pointer select-none',
            value === id
              ? `${VOICE_COLORS[id]} border-current ring-1 ring-current`
              : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700',
          ].join(' ')}
        >
          {value === id && <RadioCheckedIcon className="w-3 h-3" />}
          {id.charAt(0).toUpperCase() + id.slice(1)}
        </button>
      ))}
    </div>
  )
}
