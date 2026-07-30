import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../../../store/useAppStore'
import type { PhoneticMode, TranslationReasoningEffort, TranslationStyle } from '../../../types'
import { type TranslateSettingsSubview, TranslateToolbar } from '../../translate/TranslateToolbar'
import { AutoTranslateToggle } from '../../ui/AutoTranslateToggle'
import { Button } from '../../ui/atoms'
import { ChevronLeftIcon, GearIcon, XIcon } from '../../ui/icons'

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
}

/** Compact translation utility bar with an anchored AI settings region. */
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
}: TranslationControlsHeaderProps) {
  const t = useT()
  const optionsId = useId()
  const optionsTriggerRef = useRef<HTMLButtonElement>(null)
  const optionsPanelRef = useRef<HTMLElement>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [settingsSubview, setSettingsSubview] = useState<TranslateSettingsSubview | null>(null)
  const [modelPickerCloseRequest, setModelPickerCloseRequest] = useState(0)

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
  const activeOptionsSummary = [
    translationStyle !== 'general' ? styleLabels[translationStyle] : null,
    phoneticMode !== 'off' ? phoneticLabels[phoneticMode] : null,
  ].filter(Boolean).join(' · ')
  const optionsPanelTitle = settingsSubview === 'models'
    ? t.model_picker_choose
    : t.translate_options

  useEffect(() => {
    if (!optionsOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (settingsSubview) return
      setOptionsOpen(false)
      setSettingsSubview(null)
      optionsTriggerRef.current?.focus()
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (optionsTriggerRef.current?.contains(target) || optionsPanelRef.current?.contains(target)) {
        return
      }
      setOptionsOpen(false)
      setSettingsSubview(null)
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [optionsOpen, settingsSubview])

  return (
    <div className="translate-header-stack">
      <header className="translate-page-header">
        <h1 id={titleId} className="translate-page-title">{t.nav_translate}</h1>

        <fieldset className="translate-header-controls">
          <legend className="sr-only">{t.translate_controls_label}</legend>
          <AutoTranslateToggle
            autoTranslate={autoTranslate}
            onChange={onAutoTranslateChange}
            titleAuto={t.translate_mode_auto_title}
            titleManual={t.translate_mode_manual_title}
            labelAuto={t.translate_mode_auto}
            labelManual={t.translate_mode_manual}
          />
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
              setSettingsSubview(null)
            }}
            className="translate-options-trigger"
          >
            <GearIcon />
            <span>{t.translate_options}</span>
            {activeOptionsSummary && (
              <span className="translate-options-trigger-summary">{activeOptionsSummary}</span>
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
          aria-label={optionsPanelTitle}
        >
          <header className="translate-options-panel-header">
            <div className="translate-options-panel-heading">
              {settingsSubview && (
                <Button
                  size="sm"
                  shape="icon"
                  variant="neutral"
                  appearance="ghost"
                  aria-label={t.model_picker_back}
                  onClick={() => setModelPickerCloseRequest((request) => request + 1)}
                >
                  <ChevronLeftIcon />
                </Button>
              )}
              <h2 className="translate-options-panel-title">{optionsPanelTitle}</h2>
            </div>
            <Button
              size="sm"
              shape="icon"
              variant="neutral"
              appearance="ghost"
              aria-label={t.settings_close}
              onClick={() => {
                setOptionsOpen(false)
                setSettingsSubview(null)
                optionsTriggerRef.current?.focus()
              }}
              className="translate-options-panel-close"
            >
              <XIcon />
            </Button>
          </header>
          <TranslateToolbar
            hideAutoToggle
            inlineModelSelector
            modelPickerCloseRequest={modelPickerCloseRequest}
            onModelPickerViewChange={setSettingsSubview}
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
            labelManualMode={t.translate_mode_manual}
          />
        </section>
      )}
    </div>
  )
}
