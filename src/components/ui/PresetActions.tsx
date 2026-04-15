/**
 * PresetActions — icon-button row for a single system-prompt preset item.
 * Renders: Set Default (conditional) · Apply · Edit · Delete.
 * Extracted from SettingsPage (AI Chat › Preset list › View mode).
 */
import { CheckIcon, ClipboardIcon, PencilIcon, TrashIcon } from './icons'

interface PresetActionsProps {
  isDefault: boolean
  onSetDefault: () => void
  onApply: () => void
  onEdit: () => void
  onDelete: () => void
  setDefaultTitle: string
  applyTitle: string
  deleteTitle: string
}

export function PresetActions({
  isDefault,
  onSetDefault,
  onApply,
  onEdit,
  onDelete,
  setDefaultTitle,
  applyTitle,
  deleteTitle,
}: PresetActionsProps) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {/* Set default */}
      {!isDefault && (
        <button
          type="button"
          onClick={onSetDefault}
          title={setDefaultTitle}
          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
        >
          <CheckIcon />
        </button>
      )}
      {/* Apply to current prompt */}
      <button
        type="button"
        onClick={onApply}
        title={applyTitle}
        className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-950 transition-colors cursor-pointer"
      >
        <ClipboardIcon className="w-3.5 h-3.5" />
      </button>
      {/* Edit */}
      <button
        type="button"
        onClick={onEdit}
        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
      >
        <PencilIcon />
      </button>
      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        title={deleteTitle}
        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
      >
        <TrashIcon />
      </button>
    </div>
  )
}
