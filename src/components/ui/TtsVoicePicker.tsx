/**
 * TtsVoicePicker — badge-buttons for picking a TTS voice.
 * Extracted from SettingsPage (TTS Voice › Voice preview badges row).
 */
import type { TtsVoice } from '../../types'
import { RadioCheckedIcon } from './icons'

const VOICES: TtsVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

interface TtsVoicePickerProps {
  value: TtsVoice
  onChange: (voice: TtsVoice) => void
}

export function TtsVoicePicker({ value, onChange }: TtsVoicePickerProps) {
  return (
    <div className="px-4 py-3 flex flex-wrap gap-2">
      {VOICES.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
            'border transition-all duration-150 cursor-pointer select-none',
            value === id
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-400 dark:border-blue-600 ring-1 ring-blue-400 dark:ring-blue-600'
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
