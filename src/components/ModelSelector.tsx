import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { dedupeModelsByFamily, formatModelName } from '../utils/modelDisplay'
import { PROVIDER_COLORS, ProviderIcon } from './ProviderIcon'
import { CheckIcon, ChevronDownIcon, SearchIcon, SpinnerIcon } from './ui/icons'

export function ModelSelector({ compact = false }: { compact?: boolean }) {
  const {
    selectedProvider, selectedModels, keyStatus,
    dynamicModels, modelsLoading, modelsError, recentModels,
    setSelectedProvider, setSelectedModel,
    setDynamicModels, setModelsLoading, setModelsError, recordModelUsage,
  } = useAppStore()
  const t = useT()

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // compact: right-align dropdown; default: left-align
      const left = compact
        ? Math.max(4, rect.right - 280)
        : rect.left
      setDropdownPos({ top: rect.bottom + 4, left })
    }
    setOpen(true)
  }

  // Close on outside click (trigger OR portal panel)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Escape to close, focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 30)
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setSearch('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const fetchModels = async (provider: Provider, forceRecommended = false) => {
    const requiresKey = PROVIDERS.find((p) => p.id === provider)?.requiresApiKey !== false
    if ((requiresKey && !keyStatus[provider]) || !window.api) return
    setModelsLoading(provider, true)
    setModelsError(provider, null)
    try {
      const result = await window.api.fetchModels(provider)
      if (result.success && result.models.length > 0) {
        setDynamicModels(provider, result.models)
        const ids = result.models.map((m) => m.id)
        const currentSelection = selectedModels[provider]
        const currentInList = Boolean(currentSelection) && ids.includes(currentSelection)
        if (forceRecommended || !currentInList) {
          const target = result.recommendedModel ?? result.models[0].id
          setSelectedModel(provider, target)
        }
      } else {
        setModelsError(provider, result.error || t.model_load_error)
      }
    } catch (err) {
      setModelsError(provider, err instanceof Error ? err.message : t.settings_hotkey_status_error)
    } finally {
      setModelsLoading(provider, false)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchModels is stable
  useEffect(() => {
    const hasKey = PROVIDERS.find((p) => p.id === selectedProvider)?.requiresApiKey === false
      || keyStatus[selectedProvider]
    if (hasKey && dynamicModels[selectedProvider].length === 0 && !modelsLoading[selectedProvider]) {
      fetchModels(selectedProvider)
    }
  }, [selectedProvider, keyStatus])

  // Build all models grouped by provider, deduplicated
  const providerGroups = useMemo(() => {
    return PROVIDERS.map((p) => {
      const dynamic = dynamicModels[p.id as Provider]
      const raw = dynamic.length > 0 ? dynamic : p.models
      const models = dedupeModelsByFamily(p.id as Provider, raw)
      return { provider: p, models }
    })
  }, [dynamicModels])

  // Current selected model display info
  const currentProviderConfig = PROVIDERS.find((p) => p.id === selectedProvider) ?? PROVIDERS[0]
  const currentDynamic = dynamicModels[selectedProvider]
  const currentRaw = currentDynamic.length > 0 ? currentDynamic : currentProviderConfig.models
  const currentDisplayModels = dedupeModelsByFamily(selectedProvider, currentRaw)
  const selectedModelId = selectedModels[selectedProvider] ?? currentDisplayModels[0]?.id ?? ''
  const selectedModelName = formatModelName(
    selectedProvider,
    selectedModelId,
    currentDisplayModels.find((m) => m.id === selectedModelId)?.name,
  )
  const isCurrentLoading = modelsLoading[selectedProvider]

  // Filter models by search
  const q = search.toLowerCase().trim()
  const filteredGroups = q
    ? providerGroups
        .map((g) => ({
          ...g,
          models: g.models.filter((m) => {
            const name = formatModelName(g.provider.id as Provider, m.id, m.name).toLowerCase()
            return name.includes(q) || g.provider.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
          }),
        }))
        .filter((g) => g.models.length > 0)
    : providerGroups

  // Resolve recent models to display info
  const recentItems = recentModels
    .map((r) => {
      const providerConf = PROVIDERS.find((p) => p.id === r.provider)
      if (!providerConf) return null
      const dynamic = dynamicModels[r.provider as Provider]
      const raw = dynamic.length > 0 ? dynamic : providerConf.models
      const model = raw.find((m) => m.id === r.modelId)
      if (!model) return null
      const displayName = formatModelName(r.provider, r.modelId, model.name)
      return { provider: r.provider, modelId: r.modelId, displayName, providerName: providerConf.name }
    })
    .filter(Boolean) as Array<{ provider: Provider; modelId: string; displayName: string; providerName: string }>

  const handleSelect = (provider: Provider, modelId: string) => {
    setSelectedProvider(provider)
    setSelectedModel(provider, modelId)
    recordModelUsage(provider, modelId)
    // Fetch dynamic models for this provider if not yet loaded
    const hasKey = PROVIDERS.find((p) => p.id === provider)?.requiresApiKey === false
      || keyStatus[provider as Provider]
    if (hasKey && dynamicModels[provider as Provider].length === 0) {
      fetchModels(provider as Provider)
    }
    setOpen(false)
    setSearch('')
  }

  const showRecent = !q && recentItems.length > 0

  const dropdownPanel = open && createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: 280,
        zIndex: 9999,
        background: 'var(--vzn-surface)',
        border: '1px solid var(--vzn-border-strong)',
        borderRadius: 'var(--vzn-radius-md)',
        boxShadow: 'var(--vzn-shadow-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Search */}
      <div className="p-2 border-b" style={{ borderColor: 'var(--vzn-divider)' }}>
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search models…"
            className="search-field text-xs h-8"
            style={{ paddingLeft: 30, paddingRight: 10 }}
          />
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
        {showRecent && (
          <div>
            <div className="px-3 pt-2.5 pb-1">
              <span className="ui-kicker">Recent</span>
            </div>
            {recentItems.map((item) => {
              const isSelected = selectedProvider === item.provider && selectedModelId === item.modelId
              return (
                <ModelRow
                  key={`recent-${item.provider}-${item.modelId}`}
                  provider={item.provider}
                  modelId={item.modelId}
                  displayName={item.displayName}
                  providerName={item.providerName}
                  isSelected={isSelected}
                  showProvider
                  onSelect={handleSelect}
                />
              )
            })}
            <div className="mx-3 my-1" style={{ height: 1, background: 'var(--vzn-divider)' }} />
          </div>
        )}

        {filteredGroups.length === 0 && (
          <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--vzn-text-soft)' }}>
            No models found
          </div>
        )}
        {filteredGroups.map((group) => {
          const provId = group.provider.id as Provider
          const hasKey = group.provider.requiresApiKey === false || keyStatus[provId]
          const isLoading = modelsLoading[provId]
          const error = modelsError[provId]
          return (
            <div key={provId}>
              <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
                <ProviderIcon provider={provId} size={11} />
                <span className="ui-kicker">{group.provider.name}</span>
                {!hasKey && (
                  <span className="ui-kicker ml-auto" style={{ color: 'var(--vzn-text-disabled)' }}>
                    no key
                  </span>
                )}
                {isLoading && <SpinnerIcon className="w-2.5 h-2.5 spinner ml-auto text-gray-400" />}
              </div>
              {error && group.models.length === 0 ? (
                <div className="px-3 pb-2 text-xs" style={{ color: 'var(--vzn-danger)' }}>
                  {t.model_load_error}
                </div>
              ) : (
                group.models.map((model) => {
                  const isSelected = selectedProvider === provId && selectedModelId === model.id
                  return (
                    <ModelRow
                      key={model.id}
                      provider={provId}
                      modelId={model.id}
                      displayName={formatModelName(provId, model.id, model.name)}
                      isSelected={isSelected}
                      onSelect={handleSelect}
                    />
                  )
                })
              )}
            </div>
          )
        })}
        <div className="h-1.5" />
      </div>
    </div>,
    document.body
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open ? () => { setOpen(false); setSearch('') } : openDropdown}
        className={compact
          ? `inline-flex items-center gap-1 px-2 py-1 rounded-md text-[13px] font-medium flex-shrink-0 transition-colors ${open ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`
          : `btn-select font-medium gap-2 flex-shrink-0 ${open ? 'btn-select-active' : ''}`}
        style={compact
          ? { color: 'var(--vzn-text-muted)', background: open ? 'var(--vzn-surface-subtle)' : 'transparent', minWidth: 0 }
          : { minWidth: 180, maxWidth: 260 }}
      >
        {compact ? null : isCurrentLoading ? (
          <SpinnerIcon className="w-3.5 h-3.5 spinner flex-shrink-0 text-gray-400" />
        ) : (
          <ProviderIcon provider={selectedProvider} size={14} />
        )}
        <span className={compact ? 'truncate max-w-[120px]' : `flex-1 text-left truncate text-[13px] ${PROVIDER_COLORS[selectedProvider].text}`}>
          {isCurrentLoading && !compact ? t.model_loading : selectedModelName || t.settings_hotkey_model}
        </span>
        <ChevronDownIcon
          className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''} ${compact ? 'text-gray-400' : 'text-gray-400'}`}
        />
      </button>
      {dropdownPanel}
    </>
  )
}

interface ModelRowProps {
  provider: Provider
  modelId: string
  displayName: string
  providerName?: string
  isSelected: boolean
  showProvider?: boolean
  onSelect: (provider: Provider, modelId: string) => void
}

function ModelRow({ provider, modelId, displayName, providerName, isSelected, showProvider, onSelect }: ModelRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(provider, modelId)}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
      style={{
        background: isSelected ? 'var(--vzn-accent-soft)' : 'transparent',
        color: isSelected ? 'var(--vzn-accent)' : 'var(--vzn-text)',
        fontSize: 13,
        cursor: 'pointer',
        border: 'none',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--vzn-surface-hover)'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {showProvider && <ProviderIcon provider={provider} size={12} />}
      <span className="flex-1 truncate">
        {displayName}
        {showProvider && providerName && (
          <span className="ml-1.5 text-[11px]" style={{ color: 'var(--vzn-text-soft)' }}>
            {providerName}
          </span>
        )}
      </span>
      {isSelected && <CheckIcon className="w-3 h-3 flex-shrink-0 text-[--vzn-accent]" />}
    </button>
  )
}
