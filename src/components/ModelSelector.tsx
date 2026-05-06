import { useEffect, useMemo } from 'react'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { dedupeModelsByFamily, formatModelName } from '../utils/modelDisplay'
import { PROVIDER_COLORS, ProviderIcon } from './ProviderIcon'
import { ChevronDownIcon, RefreshIcon, SpinnerIcon } from './ui/icons'

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
