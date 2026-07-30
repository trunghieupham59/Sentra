import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../../store/useAppStore'
import type {
  PhoneticMode,
  TranslationModelSelection,
  TranslationReasoningEffort,
  TranslationStyle,
} from '../../../types'
import { TranslateToolbar } from '../../translate/TranslateToolbar'
import { AutoTranslateToggle } from '../../ui/AutoTranslateToggle'
import { Button } from '../../ui/atoms'
import { GearIcon, InfoCircleIcon, LayersIcon, XIcon } from '../../ui/icons'
import { TranslationModelDialog } from './TranslationModelDialog'

interface TranslationControlsHeaderProps {
  titleId: string
  translationStyle: TranslationStyle
  onStyleChange: (style: TranslationStyle) => void
  reasoningEffort: TranslationReasoningEffort
  onReasoningEffortChange: (effort: TranslationReasoningEffort) => void
  autoTranslate: boolean
  onAutoTranslateChange: (value: boolean) => void
  phoneticMode: PhoneticMode
  onPhoneticModeChange: (mode: PhoneticMode) => void
  isPhoneticLoading: boolean
  isComparisonMode: boolean
  translationModels: TranslationModelSelection[]
  onTranslationModelsChange: (models: TranslationModelSelection[]) => void
  onOpenSettings: () => void
}

/** Translation utility bar with a focused model dialog and compact output settings. */
export function TranslationControlsHeader({
  titleId,
  translationStyle,
  onStyleChange,
  reasoningEffort,
  onReasoningEffortChange,
  autoTranslate,
  onAutoTranslateChange,
  phoneticMode,
  onPhoneticModeChange,
  isPhoneticLoading,
  isComparisonMode,
  translationModels,
  onTranslationModelsChange,
  onOpenSettings,
}: TranslationControlsHeaderProps) {
  const t = useT()
  const optionsId = useId()
  const modelsId = useId()
  const optionsTriggerRef = useRef<HTMLButtonElement>(null)
  const modelsTriggerRef = useRef<HTMLButtonElement>(null)
  const optionsPanelRef = useRef<HTMLElement>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [modelsOpen, setModelsOpen] = useState(false)

  const styleLabels: Record<TranslationStyle, string> = {
    general: t.translate_style_general,
    formal: t.translate_style_formal,
    casual: t.translate_style_casual,
    business: t.translate_style_business,
    technical: t.translate_style_technical,
    natural: t.translate_style_natural,
  }
  const phoneticLabels: Record<Exclude<PhoneticMode, 'off'>, string> = {
    standard: t.translate_phonetic_standard,
    phonetic: t.translate_phonetic_transcription,
  }
  const reasoningLabels: Record<Exclude<TranslationReasoningEffort, 'auto'>, string> = {
    low: t.translate_reasoning_low,
    medium: t.translate_reasoning_medium,
    high: t.translate_reasoning_high,
  }
  const activeOptionsSummary = [
    translationStyle !== 'general' ? styleLabels[translationStyle] : null,
    phoneticMode !== 'off' ? phoneticLabels[phoneticMode] : null,
    reasoningEffort !== 'auto' ? reasoningLabels[reasoningEffort] : null,
  ].filter(Boolean).join(' · ')
  const hasCustomOptions = translationStyle !== 'general'
    || reasoningEffort !== 'auto'
    || phoneticMode !== 'off'

  const closeOptions = useCallback(() => {
    setOptionsOpen(false)
    optionsTriggerRef.current?.focus()
  }, [])
  const closeModels = useCallback(() => {
    setModelsOpen(false)
    requestAnimationFrame(() => modelsTriggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!optionsOpen) return

    const focusFrame = requestAnimationFrame(() => {
      optionsPanelRef.current
        ?.querySelector<HTMLElement>('.translate-setting-select:not(:disabled)')
        ?.focus()
    })
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeOptions()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        optionsTriggerRef.current?.contains(target)
        || optionsPanelRef.current?.contains(target)
      ) return
      setOptionsOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [closeOptions, optionsOpen])

  const resetOptions = () => {
    onStyleChange('general')
    onReasoningEffortChange('auto')
    onPhoneticModeChange('off')
  }

  return (
    <div className="translate-header-stack">
      <header className="translate-page-header">
        <h1 id={titleId} className="translate-page-title">{t.nav_translate}</h1>

        <fieldset className="translate-header-controls">
          <legend className="sr-only">{t.translate_controls_label}</legend>
          {isComparisonMode ? (
            <span
              className="translate-manual-mode-chip"
              title={t.translate_models_manual_notice}
            >
              <InfoCircleIcon />
              <span>{t.translate_mode_manual}</span>
            </span>
          ) : (
            <AutoTranslateToggle
              autoTranslate={autoTranslate}
              onChange={onAutoTranslateChange}
              titleOn={t.translate_mode_auto_title}
              titleOff={t.translate_mode_manual_title}
              label={t.translate_mode_auto}
            />
          )}

          <Button
            ref={modelsTriggerRef}
            size="md"
            shape="rect"
            variant={modelsOpen ? 'primary' : 'neutral'}
            appearance={modelsOpen ? 'soft' : 'outline'}
            aria-label={t.translate_models_trigger_label(translationModels.length)}
            aria-expanded={modelsOpen}
            aria-controls={modelsId}
            aria-haspopup="dialog"
            onClick={() => {
              setModelsOpen(true)
              setOptionsOpen(false)
            }}
            className="translate-models-trigger"
          >
            <LayersIcon />
            <span>{t.translate_models_trigger(translationModels.length)}</span>
          </Button>

          <Button
            ref={optionsTriggerRef}
            size="md"
            shape="rect"
            variant="neutral"
            appearance={optionsOpen ? 'soft' : 'outline'}
            aria-expanded={optionsOpen}
            aria-controls={optionsId}
            aria-haspopup="dialog"
            title={t.translate_ai_config_title}
            onClick={() => {
              setOptionsOpen((open) => !open)
              setModelsOpen(false)
            }}
            className="translate-options-trigger"
          >
            <GearIcon />
            <span>{t.translate_options}</span>
            {activeOptionsSummary && (
              <>
                <span className="translate-options-trigger-separator" aria-hidden="true">·</span>
                <span className="translate-options-trigger-summary">{activeOptionsSummary}</span>
              </>
            )}
          </Button>
        </fieldset>
      </header>

      {optionsOpen && (
        <section
          ref={optionsPanelRef}
          id={optionsId}
          className="translate-options-panel"
          role="dialog"
          aria-label={t.translate_options}
        >
          <header className="translate-options-panel-header">
            <div>
              <h2 className="translate-options-panel-title">{t.translate_options}</h2>
              <p>{t.translate_settings_scope}</p>
            </div>
            <Button
              size="sm"
              shape="icon"
              variant="neutral"
              appearance="ghost"
              aria-label={t.settings_close}
              onClick={closeOptions}
            >
              <XIcon />
            </Button>
          </header>

          <TranslateToolbar
            hideModelSelector
            hideAutoToggle
            translationStyle={translationStyle}
            onStyleChange={onStyleChange}
            reasoningEffort={reasoningEffort}
            onReasoningEffortChange={onReasoningEffortChange}
            autoTranslate={autoTranslate}
            onAutoTranslateChange={onAutoTranslateChange}
            phoneticMode={phoneticMode}
            onPhoneticModeChange={onPhoneticModeChange}
            isPhoneticLoading={isPhoneticLoading}
            labelModel={t.model_picker_model}
            labelReasoning={t.translate_reasoning_label}
            labelReasoningAuto={t.translate_reasoning_auto}
            labelReasoningLow={t.translate_reasoning_low}
            labelReasoningMedium={t.translate_reasoning_medium}
            labelReasoningHigh={t.translate_reasoning_high}
            labelReasoningUnsupported={t.translate_reasoning_unsupported}
            labelStyleLabel={t.translate_style_label}
            labelStyleGeneral={t.translate_style_general}
            labelStyleFormal={t.translate_style_formal}
            labelStyleCasual={t.translate_style_casual}
            labelStyleBusiness={t.translate_style_business}
            labelStyleTechnical={t.translate_style_technical}
            labelStyleNatural={t.translate_style_natural}
            labelPhoneticSection={t.translate_phonetic}
            labelPhoneticOff={t.translate_phonetic_off}
            labelPhoneticStandard={t.translate_phonetic_standard}
            labelPhoneticTranscription={t.translate_phonetic_transcription}
            labelAutoSection={t.settings_auto_translate}
            titleAutoMode={t.translate_mode_auto_title}
            titleManualMode={t.translate_mode_manual_title}
            labelAutoMode={t.translate_mode_auto}
          />

          {hasCustomOptions && (
            <footer className="translate-options-panel-footer">
              <Button
                size="sm"
                shape="rect"
                variant="neutral"
                appearance="ghost"
                onClick={resetOptions}
              >
                {t.translate_settings_reset}
              </Button>
            </footer>
          )}
        </section>
      )}

      {modelsOpen && (
        <TranslationModelDialog
          id={modelsId}
          models={translationModels}
          onApply={onTranslationModelsChange}
          onCancel={closeModels}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  )
}
