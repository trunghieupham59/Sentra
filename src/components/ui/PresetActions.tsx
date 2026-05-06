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
          className="btn-icon btn-icon-sm border-transparent bg-transparent shadow-none"
        >
          <CheckIcon />
        </button>
      )}
      {/* Apply to current prompt */}
      <button
        type="button"
        onClick={onApply}
        title={applyTitle}
        className="btn-icon btn-icon-sm border-transparent bg-transparent shadow-none"
      >
        <ClipboardIcon className="w-3.5 h-3.5" />
      </button>
      {/* Edit */}
      <button
        type="button"
        onClick={onEdit}
        className="btn-icon btn-icon-sm border-transparent bg-transparent shadow-none"
      >
        <PencilIcon />
      </button>
      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        title={deleteTitle}
        className="btn-icon btn-icon-sm btn-icon-danger"
      >
        <TrashIcon />
      </button>
    </div>
  )
}
