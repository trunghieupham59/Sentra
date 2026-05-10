import { useEffect, useMemo, useRef, useState } from 'react'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { dedupeModelsByFamily, formatModelName } from '../utils/modelDisplay'
import { PROVIDER_COLORS, ProviderIcon } from './ProviderIcon'
import { CheckIcon, ChevronDownIcon, RefreshIcon, SearchIcon, SpinnerIcon } from './ui/icons'

// Truncate model name if too long
const truncateModelName = (name: string, maxLen = 22): string =>
  name.length > maxLen ? `${name.slice(0, maxLen)}…` : name

/** Tiny section label used above provider and model dropdowns */
function SectionLabel({ children }: { children: string }) {
  return (
    <span className="ui-kicker whitespace-nowrap">
      {children}
    </span>
  )
}

export function ModelSelector() {
  const {
    selectedProvider, selectedModels, keyStatus,
    dynamicModels, modelsLoading, modelsError,
    setSelectedProvider, setSelectedModel,
    setDynamicModels, setModelsLoading, setModelsError,
  } = useAppStore()
  const t = useT()

  const currentDynamic = dynamicModels[selectedProvider]
  const isLoading = modelsLoading[selectedProvider]
  const error = modelsError[selectedProvider]
  const currentProviderConfig = PROVIDERS.find((p) => p.id === selectedProvider)
  const providerRequiresKey = currentProviderConfig?.requiresApiKey !== false
  const hasKey = !providerRequiresKey || keyStatus[selectedProvider]

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
        // Only override the user's saved model when:
        //   1. caller explicitly asks for the recommended model (forceRecommended), OR
        //   2. the user's selection is no longer valid (not in the freshly fetched list).
        // Previously we also overrode when the local `dynamicModels` cache was
        // empty — but that cache is NOT persisted, so it is empty on every app
        // start / settings re-open / key reload, which silently wiped the user's
        // chosen model back to "recommended" each time.
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedProvider and hasKey are the intended triggers; fetchModels is stable
  useEffect(() => {
    if (hasKey && currentDynamic.length === 0 && !isLoading) {
      fetchModels(selectedProvider)
    }
  }, [selectedProvider, hasKey])

  const staticModels = currentProviderConfig?.models ?? []
  const rawModels = currentDynamic.length > 0 ? currentDynamic : staticModels
  // Collapse date-stamped + `-latest` snapshots into one entry per family so
  // the dropdown shows e.g. one "GPT-5 Mini" instead of five.  Local AI is
  // exempt — see dedupeModelsByFamily.
  const displayModels = useMemo(
    () => dedupeModelsByFamily(selectedProvider, rawModels),
    [selectedProvider, rawModels],
  )
  const selectedModel = selectedModels[selectedProvider] ?? displayModels[0]?.id ?? ''

  return (
    <div className="flex w-full min-w-0 items-end gap-3 overflow-hidden">

      {/* ── Provider dropdown ── */}
      <div className="flex flex-col items-start gap-1 flex-shrink-0">
        <SectionLabel>{t.settings_hotkey_provider}</SectionLabel>
        <div className="relative">
          {/* Visible styled label */}
          <div className={`btn-select w-36 pointer-events-none font-semibold ${PROVIDER_COLORS[selectedProvider].text}`}>
            <ProviderIcon provider={selectedProvider} size={13} />
            <span className="flex-1 truncate">{PROVIDERS.find(p => p.id === selectedProvider)?.name}</span>
            {!hasKey && (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
            )}
            <ChevronDownIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
          </div>
          {/* Native select overlaid */}
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as Provider)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.requiresApiKey !== false && !keyStatus[p.id as Provider] ? ` (${t.model_no_key})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Separator */}
      <span className="text-gray-200 dark:text-gray-700 text-base font-thin select-none flex-shrink-0 pb-1">|</span>

      {/* ── Model dropdown ── */}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <SectionLabel>{t.settings_hotkey_model}</SectionLabel>
        <div className="flex w-full min-w-0 items-center gap-1">
          {isLoading ? (
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 whitespace-nowrap">
              <SpinnerIcon className="w-3.5 h-3.5 spinner flex-shrink-0" />
              {t.model_loading}
            </div>
          ) : error && displayModels.length === 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="ui-error-text text-xs">{t.model_load_error}</span>
              <button
                type="button"
                onClick={() => fetchModels(selectedProvider)}
                className="btn-link text-xs"
              >
                {t.model_refresh}
              </button>
            </div>
          ) : (
            <div className="relative min-w-0 flex-1">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(selectedProvider, e.target.value)}
                className="select-field w-full min-w-[128px] pl-2.5 pr-7"
              >
                {displayModels.map((m) => (
                  // Show only the short pretty name. Descriptors like "Fast"
                  // / "Powerful" come from the provider list and just clutter
                  // the dropdown — they have no UX value here.
                  <option key={m.id} value={m.id}>
                    {truncateModelName(formatModelName(selectedProvider, m.id, m.name))}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2 inset-y-0 flex items-center">
                <ChevronDownIcon className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          )}

          {/* Refresh button */}
          {!isLoading && currentDynamic.length > 0 && hasKey && (
            <button
              type="button"
              onClick={() => fetchModels(selectedProvider)}
              title={t.model_refresh}
              className="btn-icon btn-icon-sm flex-shrink-0 border-transparent bg-transparent text-gray-400 shadow-none dark:bg-transparent"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

    </div>
  )
}

// ── Model Picker Dropdown ─────────────────────────────────────────────────────

interface ModelPickerItemProps {
  provider: Provider
  modelId: string
  modelName: string
  isActive: boolean
  onSelect: (provider: Provider, modelId: string) => void
}

function ModelPickerItem({ provider, modelId, modelName, isActive, onSelect }: ModelPickerItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(provider, modelId)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors duration-100 ${
        isActive ? 'font-semibold' : 'font-normal hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
      style={isActive ? { color: 'var(--vzn-accent)', background: 'var(--vzn-accent-soft)' } : { color: 'var(--vzn-text)' }}
    >
      <ProviderIcon provider={provider} size={13} className="flex-shrink-0" />
      <span className="flex-1 truncate">{modelName}</span>
      {isActive && <CheckIcon className="w-3 h-3 flex-shrink-0" />}
    </button>
  )
}

/**
 * Flat model picker popup — shown when user clicks the model pill in the toolbar.
 * Lists all models from providers that have a saved API key, with a search bar
 * and a "frequently used" section at the top.
 */
export function ModelPickerDropdown({ onClose }: { onClose: () => void }) {
  const {
    selectedProvider, selectedModels, keyStatus, dynamicModels, modelUsage,
    modelsLoading,
    setSelectedProvider, setSelectedModel,
    setDynamicModels, setModelsLoading, setModelsError,
  } = useAppStore()
  const t = useT()
  const [search, setSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Auto-fetch models for all providers that have keys but no cached models yet.
  // This runs once when the picker opens so the list is always up-to-date.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time fetch on mount
  useEffect(() => {
    if (!window.api) return
    for (const p of PROVIDERS) {
      const hasKey = p.requiresApiKey === false || keyStatus[p.id as Provider]
      if (!hasKey) continue
      if ((dynamicModels[p.id as Provider] ?? []).length > 0) continue
      if (modelsLoading[p.id as Provider]) continue
      const provider = p.id as Provider
      setModelsLoading(provider, true)
      setModelsError(provider, null)
      window.api.fetchModels(provider)
        .then((result) => {
          if (result.success && result.models.length > 0) {
            setDynamicModels(provider, result.models)
            const ids = result.models.map((m: { id: string }) => m.id)
            const current = useAppStore.getState().selectedModels[provider]
            if (!current || !ids.includes(current)) {
              setSelectedModel(provider, result.recommendedModel ?? result.models[0].id)
            }
          } else {
            setModelsError(provider, result.error ?? '')
          }
        })
        .catch((err: unknown) => {
          setModelsError(provider, err instanceof Error ? err.message : '')
        })
        .finally(() => {
          setModelsLoading(provider, false)
        })
    }
  }, []) // run once on mount

  // Build flat list of all models from providers that have API keys
  type ModelEntry = { provider: Provider; providerName: string; modelId: string; modelName: string; usageKey: string }
  const allModels = useMemo(() => {
    const entries: ModelEntry[] = []
    for (const p of PROVIDERS) {
      const hasKey = p.requiresApiKey === false || keyStatus[p.id as Provider]
      if (!hasKey) continue
      const raw = (dynamicModels[p.id as Provider] ?? []).length > 0
        ? dynamicModels[p.id as Provider]
        : (p.models ?? [])
      const models = dedupeModelsByFamily(p.id as Provider, raw)
      for (const m of models) {
        entries.push({
          provider: p.id as Provider,
          providerName: p.name,
          modelId: m.id,
          modelName: formatModelName(p.id as Provider, m.id, m.name),
          usageKey: `${p.id}:${m.id}`,
        })
      }
    }
    return entries
  }, [keyStatus, dynamicModels])

  // Frequently used: top 3 models sorted by lastUsed desc
  const frequentModels = useMemo(() =>
    allModels
      .filter(m => (modelUsage[m.usageKey]?.count ?? 0) > 0)
      .sort((a, b) => (modelUsage[b.usageKey]?.lastUsed ?? 0) - (modelUsage[a.usageKey]?.lastUsed ?? 0))
      .slice(0, 3),
    [allModels, modelUsage],
  )

  // Filter by search
  const filtered = useMemo(() => {
    if (!search) return allModels
    const q = search.toLowerCase()
    return allModels.filter(m =>
      m.modelName.toLowerCase().includes(q) ||
      m.providerName.toLowerCase().includes(q),
    )
  }, [allModels, search])

  // Group filtered models by provider
  const byProvider = useMemo(() => {
    const groups: Array<{ provider: Provider; name: string; models: ModelEntry[] }> = []
    for (const entry of filtered) {
      let g = groups.find(x => x.provider === entry.provider)
      if (!g) { g = { provider: entry.provider, name: entry.providerName, models: [] }; groups.push(g) }
      g.models.push(entry)
    }
    return groups
  }, [filtered])

  const handleSelect = (provider: Provider, modelId: string) => {
    setSelectedProvider(provider)
    setSelectedModel(provider, modelId)
    onClose()
  }

  const isActive = (provider: Provider, modelId: string) =>
    selectedProvider === provider && selectedModels[provider] === modelId

  const showFrequent = !search && frequentModels.length > 0

  return (
    <div className="floating-panel ai-config-panel flex flex-col overflow-hidden" style={{ width: '272px', maxHeight: '360px' }}>
      {/* Search */}
      <div className="p-2" style={{ borderBottom: '1px solid var(--vzn-divider)' }}>
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.model_picker_search}
            className="w-full h-8 rounded-lg border pl-8 pr-3 text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--vzn-border)',
              background: 'var(--vzn-surface-raised)',
              color: 'var(--vzn-text)',
            }}
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 py-1">
        {/* Frequently used section */}
        {showFrequent && (
          <>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--vzn-text-soft)' }}>
              {t.model_picker_frequent}
            </div>
            {frequentModels.map(m => (
              <ModelPickerItem
                key={`freq-${m.usageKey}`}
                provider={m.provider}
                modelId={m.modelId}
                modelName={m.modelName}
                isActive={isActive(m.provider, m.modelId)}
                onSelect={handleSelect}
              />
            ))}
            <div className="mx-3 my-1" style={{ height: '1px', background: 'var(--vzn-divider)' }} />
          </>
        )}

        {/* Grouped by provider */}
        {byProvider.map(group => (
          <div key={group.provider}>
            {!search && (
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--vzn-text-soft)' }}>
                {group.name}
              </div>
            )}
            {group.models.map(m => (
              <ModelPickerItem
                key={m.usageKey}
                provider={m.provider}
                modelId={m.modelId}
                modelName={m.modelName}
                isActive={isActive(m.provider, m.modelId)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-3 py-6 text-sm text-center" style={{ color: 'var(--vzn-text-soft)' }}>
            {t.model_picker_no_models}
          </div>
        )}
      </div>
    </div>
  )
}
