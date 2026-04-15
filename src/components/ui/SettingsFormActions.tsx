/**
 * SettingsFormActions — cancel + submit button pair for settings forms.
 * Handles optional submitting spinner and disabled state.
 * Extracted from SettingsPage (preset add/edit forms, token create form).
 */
import { SpinnerIcon } from './icons'

interface SettingsFormActionsProps {
  onCancel: () => void
  onSubmit: () => void
  cancelLabel: string
  submitLabel: string
  /** Disables the submit button (e.g. when required fields are empty). */
  disabled?: boolean
  /** Shows a spinner on the submit button while an async action is running. */
  submitting?: boolean
  /**
   * 'sm' → py-1 padding (compact inline forms)
   * 'md' → py-1.5 padding (default, roomier forms)
   */
  size?: 'sm' | 'md'
  /** Adds pt-1 top-padding to the container row. */
  topPadding?: boolean
}

export function SettingsFormActions({
  onCancel,
  onSubmit,
  cancelLabel,
  submitLabel,
  disabled = false,
  submitting = false,
  size = 'md',
  topPadding = false,
}: SettingsFormActionsProps) {
  const py = size === 'sm' ? 'py-1' : 'py-1.5'

  return (
    <div className={`flex gap-2 justify-end${topPadding ? ' pt-1' : ''}`}>
      <button
        type="button"
        onClick={onCancel}
        className={`px-3 ${py} text-xs rounded-lg border border-gray-200 dark:border-gray-600
                   text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer`}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || submitting}
        className={`flex items-center gap-1.5 px-3 ${py} text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white
                   disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer font-medium`}
      >
        {submitting && <SpinnerIcon className="w-3 h-3 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  )
}
