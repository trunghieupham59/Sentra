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
  labelStyleNeutral: string
  labelStyleFriendly: string
  labelStyleProfessional: string
  labelStyleBusiness: string
  labelStyleSlack: string
  labelStylePolite: string
  labelStyleTechnical: string
  labelPhoneticOff: string
  labelPhoneticStandard: string
  labelPhoneticTranscription: string
  /** Short title displayed above the phonetic dropdown */
  labelPhoneticSection: string
  /** Short title displayed above the auto/manual toggle */
  labelAutoSection: string
  titleAutoMode: string
  titleManualMode: string
  labelAutoMode: string
  labelManualMode: string
}

export function TranslateToolbar({
  translationStyle, onStyleChange,
  autoTranslate, onAutoTranslateChange,
  showFurigana, onShowFuriganaChange, isPhoneticLoading,
  labelStyleLabel,
  labelStyleNeutral, labelStyleFriendly, labelStyleProfessional,
  labelStyleBusiness, labelStyleSlack, labelStylePolite, labelStyleTechnical,
  labelPhoneticOff, labelPhoneticStandard, labelPhoneticTranscription,
  labelPhoneticSection, labelAutoSection,
  titleAutoMode, titleManualMode, labelAutoMode, labelManualMode,
}: TranslateToolbarProps) {
  return (
    <div className="flex items-end gap-3 overflow-hidden flex-wrap">
      <div className="flex-1 min-w-0 overflow-hidden">
        <ModelSelector />
      </div>

      <div className="flex items-end gap-3 flex-shrink-0">
        {/* Style dropdown with label above */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-[0.65rem] font-medium text-gray-400 whitespace-nowrap uppercase tracking-wide">
            {labelStyleLabel}
          </span>
          <div className="relative">
            <select
              value={translationStyle}
              onChange={(e) => onStyleChange(e.target.value as TranslationStyle)}
              className={`text-[13px] font-medium px-2.5 py-1.5 pr-6 rounded-full border appearance-none cursor-pointer
                          transition-colors duration-200 outline-none w-36
                          ${translationStyle !== 'neutral'
                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400'
                            : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                          }`}
            >
              <option value="neutral">{labelStyleNeutral}</option>
              <option value="friendly">{labelStyleFriendly}</option>
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

        {/* Phonetic dropdown with label above */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-[0.65rem] font-medium text-gray-400 whitespace-nowrap uppercase tracking-wide">
            {labelPhoneticSection}
          </span>
          <PhoneticToggle
            showFurigana={showFurigana}
            onChange={onShowFuriganaChange}
            labelOff={labelPhoneticOff}
            labelStandard={labelPhoneticStandard}
            labelPhonetic={labelPhoneticTranscription}
            isLoading={isPhoneticLoading}
          />
        </div>

        {/* Auto/Manual toggle with label above */}
        <div className="flex flex-col items-start gap-1">
          <span className="text-[0.65rem] font-medium text-gray-400 whitespace-nowrap uppercase tracking-wide">
            {labelAutoSection}
          </span>
          <AutoTranslateToggle
            autoTranslate={autoTranslate}
            onChange={onAutoTranslateChange}
            titleAuto={titleAutoMode}
            titleManual={titleManualMode}
            labelAuto={labelAutoMode}
            labelManual={labelManualMode}
          />
        </div>
      </div>
    </div>
  )
}
