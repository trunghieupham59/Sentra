import { useEffect } from 'react'
import { PROVIDERS } from '../constants/providers'
import { useAppStore, useT } from '../store/useAppStore'
import type { Provider } from '../types'
import { PROVIDER_COLORS, ProviderIcon } from './ProviderIcon'
import { ChevronDownIcon, RefreshIcon, SpinnerIcon } from './ui/icons'

// Truncate model name if too long
const truncateModelName = (name: string, maxLen = 18): string =>
  name.length > maxLen ? `${name.slice(0, maxLen)}…` : name

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

  // Fetch models when provider changes and key exists
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
          // Auto-select the recommended model (best for translation)
          const target = result.recommendedModel ?? result.models[0].id
          setSelectedModel(provider, target)
        }
      } else {
        setModelsError(provider, result.error || 'Failed to load models')
      }
    } catch (err) {
      setModelsError(provider, err instanceof Error ? err.message : 'Error')
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

  // Build model options: use dynamic if available, else fallback to static
  const staticModels = PROVIDERS.find((p) => p.id === selectedProvider)?.models ?? []
  const displayModels = currentDynamic.length > 0 ? currentDynamic : staticModels

  return (
    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
      {/* Provider tabs */}
      <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex-shrink-0">
        {PROVIDERS.map((p) => {
          const isActive = p.id === selectedProvider
          const c = PROVIDER_COLORS[p.id as Provider]
          const noKey = !keyStatus[p.id as Provider]
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProvider(p.id as Provider)}
              title={noKey ? `${p.name} — ${t.model_no_key}` : p.name}
              className={`relative flex items-center gap-1.5 px-2 py-1 rounded-md text-[0.75rem] font-semibold
                          transition-all duration-100 ${
                isActive
                  ? `bg-white dark:bg-gray-700 shadow-sm ${c.text} border border-gray-200 dark:border-gray-600`
                  : `text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`
              }`}
            >
              <ProviderIcon provider={p.id as Provider} size={13} />
              <span className="hidden lg:inline">{p.name}</span>
              {noKey && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* Separator */}
      <span className="text-gray-200 dark:text-gray-700 text-base font-thin select-none flex-shrink-0">|</span>

      {/* Model dropdown + refresh */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
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
              className="select-field text-[0.75rem] py-1 pl-2.5 pr-7 w-[140px] lg:w-[190px] xl:w-[230px]"
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
  )
}
