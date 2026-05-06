import type { PhoneticMode, TranslationStyle } from '../../types'
import { ModelSelector } from '../ModelSelector'
import { AutoTranslateToggle } from '../ui/AutoTranslateToggle'
import { ChevronDownIcon } from '../ui/icons'
import { PhoneticToggle } from '../ui/PhoneticToggle'

interface TranslateToolbarProps {
  translationStyle: TranslationStyle
  onStyleChange: (style: TranslationStyle) => void
  autoTranslate: boolean
  onAutoTranslateChange: (v: boolean) => void
  phoneticMode: PhoneticMode
  onPhoneticModeChange: (mode: PhoneticMode) => void
  isPhoneticLoading: boolean
  /** When true, hides the embedded ModelSelector (useful when parent renders it separately) */
  hideModelSelector?: boolean
  // i18n
  labelStyleLabel: string
  labelStyleGeneral: string
  labelStyleFormal: string
  labelStyleCasual: string
  labelStyleBusiness: string
  labelStyleTechnical: string
  labelStyleNatural: string
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
  phoneticMode, onPhoneticModeChange, isPhoneticLoading,
  hideModelSelector = false,
  labelStyleLabel,
  labelStyleGeneral, labelStyleFormal, labelStyleCasual,
  labelStyleBusiness, labelStyleTechnical, labelStyleNatural,
  labelPhoneticOff, labelPhoneticStandard, labelPhoneticTranscription,
  labelPhoneticSection, labelAutoSection,
  titleAutoMode, titleManualMode, labelAutoMode, labelManualMode,
}: TranslateToolbarProps) {
  return (
    <div className="flex items-end gap-3 overflow-hidden flex-wrap">
      {!hideModelSelector && (
        <div className="flex-1 min-w-0 overflow-hidden">
          <ModelSelector />
        </div>
      )}

      <div className="flex items-end gap-3 flex-shrink-0">
        {/* Style dropdown with label above */}
        <div className="flex flex-col items-start gap-1">
          <span className="ui-kicker whitespace-nowrap">
            {labelStyleLabel}
          </span>
          <div className="relative">
            <select
              value={translationStyle}
              onChange={(e) => onStyleChange(e.target.value as TranslationStyle)}
              className={`select-field w-36 pl-3 pr-8
                          ${translationStyle !== 'general'
                            ? 'bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-400'
                            : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                          }`}
            >
              <option value="general">{labelStyleGeneral}</option>
              <option value="formal">{labelStyleFormal}</option>
              <option value="casual">{labelStyleCasual}</option>
              <option value="business">{labelStyleBusiness}</option>
              <option value="technical">{labelStyleTechnical}</option>
              <option value="natural">{labelStyleNatural}</option>
            </select>
            <div className="pointer-events-none absolute right-2 inset-y-0 flex items-center">
              <ChevronDownIcon className="w-3 h-3 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Phonetic dropdown with label above */}
        <div className="flex flex-col items-start gap-1">
          <span className="ui-kicker whitespace-nowrap">
            {labelPhoneticSection}
          </span>
          <PhoneticToggle
            phoneticMode={phoneticMode}
            onChange={onPhoneticModeChange}
            labelOff={labelPhoneticOff}
            labelStandard={labelPhoneticStandard}
            labelPhonetic={labelPhoneticTranscription}
            isLoading={isPhoneticLoading}
          />
        </div>

        {/* Auto/Manual toggle with label above */}
        <div className="flex flex-col items-start gap-1">
          <span className="ui-kicker whitespace-nowrap">
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
