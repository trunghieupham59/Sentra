import { useCallback, useEffect, useRef, useState } from 'react'
import { useProviderModelRefresh } from '../hooks/useProviderModelRefresh'
import { useAppStore } from '../store/useAppStore'
import type { Provider } from '../types'
import { formatModelName } from '../utils/modelDisplay'
import { buildProviderModelOptions } from '../utils/modelSelection'
import { IconCheck, IconChevronDown } from './icons/AppIcons'
import ProviderIcon from './ProviderIcon'

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: 'Gemini',
  claude: 'Claude',
  openai: 'OpenAI',
  local:  'Local',
}

const ALL_PROVIDERS: Provider[] = ['gemini', 'claude', 'openai', 'local']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getModelDisplayName(
  provider: Provider,
  modelId: string,
  models: Array<{ id: string; name: string }>,
): string {
  const fallbackName = models.find((model) => model.id === modelId)?.name
  return formatModelName(provider, modelId, fallbackName)
}

interface ModelSelectorProps {
  className?: string
}

export default function ModelSelector({ className }: ModelSelectorProps) {
  const selectedProvider  = useAppStore((s) => s.selectedProvider)
  const selectedModels    = useAppStore((s) => s.selectedModels)
  const setSelectedProvider = useAppStore((s) => s.setSelectedProvider)
  const setSelectedModel  = useAppStore((s) => s.setSelectedModel)
  const dynamicModels     = useAppStore((s) => s.dynamicModels)
  const modelsLoading     = useAppStore((s) => s.modelsLoading)
  const modelsError       = useAppStore((s) => s.modelsError)
  const keyStatus         = useAppStore((s) => s.keyStatus)
  const addRecentlyUsedModel = useAppStore((s) => s.addRecentlyUsedModel)

  const [open, setOpen]               = useState(false)
  const [activeTab, setActiveTab]     = useState<Provider>(selectedProvider)
  const dropdownRef                   = useRef<HTMLDivElement>(null)
  const triggerRef                    = useRef<HTMLButtonElement>(null)

  useProviderModelRefresh(activeTab, {
    enabled: open,
    refreshKey: keyStatus[activeTab],
  })

  // Keep tab in sync when provider changes externally
  useEffect(() => { setActiveTab(selectedProvider) }, [selectedProvider])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const currentModelId = selectedModels[selectedProvider] ?? ''
  const currentProviderModels = buildProviderModelOptions(
    selectedProvider,
    dynamicModels[selectedProvider] ?? [],
  )
  const displayName = getModelDisplayName(selectedProvider, currentModelId, currentProviderModels)

  // Models for the active tab — prefer dynamic, fall back to static
  const tabModels = buildProviderModelOptions(activeTab, dynamicModels[activeTab] ?? [])

  const isLoading = modelsLoading[activeTab]
  const hasError  = modelsError[activeTab]

  const handleSelectModel = useCallback((provider: Provider, modelId: string) => {
    setSelectedProvider(provider)
    setSelectedModel(provider, modelId)
    addRecentlyUsedModel(provider, modelId)
    setOpen(false)
  }, [addRecentlyUsedModel, setSelectedProvider, setSelectedModel])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} className={className}>
      {/* Trigger button */}
      <button
        type="button"
        ref={triggerRef}
        className="btn btn-glass"
        onClick={() => setOpen((v) => !v)}
        style={{ gap: 6, paddingLeft: 8, paddingRight: 10 }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <ProviderIcon provider={selectedProvider} size={18} />
        <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
          {displayName || PROVIDER_LABELS[selectedProvider]}
        </span>
        <IconChevronDown size={12} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="glass-strong"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 200,
            borderRadius: 14,
            minWidth: 260,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            animation: 'slideUp 0.18s ease-out',
          }}
          role="listbox"
          aria-label="Select provider and model"
        >
          {/* Provider tab bar */}
          <div className="tab-bar">
            {ALL_PROVIDERS.map((p) => (
              <button
                type="button"
                key={p}
                className={`tab-item${activeTab === p ? ' active' : ''}`}
                onClick={() => setActiveTab(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none' }}
              >
                <ProviderIcon provider={p} size={14} />
                <span>{PROVIDER_LABELS[p]}</span>
              </button>
            ))}
          </div>

          {/* Model list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {isLoading && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                Loading models…
              </div>
            )}
            {!isLoading && hasError && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--danger)' }}>
                {hasError}
              </div>
            )}
            {!isLoading && tabModels.map((model) => {
              const isSelected = activeTab === selectedProvider && selectedModels[activeTab] === model.id
              return (
                <button
                  type="button"
                  key={model.id}
                  role="option"
                  aria-selected={isSelected}
                  className={isSelected ? 'nav-item active' : 'nav-item'}
                  onClick={() => handleSelectModel(activeTab, model.id)}
                  style={{ border: 'none', width: '100%', textAlign: 'left', fontSize: 12 }}
                >
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getModelDisplayName(activeTab, model.id, tabModels)}
                  </span>
                  {isSelected && <IconCheck size={13} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
