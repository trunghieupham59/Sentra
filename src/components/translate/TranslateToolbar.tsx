import type { TranslationStyle } from '../../types'
import { ModelSelector } from '../ModelSelector'
import { AutoTranslateToggle } from '../ui/AutoTranslateToggle'
import { ChevronDownIcon } from '../ui/icons'
import { PhoneticToggle } from '../ui/PhoneticToggle'

interface TranslateToolbarProps {
  translationStyle: TranslationStyle
  onStyleChange: (style: TranslationStyle) => void
  autoTranslate: boolean
  onAutoTranslateChange: (v: boolean) => void
  showFurigana: boolean
  onShowFuriganaChange: (v: boolean) => void
  isPhoneticLoading: boolean
  // i18n
  labelStyleLabel: string
  labelStyleFriendly: string
  labelStyleNeutral: string
  labelStyleProfessional: string
  labelStyleBusiness: string
  labelStyleSlack: string
  labelStylePolite: string
  labelStyleTechnical: string
  labelPhonetic: string
  titleAutoMode: string
  titleManualMode: string
  labelAutoMode: string
  labelManualMode: string
}

export function TranslateToolbar({
  translationStyle, onStyleChange,
  autoTranslate, onAutoTranslateChange,
  showFurigana, onShowFuriganaChange, isPhoneticLoading,
  labelStyleLabel, labelStyleFriendly, labelStyleNeutral,
  labelStyleProfessional, labelStyleBusiness, labelStyleSlack,
  labelStylePolite, labelStyleTechnical,
  labelPhonetic, titleAutoMode, titleManualMode, labelAutoMode, labelManualMode,
}: TranslateToolbarProps) {
  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 overflow-hidden
                    bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
      <div className="flex-1 min-w-0 overflow-hidden">
        <ModelSelector />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Style dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 whitespace-nowrap">{labelStyleLabel}</span>
          <div className="relative">
            <select
              value={translationStyle}
              onChange={(e) => onStyleChange(e.target.value as TranslationStyle)}
              className={`text-xs font-medium px-2.5 py-1.5 pr-6 rounded-full border appearance-none cursor-pointer
                          transition-colors duration-200 outline-none
                          ${translationStyle !== 'neutral'
                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400'
                            : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                          }`}
            >
              <option value="friendly">{labelStyleFriendly}</option>
              <option value="neutral">{labelStyleNeutral}</option>
              <option value="professional">{labelStyleProfessional}</option>
              <option value="business">{labelStyleBusiness}</option>
              <option value="slack">{labelStyleSlack}</option>
              <option value="polite">{labelStylePolite}</option>
              <option value="technical">{labelStyleTechnical}</option>
            </select>
            <div className="pointer-events-none absolute right-2 inset-y-0 flex items-center">
              <ChevronDownIcon className="w-3 h-3 text-gray-400" />
            </div>
          </div>
        </div>

        <AutoTranslateToggle
          autoTranslate={autoTranslate}
          onChange={onAutoTranslateChange}
          titleAuto={titleAutoMode}
          titleManual={titleManualMode}
          labelAuto={labelAutoMode}
          labelManual={labelManualMode}
        />

        <PhoneticToggle
          showFurigana={showFurigana}
          onChange={onShowFuriganaChange}
          label={labelPhonetic}
          isLoading={isPhoneticLoading}
        />
      </div>
    </div>
  )
}
