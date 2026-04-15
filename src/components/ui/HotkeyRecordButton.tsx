/**
 * HotkeyRecordButton — keyboard-shortcut recorder input styled as a button.
 * Shows three visual states: idle (empty), set (shows current value),
 * recording (captures the next key combination).
 * Extracted from SettingsPage (Global Hotkey › Shortcut recorder row).
 */
import type { KeyboardEventHandler, RefObject } from 'react'

interface HotkeyRecordButtonProps {
  inputRef: RefObject<HTMLButtonElement>
  isRecording: boolean
  value: string
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>
  onClick: () => void
  onBlur: () => void
  recordingText: string
  noneText: string
}

export function HotkeyRecordButton({
  inputRef,
  isRecording,
  value,
  onKeyDown,
  onClick,
  onBlur,
  recordingText,
  noneText,
}: HotkeyRecordButtonProps) {
  return (
    <button
      ref={inputRef}
      type="button"
      onKeyDown={isRecording ? onKeyDown : undefined}
      onClick={onClick}
      onBlur={onBlur}
      className={[
        'px-3 py-1.5 rounded-lg text-xs font-mono border transition-all min-w-[160px] text-center',
        isRecording
          ? 'bg-blue-50 dark:bg-blue-950 border-blue-400 text-blue-700 dark:text-blue-300 ring-2 ring-blue-300/50'
          : value
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'
            : 'bg-gray-50 dark:bg-gray-800/50 border-dashed border-gray-300 dark:border-gray-600 text-gray-400',
      ].join(' ')}
    >
      {isRecording ? recordingText : value || noneText}
    </button>
  )
}
