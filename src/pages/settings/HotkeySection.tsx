import { useCallback, useEffect, useRef, useState } from 'react'
import { HotkeyRecordButton } from '../../components/ui/HotkeyRecordButton'
import { ToggleSwitch } from '../../components/ui/ToggleSwitch'
import { SpinnerIcon, XIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'

const DEFAULT_HOTKEY = 'Alt+Shift+T'

const KEY_MAP: Record<string, string> = {
  ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Escape: 'Escape', Enter: 'Return', Backspace: 'Backspace', Delete: 'Delete',
  Tab: 'Tab', F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4', F5: 'F5', F6: 'F6',
  F7: 'F7', F8: 'F8', F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
}

export function HotkeySection() {
  const { selectedProvider, selectedModels, targetLang } = useAppStore()
  const t = useT()

  const [hotkeyEnabled, setHotkeyEnabled] = useState(false)
  const [hotkeyValue, setHotkeyValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [hotkeyError, setHotkeyError] = useState('')
  const [hotkeyStatus, setHotkeyStatus] = useState<'idle' | 'translating' | 'done' | 'error'>('idle')
  const [hotkeyStatusMsg, setHotkeyStatusMsg] = useState('')
  const hotkeyInputRef = useRef<HTMLButtonElement>(null)

  const hotkeyProvider = selectedProvider
  const hotkeyModel = selectedModels[selectedProvider]
  const hotkeyTargetLang = targetLang

  // Load saved hotkey settings on mount
  useEffect(() => {
    if (!window.api?.hotkey) return
    window.api.hotkey.get().then((res: { success: boolean; settings?: Record<string, unknown> }) => {
      if (res?.success && res.settings) {
        const s = res.settings
        setHotkeyEnabled(s.enabled === true)
        setHotkeyValue(typeof s.hotkey === 'string' && s.hotkey ? s.hotkey : DEFAULT_HOTKEY)
      } else {
        setHotkeyValue(DEFAULT_HOTKEY)
      }
    })
  }, [])

  // Listen for hotkey feedback events from main process
  useEffect(() => {
    if (!window.api?.hotkey) return
    const unsub1 = window.api.hotkey.onTranslating(() => {
      setHotkeyStatus('translating')
      setHotkeyStatusMsg(t.settings_hotkey_status_translating)
    })
    const unsub2 = window.api.hotkey.onTranslated(() => {
      setHotkeyStatus('done')
      setHotkeyStatusMsg(t.settings_hotkey_status_done)
      setTimeout(() => setHotkeyStatus('idle'), 3000)
    })
    const unsub3 = window.api.hotkey.onError((data: { error: string }) => {
      setHotkeyStatus('error')
      setHotkeyStatusMsg(data?.error ?? t.settings_hotkey_status_error)
      setTimeout(() => setHotkeyStatus('idle'), 5000)
    })
    return () => { unsub1(); unsub2(); unsub3() }
  }, [t])

  const saveHotkeySettings = useCallback(async (overrides: Record<string, unknown> = {}) => {
    if (!window.api?.hotkey) return
    const settings = {
      hotkey: hotkeyValue,
      enabled: hotkeyEnabled,
      provider: hotkeyProvider,
      model: hotkeyModel,
      targetLang: hotkeyTargetLang,
      ...overrides,
    }
    const res = await window.api.hotkey.update(settings)
    if (!res?.success && res?.error) {
      setHotkeyError(res.error)
      setHotkeyEnabled(false)
    } else {
      setHotkeyError('')
    }
  }, [hotkeyValue, hotkeyEnabled, hotkeyProvider, hotkeyModel, hotkeyTargetLang])

  // Convert a KeyboardEvent to an Electron accelerator string
  const keyEventToAccelerator = (e: React.KeyboardEvent): string => {
    const parts: string[] = []
    if (e.metaKey)  parts.push('Command')
    if (e.ctrlKey)  parts.push('Ctrl')
    if (e.altKey)   parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    const key = e.key
    if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
      parts.push(KEY_MAP[key] ?? key.toUpperCase())
    }
    return parts.join('+')
  }

  // Auto-sync hotkey settings to backend whenever store values change
  // biome-ignore lint/correctness/useExhaustiveDependencies: saveHotkeySettings is stable via useCallback; hotkeyEnabled/hotkeyValue accessed inside
  useEffect(() => {
    if (!window.api?.hotkey || !hotkeyValue) return
    saveHotkeySettings()
  }, [hotkeyProvider, hotkeyModel, hotkeyTargetLang])

  const handleHotkeyKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    if (e.key === 'Escape') {
      setIsRecording(false)
      return
    }
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return
    const acc = keyEventToAccelerator(e)
    if (acc) {
      setHotkeyValue(acc)
      setIsRecording(false)
      saveHotkeySettings({ hotkey: acc })
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="section-label">{t.settings_hotkey_section}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_hotkey_section_desc}</p>
      </div>

      <div className="card divide-y divide-gray-100 dark:divide-gray-700">

        {/* Enable toggle */}
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_hotkey_enabled}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_hotkey_enabled_desc}</p>
          </div>
          <ToggleSwitch
            checked={hotkeyEnabled}
            onChange={(next) => {
              setHotkeyEnabled(next)
              saveHotkeySettings({ enabled: next })
            }}
            color="green"
          />
        </div>

        {/* Shortcut recorder */}
        <div className="px-4 py-3.5 space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_hotkey_label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_hotkey_desc}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {hotkeyValue && !isRecording && (
                <button
                  type="button"
                  onClick={() => {
                    setHotkeyValue('')
                    setHotkeyEnabled(false)
                    saveHotkeySettings({ hotkey: '', enabled: false })
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                  title={t.settings_hotkey_clear}
                >
                  <XIcon />
                </button>
              )}
              <HotkeyRecordButton
                inputRef={hotkeyInputRef}
                isRecording={isRecording}
                value={hotkeyValue}
                onKeyDown={handleHotkeyKeyDown}
                onClick={() => setIsRecording(true)}
                onBlur={() => setIsRecording(false)}
                recordingText={t.settings_hotkey_recording}
                noneText={t.settings_hotkey_none}
              />
            </div>
          </div>
          {hotkeyError && (
            <p className="text-xs text-red-500 dark:text-red-400">{hotkeyError}</p>
          )}
        </div>

        {/* Status indicator */}
        {hotkeyStatus !== 'idle' && (
          <div className={`px-4 py-3 flex items-center gap-2 text-xs ${
            hotkeyStatus === 'translating' ? 'text-blue-600 dark:text-blue-400' :
            hotkeyStatus === 'done' ? 'text-green-600 dark:text-green-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {hotkeyStatus === 'translating' && <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />}
            <span>{hotkeyStatusMsg}</span>
          </div>
        )}

      </div>
    </section>
  )
}
