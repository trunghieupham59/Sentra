import { useState } from 'react'
import { PlusIcon } from '../../components/ui/icons'
import { PresetActions } from '../../components/ui/PresetActions'
import { SettingsFormActions } from '../../components/ui/SettingsFormActions'
import { useAppStore, useT } from '../../store/useAppStore'
import type { SystemPromptPreset } from '../../types'

export function ChatPresetsSection() {
  const {
    systemPromptPresets, addSystemPromptPreset, updateSystemPromptPreset,
    deleteSystemPromptPreset, setDefaultSystemPromptPreset, setChatSystemPrompt,
  } = useAppStore()
  const t = useT()

  const [showAddForm, setShowAddForm] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetContent, setNewPresetContent] = useState('')
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editContent, setEditContent] = useState('')

  const handleAddPreset = () => {
    if (!newPresetName.trim() || !newPresetContent.trim()) return
    addSystemPromptPreset({ name: newPresetName.trim(), content: newPresetContent.trim() })
    setNewPresetName('')
    setNewPresetContent('')
    setShowAddForm(false)
  }

  const startEdit = (preset: SystemPromptPreset) => {
    setEditingPresetId(preset.id)
    setEditName(preset.name)
    setEditContent(preset.content)
  }

  const saveEdit = () => {
    if (!editingPresetId || !editName.trim() || !editContent.trim()) return
    updateSystemPromptPreset(editingPresetId, { name: editName.trim(), content: editContent.trim() })
    setEditingPresetId(null)
  }

  const cancelEdit = () => setEditingPresetId(null)

  return (
    <section className="space-y-3">
      <h2 className="section-label">{t.settings_chat_section}</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">{t.settings_chat_section_desc}</p>

      <div className="card divide-y divide-gray-100 dark:divide-gray-700">
        <div className="px-4 py-3.5 space-y-3">

          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_chat_presets}</p>
            <button
              type="button"
              onClick={() => { setShowAddForm((v) => !v); setEditingPresetId(null) }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
                         bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400
                         hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800"
            >
              <PlusIcon />
              {t.settings_chat_preset_add}
            </button>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-2 border border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={t.settings_chat_preset_name_placeholder}
                className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                           rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 dark:focus:border-blue-600
                           text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <textarea
                value={newPresetContent}
                onChange={(e) => setNewPresetContent(e.target.value)}
                placeholder={t.chat_system_prompt_placeholder}
                rows={3}
                className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                           rounded-lg px-3 py-1.5 outline-none resize-none focus:border-blue-400 dark:focus:border-blue-600
                           text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <SettingsFormActions
                onCancel={() => { setShowAddForm(false); setNewPresetName(''); setNewPresetContent('') }}
                onSubmit={handleAddPreset}
                cancelLabel={t.settings_chat_preset_cancel}
                submitLabel={t.settings_chat_preset_save}
                disabled={!newPresetName.trim() || !newPresetContent.trim()}
                size="sm"
              />
            </div>
          )}

          {/* Preset list */}
          {systemPromptPresets.length === 0 && !showAddForm ? (
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-2">{t.settings_chat_presets_empty}</p>
          ) : (
            <div className="space-y-2">
              {systemPromptPresets.map((preset) => (
                <div key={preset.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {editingPresetId === preset.id ? (
                    /* Edit mode */
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder={t.settings_chat_preset_name_placeholder}
                        className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                                   rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 dark:focus:border-blue-600
                                   text-gray-800 dark:text-gray-200 placeholder-gray-400"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                        className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                                   rounded-lg px-3 py-1.5 outline-none resize-none focus:border-blue-400 dark:focus:border-blue-600
                                   text-gray-800 dark:text-gray-200"
                      />
                      <SettingsFormActions
                        onCancel={cancelEdit}
                        onSubmit={saveEdit}
                        cancelLabel={t.settings_chat_preset_cancel}
                        submitLabel={t.settings_chat_preset_save}
                        disabled={!editName.trim() || !editContent.trim()}
                        size="sm"
                      />
                    </div>
                  ) : (
                    /* View mode */
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-white dark:bg-gray-800/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{preset.name}</span>
                          {preset.isDefault && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-medium">
                              {t.settings_chat_preset_is_default}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{preset.content}</p>
                      </div>
                      <PresetActions
                        isDefault={preset.isDefault ?? false}
                        onSetDefault={() => {
                          setDefaultSystemPromptPreset(preset.id)
                          setChatSystemPrompt(preset.content)
                        }}
                        onApply={() => setChatSystemPrompt(preset.content)}
                        onEdit={() => startEdit(preset)}
                        onDelete={() => deleteSystemPromptPreset(preset.id)}
                        setDefaultTitle={t.settings_chat_preset_set_default}
                        applyTitle={t.settings_preset_use_prompt}
                        deleteTitle={t.settings_chat_preset_delete}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </section>
  )
}
