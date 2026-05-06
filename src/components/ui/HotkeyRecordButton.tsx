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
        'btn-secondary btn-sm min-w-[160px] justify-center text-center font-mono',
        isRecording
          ? 'border-gray-400 bg-gray-50 text-gray-700 ring-2 ring-gray-300/50 dark:bg-gray-950 dark:text-gray-300'
          : value
            ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
            : 'border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800/50',
      ].join(' ')}
    >
      {isRecording ? recordingText : value || noneText}
    </button>
  )
}
