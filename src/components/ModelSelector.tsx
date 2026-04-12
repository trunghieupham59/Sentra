import { useEffect } from 'react'
import { PROVIDERS } from '../constants/providers'
import { Provider } from '../types'
import { useAppStore, useT } from '../store/useAppStore'
import { ProviderIcon, PROVIDER_COLORS } from './ProviderIcon'

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
  const fetchModels = async (provider: Provider) => {
    if (!keyStatus[provider] || !window.api) return
    setModelsLoading(provider, true)
    setModelsError(provider, null)
    try {
      const result = await window.api.fetchModels(provider)
      if (result.success && result.models.length > 0) {
        setDynamicModels(provider, result.models)
        // Auto-select first model if current selection not in list
        const ids = result.models.map((m) => m.id)
        if (!ids.includes(selectedModels[provider])) {
          setSelectedModel(provider, result.models[0].id)
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

  useEffect(() => {
    if (hasKey && currentDynamic.length === 0 && !isLoading) {
      fetchModels(selectedProvider)
    }
  }, [selectedProvider, hasKey])

  // Build model options: use dynamic if available, else fallback to static
  const staticModels = PROVIDERS.find((p) => p.id === selectedProvider)?.models ?? []
  const displayModels = currentDynamic.length > 0 ? currentDynamic : staticModels

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Provider tabs */}
      <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
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
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
                          transition-all duration-100 ${
                isActive
                  ? `bg-white dark:bg-gray-700 shadow-sm ${c.text} border border-gray-200 dark:border-gray-600`
                  : `text-gray-400 hover:text-gray-600 dark:hover:text-gray-300`
              }`}
            >
              <ProviderIcon provider={p.id as Provider} size={14} />
              <span className="hidden sm:inline">{p.name}</span>
              {noKey && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
              )}
            </button>
          )
        })}
      </div>

      {/* Separator */}
      <span className="text-gray-200 dark:text-gray-700 text-lg font-thin select-none">|</span>

      {/* Model dropdown */}
      <div className="flex items-center gap-1.5">
        {isLoading ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5 spinner" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t.model_loading}
          </div>
        ) : error && displayModels.length === 0 ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-red-500">{t.model_load_error}</span>
            <button
              type="button"
              onClick={() => fetchModels(selectedProvider)}
              className="text-xs text-blue-500 hover:underline"
            >
              {t.model_refresh}
            </button>
          </div>
        ) : (
          <div className="relative">
            <select
              value={selectedModels[selectedProvider]}
              onChange={(e) => setSelectedModel(selectedProvider, e.target.value)}
              className="select-field pr-8 pl-3 py-1.5 text-xs min-w-[180px]"
            >
              {displayModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.description ? ` — ${m.description}` : ''}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 inset-y-0 flex items-center">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* Refresh button when models are loaded */}
        {!isLoading && currentDynamic.length > 0 && hasKey && (
          <button
            type="button"
            onClick={() => fetchModels(selectedProvider)}
            title={t.model_refresh}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
