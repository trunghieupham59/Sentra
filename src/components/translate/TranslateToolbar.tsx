import { useId, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import type { PhoneticMode, TranslationReasoningEffort, TranslationStyle } from '../../types'
import { getEffectiveTranslationReasoningEffort, getTranslationReasoningEfforts } from '../../utils/translationReasoning'
import { type ModelPickerInlineView, ModelSelector } from '../ModelSelector'
import { AutoTranslateToggle } from '../ui/AutoTranslateToggle'
import { PhoneticToggle } from '../ui/PhoneticToggle'

export type TranslateSettingsSubview = ModelPickerInlineView

interface TranslateToolbarProps {
  translationStyle: TranslationStyle
  onStyleChange: (style: TranslationStyle) => void
  reasoningEffort: TranslationReasoningEffort
  onReasoningEffortChange: (effort: TranslationReasoningEffort) => void
  autoTranslate: boolean
  onAutoTranslateChange: (v: boolean) => void
  phoneticMode: PhoneticMode
  onPhoneticModeChange: (mode: PhoneticMode) => void
  isPhoneticLoading: boolean
  /** When true, hides the embedded ModelSelector (useful when parent renders it separately) */
  hideModelSelector?: boolean
  /** When true, the owning surface renders the always-visible Auto/Manual control. */
  hideAutoToggle?: boolean
  /** Keeps the model drill-down inside this toolbar surface. */
  inlineModelSelector?: boolean
  modelPickerCloseRequest?: number
  onModelPickerViewChange?: (view: ModelPickerInlineView | null) => void
  // i18n
  labelModel: string
  labelReasoning: string
  labelReasoningAuto: string
  labelReasoningLow: string
  labelReasoningMedium: string
  labelReasoningHigh: string
  labelReasoningUnsupported: string
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
}

export function TranslateToolbar({
  translationStyle, onStyleChange,
  reasoningEffort, onReasoningEffortChange,
  autoTranslate, onAutoTranslateChange,
  phoneticMode, onPhoneticModeChange, isPhoneticLoading,
  hideModelSelector = false,
  hideAutoToggle = false,
  inlineModelSelector = false,
  modelPickerCloseRequest = 0,
  onModelPickerViewChange,
  labelModel,
  labelReasoning,
  labelReasoningAuto, labelReasoningLow, labelReasoningMedium, labelReasoningHigh,
  labelReasoningUnsupported,
  labelStyleLabel,
  labelStyleGeneral, labelStyleFormal, labelStyleCasual,
  labelStyleBusiness, labelStyleTechnical, labelStyleNatural,
  labelPhoneticOff, labelPhoneticStandard, labelPhoneticTranscription,
  labelPhoneticSection, labelAutoSection,
  titleAutoMode, titleManualMode, labelAutoMode,
}: TranslateToolbarProps) {
  const styleId = useId()
  const reasoningId = useId()
  const phoneticId = useId()
  const [modelPickerView, setModelPickerView] = useState<ModelPickerInlineView | null>(null)
  const selectedProvider = useAppStore((state) => state.selectedProvider)
  const selectedModel = useAppStore((state) => state.selectedModels[state.selectedProvider])
  const supportedReasoningEfforts = getTranslationReasoningEfforts(selectedProvider, selectedModel)
  const reasoningConfigurable = supportedReasoningEfforts.length > 1
  const effectiveReasoningEffort = getEffectiveTranslationReasoningEffort(
    selectedProvider,
    selectedModel,
    reasoningEffort,
  )
  const modelPickerOpen = modelPickerView !== null
  const showSecondaryControls = !inlineModelSelector || !modelPickerOpen
  const handleModelPickerViewChange = (view: ModelPickerInlineView | null) => {
    setModelPickerView(view)
    onModelPickerViewChange?.(view)
  }

  const reasoningControl = (
    <div className="translate-setting-control translate-setting-control-reasoning">
      <label htmlFor={reasoningId} className="translate-setting-label">
        {labelReasoning}
      </label>
      <select
        id={reasoningId}
        value={effectiveReasoningEffort}
        disabled={!reasoningConfigurable}
        title={!reasoningConfigurable ? labelReasoningUnsupported : undefined}
        onChange={(event) => onReasoningEffortChange(event.target.value as TranslationReasoningEffort)}
        className="select-field translate-setting-select"
      >
        <option value="auto">
          {reasoningConfigurable ? labelReasoningAuto : labelReasoningUnsupported}
        </option>
        {reasoningConfigurable && <option value="low">{labelReasoningLow}</option>}
        {reasoningConfigurable && <option value="medium">{labelReasoningMedium}</option>}
        {reasoningConfigurable && <option value="high">{labelReasoningHigh}</option>}
      </select>
    </div>
  )

  return (
    <div className={`translate-settings-grid${modelPickerOpen ? ' translate-settings-grid-model-open' : ''}`}>
      {!hideModelSelector && (
        <div className={`translate-setting-control translate-setting-control-model${modelPickerOpen ? ' translate-setting-control-model-open' : ''}`}>
          {!modelPickerOpen && <span className="translate-setting-label">{labelModel}</span>}
          <ModelSelector
            inline={inlineModelSelector}
            directModelList={inlineModelSelector}
            hideTriggerWhenOpen={inlineModelSelector}
            closeRequest={modelPickerCloseRequest}
            onInlineViewChange={handleModelPickerViewChange}
          />
        </div>
      )}

      {showSecondaryControls && <div className="translate-setting-control">
          <label htmlFor={styleId} className="translate-setting-label">
            {labelStyleLabel}
          </label>
          <div className="relative">
            <select
              id={styleId}
              value={translationStyle}
              onChange={(e) => onStyleChange(e.target.value as TranslationStyle)}
              className="select-field translate-setting-select"
            >
              <option value="general">{labelStyleGeneral}</option>
              <option value="formal">{labelStyleFormal}</option>
              <option value="casual">{labelStyleCasual}</option>
              <option value="business">{labelStyleBusiness}</option>
              <option value="technical">{labelStyleTechnical}</option>
              <option value="natural">{labelStyleNatural}</option>
            </select>
          </div>
      </div>}

      {showSecondaryControls && <div className="translate-setting-control">
          <label htmlFor={phoneticId} className="translate-setting-label">
            {labelPhoneticSection}
          </label>
          <PhoneticToggle
            id={phoneticId}
            phoneticMode={phoneticMode}
            onChange={onPhoneticModeChange}
            labelOff={labelPhoneticOff}
            labelStandard={labelPhoneticStandard}
            labelPhonetic={labelPhoneticTranscription}
            isLoading={isPhoneticLoading}
          />
      </div>}

      {showSecondaryControls && reasoningControl}

      {showSecondaryControls && !hideAutoToggle && (
        <div className="translate-setting-control">
          <span className="translate-setting-label">
            {labelAutoSection}
          </span>
          <AutoTranslateToggle
            autoTranslate={autoTranslate}
            onChange={onAutoTranslateChange}
            titleOn={titleAutoMode}
            titleOff={titleManualMode}
            label={labelAutoMode}
          />
        </div>
      )}
    </div>
  )
}
