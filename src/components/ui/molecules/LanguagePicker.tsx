import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import type { Language } from '../../../types'
import { Button, Input } from '../atoms'
import { CheckIcon, ChevronDownIcon, SearchIcon, SpinnerIcon } from '../icons'

const VIEWPORT_MARGIN = 8
const PICKER_GAP = 6
const PICKER_MAX_HEIGHT = 360

interface PickerPosition {
  top: number
  left: number
  width: number
  maxHeight: number
  placement: 'above' | 'below'
}

export interface LanguagePickerProps {
  value: string
  options: readonly Language[]
  onChange: (language: string) => void
  getLabel: (language: Language) => string
  label?: string
  labelVisuallyHidden?: boolean
  searchPlaceholder: string
  noResultsLabel: string
  status?: string
  statusBusy?: boolean
  disabled?: boolean
  className?: string
}

/** App-owned searchable language picker used instead of an OS-native select. */
export function LanguagePicker({
  value,
  options,
  onChange,
  getLabel,
  label,
  labelVisuallyHidden = false,
  searchPlaceholder,
  noResultsLabel,
  status,
  statusBusy = false,
  disabled = false,
  className = '',
}: LanguagePickerProps) {
  const triggerId = useId()
  const labelId = useId()
  const panelId = useId()
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef(new Map<string, HTMLButtonElement>())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<PickerPosition | null>(null)

  const selectedLanguage = options.find((language) => language.code === value) ?? options[0]
  const selectedLabel = selectedLanguage ? getLabel(selectedLanguage) : value
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter((language) => (
      getLabel(language).toLocaleLowerCase().includes(normalizedQuery)
      || language.name.toLocaleLowerCase().includes(normalizedQuery)
      || language.nativeName.toLocaleLowerCase().includes(normalizedQuery)
      || language.code.toLocaleLowerCase().includes(normalizedQuery)
    ))
  }, [getLabel, normalizedQuery, options])

  const closePicker = useCallback((restoreFocus = false) => {
    setOpen(false)
    setQuery('')
    setPosition(null)
    if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const availableBelow = window.innerHeight - rect.bottom - PICKER_GAP - VIEWPORT_MARGIN
    const availableAbove = rect.top - PICKER_GAP - VIEWPORT_MARGIN
    const placement = availableBelow >= Math.min(PICKER_MAX_HEIGHT, availableAbove) ? 'below' : 'above'
    const maxHeight = Math.max(180, Math.min(PICKER_MAX_HEIGHT, placement === 'below' ? availableBelow : availableAbove))
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - VIEWPORT_MARGIN * 2)
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.left),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN),
    )
    const top = placement === 'below'
      ? rect.bottom + PICKER_GAP
      : Math.max(VIEWPORT_MARGIN, rect.top - PICKER_GAP - maxHeight)

    setPosition({ top, left, width, maxHeight, placement })
  }, [])

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      updatePosition()
      searchRef.current?.focus()
    })
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closePicker()
    }
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closePicker(true)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [closePicker, open, updatePosition])

  const selectLanguage = (language: Language) => {
    if (language.code !== value) onChange(language.code)
    closePicker(true)
  }

  const focusOption = (code: string) => {
    window.requestAnimationFrame(() => optionRefs.current.get(code)?.focus())
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowDown' || filteredOptions.length === 0) return
    event.preventDefault()
    const selectedIsVisible = filteredOptions.some((language) => language.code === value)
    focusOption(selectedIsVisible ? value : filteredOptions[0].code)
  }

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowDown') nextIndex = Math.min(index + 1, filteredOptions.length - 1)
    if (event.key === 'ArrowUp') nextIndex = index === 0 ? null : index - 1
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = filteredOptions.length - 1
    if (nextIndex === null) {
      if (event.key === 'ArrowUp' && index === 0) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      return
    }
    event.preventDefault()
    focusOption(filteredOptions[nextIndex].code)
  }

  const picker = open && createPortal(
    <div
      ref={panelRef}
      id={panelId}
      role="dialog"
      aria-label={label ?? selectedLabel}
      className={`language-picker-panel language-picker-panel--${position?.placement ?? 'below'}`}
      style={{
        position: 'fixed',
        top: position?.top ?? VIEWPORT_MARGIN,
        left: position?.left ?? VIEWPORT_MARGIN,
        width: position?.width ?? 280,
        maxHeight: position?.maxHeight ?? PICKER_MAX_HEIGHT,
        visibility: position ? 'visible' : 'hidden',
        zIndex: 9999,
      }}
    >
      <div className="language-picker-search-shell">
        <SearchIcon className="language-picker-search-icon" />
        <Input
          ref={searchRef}
          size="md"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          aria-controls={listId}
          className="language-picker-search"
        />
      </div>

      <div id={listId} role="listbox" aria-label={label ?? selectedLabel} className="language-picker-list">
        {filteredOptions.length === 0 && (
          <p className="language-picker-empty" role="status">{noResultsLabel}</p>
        )}
        {filteredOptions.map((language, index) => {
          const localizedLabel = getLabel(language)
          const showNativeName = language.code !== 'auto' && language.nativeName !== localizedLabel
          const isSelected = language.code === value

          return (
            <Button
              key={language.code}
              ref={(node) => {
                if (node) optionRefs.current.set(language.code, node)
                else optionRefs.current.delete(language.code)
              }}
              size="md"
              shape="rect"
              variant={isSelected ? 'primary' : 'neutral'}
              appearance={isSelected ? 'soft' : 'ghost'}
              role="option"
              aria-selected={isSelected}
              onClick={() => selectLanguage(language)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              className="language-picker-option"
            >
              <span className="language-picker-option-copy">
                <span className="language-picker-option-label">{localizedLabel}</span>
                {showNativeName && (
                  <span className="language-picker-option-native">{language.nativeName}</span>
                )}
              </span>
              {isSelected && <CheckIcon className="language-picker-check" />}
            </Button>
          )
        })}
      </div>
    </div>,
    document.body,
  )

  return (
    <div className={`language-picker${className ? ` ${className}` : ''}`}>
      {label && (
        <span
          id={labelId}
          className={labelVisuallyHidden ? 'sr-only' : 'language-picker-label'}
        >
          {label}
        </span>
      )}
      <Button
        ref={triggerRef}
        id={triggerId}
        size="md"
        shape="rect"
        variant={open ? 'primary' : 'neutral'}
        appearance={open ? 'soft' : 'outline'}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-labelledby={label ? `${labelId} ${triggerId}` : undefined}
        aria-label={label ? undefined : selectedLabel}
        onClick={() => {
          if (open) {
            closePicker()
            return
          }
          updatePosition()
          setOpen(true)
        }}
        className="language-picker-trigger"
      >
        <span className="language-picker-trigger-label">{selectedLabel}</span>
        {status && (
          <span className="language-picker-trigger-status" role="status" aria-live="polite">
            {statusBusy && <SpinnerIcon className="language-picker-status-spinner" />}
            <span>{status}</span>
          </span>
        )}
        <ChevronDownIcon className={`language-picker-chevron${open ? ' language-picker-chevron--open' : ''}`} />
      </Button>
      {picker}
    </div>
  )
}
