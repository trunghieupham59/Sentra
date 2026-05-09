import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Provider } from '../types'
import { buildProviderModelOptions, resolveProviderSelectedModel } from '../utils/modelSelection'

interface UseProviderModelRefreshOptions {
  enabled?: boolean
  refreshKey?: unknown
}

function getModelErrorMessage(provider: Provider, errorCode?: string, error?: string): string | null {
  if (errorCode === 'NO_API_KEY' && provider !== 'local') return 'Add an API key to fetch latest models.'
  return error ?? null
}

export function useProviderModelRefresh(
  provider: Provider,
  { enabled = true, refreshKey }: UseProviderModelRefreshOptions = {},
) {
  const refreshToken = String(refreshKey ?? '')

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken intentionally refetches models when API-key state changes.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.api?.fetchModels) return

    let cancelled = false
    const {
      setModelsLoading,
      setModelsError,
      setDynamicModels,
      setSelectedModel,
    } = useAppStore.getState()

    setModelsLoading(provider, true)
    setModelsError(provider, null)

    window.api.fetchModels(provider)
      .then((result) => {
        if (cancelled) return

        if (!result?.success) {
          setModelsError(provider, getModelErrorMessage(provider, result?.errorCode, result?.error))
          return
        }

        const fetchedModels = result.models ?? []
        const availableModels = buildProviderModelOptions(provider, fetchedModels)
        setDynamicModels(provider, fetchedModels.length ? availableModels : [])
        if (!fetchedModels.length) return

        const state = useAppStore.getState()
        const nextModel = resolveProviderSelectedModel({
          provider,
          currentModel: state.selectedModels[provider] ?? '',
          availableModels,
          recommendedModel: result.recommendedModel,
          recentlyUsedModels: state.recentlyUsedModels,
        })

        if (nextModel) setSelectedModel(provider, nextModel)
      })
      .catch((error) => {
        if (!cancelled) {
          setModelsError(provider, error instanceof Error ? error.message : String(error))
        }
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(provider, false)
      })

    return () => {
      cancelled = true
    }
  }, [enabled, provider, refreshToken])
}
