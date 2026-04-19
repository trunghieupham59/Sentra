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
  RadioCheckedIcon,
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
  /** Current UI translation strings */
  t: Translations
}

export function SystemPromptDropdown({
  chatSystemPrompt,
  systemPromptPresets,
  activePreset,
  onSetChatSystemPrompt,
  onNavigateSettings,
  t,
}: SystemPromptDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    if (!showDropdown) return
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showDropdown])

  const isActive = Boolean(chatSystemPrompt || activePreset)

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setShowDropdown((v) => !v)}
        title={t.chat_system_prompt}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border
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
        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl
                        border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">

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

          {/* Footer: navigate to settings */}
          <div className="px-3 py-2.5 flex items-center justify-end border-t border-gray-100 dark:border-gray-700">
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
