/**
 * SystemPromptDropdown — dropdown button + panel for selecting a system prompt preset
 * in ChatPage.
 *
 * Extracted from ChatPage.tsx to keep that component focused on chat flow and
 * message rendering.
 */
import { useEffect, useRef, useState } from 'react'
import type { Translations } from '../../i18n'
import type { SystemPromptPreset } from '../../types'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  PlusIcon,
  RadioCheckedIcon,
  XIcon,
} from '../ui/icons'

interface SystemPromptDropdownProps {
  /** Currently active system prompt text */
  chatSystemPrompt: string
  /** All available presets */
  systemPromptPresets: SystemPromptPreset[]
  /** The preset whose content matches chatSystemPrompt, or null */
  activePreset: SystemPromptPreset | null
  /** Called when the user selects a preset or clears the prompt */
  onSetChatSystemPrompt: (prompt: string) => void
  /** Called when the user clicks "Settings →" to navigate to settings page */
  onNavigateSettings: () => void
  /** Called when the user saves a new preset from the inline form */
  onAddPreset: (preset: Omit<SystemPromptPreset, 'id'>) => string
  /** Current UI translation strings */
  t: Translations
}

export function SystemPromptDropdown({
  chatSystemPrompt,
  systemPromptPresets,
  activePreset,
  onSetChatSystemPrompt,
  onNavigateSettings,
  onAddPreset,
  t,
}: SystemPromptDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Close when clicking outside
  useEffect(() => {
    if (!showDropdown) return
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setShowAddForm(false)
        setNewName('')
        setNewContent('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showDropdown])

  // Focus name input when form opens
  useEffect(() => {
    if (showAddForm) {
      const FOCUS_DEFER_MS = 50  // Wait one tick for DOM to mount before focusing
      setTimeout(() => nameInputRef.current?.focus(), FOCUS_DEFER_MS)
    }
  }, [showAddForm])

  const isActive = Boolean(chatSystemPrompt || activePreset)

  const handleOpenAddForm = () => {
    setNewName('')
    setNewContent('')
    setShowAddForm(true)
  }

  const handleCancelAdd = () => {
    setShowAddForm(false)
    setNewName('')
    setNewContent('')
  }

  const handleSavePreset = () => {
    const name = newName.trim()
    const content = newContent.trim()
    if (!name || !content) return
    onAddPreset({ name, content, isDefault: false })
    setShowAddForm(false)
    setNewName('')
    setNewContent('')
    // Auto-select the new preset
    onSetChatSystemPrompt(content)
    setShowDropdown(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setShowDropdown((v) => !v)}
        title={t.chat_system_prompt}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border
                    transition-all duration-200 select-none cursor-pointer whitespace-nowrap
                    ${isActive
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-400'
                      : 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'}`}
      >
        <DocumentIcon />
        <span className="max-w-[120px] truncate">
          {activePreset ? activePreset.name : t.chat_system_prompt}
        </span>
        {isActive && (
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
        )}
        <ChevronDownIcon className="w-2.5 h-2.5 flex-shrink-0" />
      </button>

      {/* Dropdown panel */}
      {showDropdown && (
        <div className="floating-panel absolute right-0 top-full mt-1 w-72 z-50 overflow-hidden">

          {/* Header */}
          <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider
                         border-b border-gray-100 dark:border-gray-700">
            {t.settings_chat_presets}
          </p>

          {/* None option */}
          <button
            type="button"
            onClick={() => { onSetChatSystemPrompt(''); setShowDropdown(false) }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer
                        flex items-center gap-2
                        ${!chatSystemPrompt
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium">{t.chat_system_prompt_none}</span>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t.chat_system_prompt_none_desc}</p>
            </div>
            {!chatSystemPrompt && (
              <RadioCheckedIcon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            )}
          </button>

          {/* Presets list */}
          <div className="border-t border-gray-100 dark:border-gray-700">
            {systemPromptPresets.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 dark:text-gray-600">
                {t.settings_chat_presets_empty}
              </p>
            ) : (
              systemPromptPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onSetChatSystemPrompt(preset.content)
                    setShowDropdown(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer
                               flex items-start gap-2
                               ${chatSystemPrompt === preset.content
                                 ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                                 : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate">{preset.name}</span>
                      {preset.isDefault && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 shrink-0">
                          {t.settings_chat_preset_is_default}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {preset.content}
                    </p>
                  </div>
                  {chatSystemPrompt === preset.content && (
                    <RadioCheckedIcon className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Inline Add Preset Form */}
          {showAddForm && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {t.settings_chat_preset_add}
              </p>
              <input
                ref={nameInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.settings_chat_preset_name_placeholder}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                           bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500
                           transition-colors"
              />
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder={t.chat_system_prompt_placeholder}
                rows={3}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                           bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500
                           resize-none transition-colors"
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  className="text-xs px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400
                             hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  {t.settings_chat_preset_cancel}
                </button>
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={!newName.trim() || !newContent.trim()}
                  className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500 text-white
                             hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors cursor-pointer"
                >
                  {t.settings_chat_preset_save}
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-3 py-2.5 flex items-center justify-between border-t border-gray-100 dark:border-gray-700">
            {/* Add Preset button */}
            {!showAddForm ? (
              <button
                type="button"
                onClick={handleOpenAddForm}
                className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer
                           transition-colors flex items-center gap-1"
              >
                <PlusIcon />
                {t.settings_chat_preset_add}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelAdd}
                className="text-xs text-gray-400 dark:text-gray-500 hover:underline cursor-pointer
                           transition-colors flex items-center gap-1"
              >
                <XIcon className="w-3 h-3" />
                {t.settings_chat_preset_cancel}
              </button>
            )}

            {/* Navigate to settings */}
            <button
              type="button"
              onClick={() => { setShowDropdown(false); onNavigateSettings() }}
              className="text-xs text-blue-500 dark:text-blue-400 hover:underline cursor-pointer transition-colors flex items-center gap-1"
            >
              {t.settings_title}
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
