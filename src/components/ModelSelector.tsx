import { useEffect } from 'react'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { PROVIDER_COLORS, ProviderIcon } from './ProviderIcon'
import { ChevronDownIcon, RefreshIcon, SpinnerIcon } from './ui/icons'

// Truncate model name if too long
const truncateModelName = (name: string, maxLen = 18): string =>
  name.length > maxLen ? `${name.slice(0, maxLen)}…` : name

/** Tiny section label used above provider and model dropdowns */
function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-[0.65rem] font-medium text-gray-400 whitespace-nowrap uppercase tracking-wide">
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
  const hasKey = keyStatus[selectedProvider]

  const fetchModels = async (provider: Provider, forceRecommended = false) => {
    if (!keyStatus[provider] || !window.api) return
    setModelsLoading(provider, true)
    setModelsError(provider, null)
    try {
      const result = await window.api.fetchModels(provider)
      if (result.success && result.models.length > 0) {
        const wasEmpty = dynamicModels[provider].length === 0
        setDynamicModels(provider, result.models)
        const ids = result.models.map((m) => m.id)
        const currentInList = ids.includes(selectedModels[provider])
        if (forceRecommended || !currentInList || wasEmpty) {
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

  const staticModels = PROVIDERS.find((p) => p.id === selectedProvider)?.models ?? []
  const displayModels = currentDynamic.length > 0 ? currentDynamic : staticModels

  return (
    <div className="flex items-end gap-3 min-w-0 overflow-hidden">

      {/* ── Provider dropdown ── */}
      <div className="flex flex-col items-start gap-1 flex-shrink-0">
        <SectionLabel>{t.settings_hotkey_provider}</SectionLabel>
        <div className="relative">
          {/* Visible styled label */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                            bg-white dark:bg-gray-800 text-[13px] font-semibold pointer-events-none select-none w-36
                            ${PROVIDER_COLORS[selectedProvider].text}`}>
            <ProviderIcon provider={selectedProvider} size={13} />
            <span className="flex-1 truncate">{PROVIDERS.find(p => p.id === selectedProvider)?.name}</span>
            {!keyStatus[selectedProvider] && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
            )}
            <ChevronDownIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
          </div>
          {/* Native select overlaid */}
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as Provider)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[13px]"
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{!keyStatus[p.id as Provider] ? ` (${t.model_no_key})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Separator */}
      <span className="text-gray-200 dark:text-gray-700 text-base font-thin select-none flex-shrink-0 pb-1">|</span>

      {/* ── Model dropdown ── */}
      <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
        <SectionLabel>{t.settings_hotkey_model}</SectionLabel>
        <div className="flex items-center gap-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center gap-1.5 px-2 py-1 text-[0.75rem] text-gray-400 whitespace-nowrap">
              <SpinnerIcon className="w-3.5 h-3.5 spinner flex-shrink-0" />
              {t.model_loading}
            </div>
          ) : error && displayModels.length === 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[0.75rem] text-red-500">{t.model_load_error}</span>
              <button
                type="button"
                onClick={() => fetchModels(selectedProvider)}
                className="text-[0.75rem] text-blue-500 hover:underline"
              >
                {t.model_refresh}
              </button>
            </div>
          ) : (
            <div className="relative inline-block">
              <select
                value={selectedModels[selectedProvider]}
                onChange={(e) => setSelectedModel(selectedProvider, e.target.value)}
                className="select-field pl-2.5 pr-7 w-[140px] lg:w-[190px] xl:w-[230px]"
              >
                {displayModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {truncateModelName(m.name)}{m.description ? ` — ${m.description}` : ''}
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
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
