import { PROVIDERS } from '../constants/providers'
import type { FetchedModel, Provider } from '../types'
import { dedupeModelsByFamily, getModelFamilyKey } from './modelDisplay'

export function getFallbackModels(provider: Provider): FetchedModel[] {
  const providerConfig = PROVIDERS.find((p) => p.id === provider)
  return (providerConfig?.models ?? []).map((model) => ({
    id: model.id,
    name: model.name,
    description: model.description,
  }))
}

function dedupeById(models: FetchedModel[]): FetchedModel[] {
  const seen = new Set<string>()
  const result: FetchedModel[] = []
  for (const model of models) {
    if (!model.id || seen.has(model.id)) continue
    seen.add(model.id)
    result.push(model)
  }
  return result
}

export function buildProviderModelOptions(
  provider: Provider,
  dynamicModels: FetchedModel[],
): FetchedModel[] {
  const fallbackModels = getFallbackModels(provider)
  if (!dynamicModels.length) return fallbackModels

  if (provider === 'local') {
    const localAuto = fallbackModels.find((model) => model.id === 'local-auto')
    return dedupeById(localAuto ? [localAuto, ...dynamicModels] : dynamicModels)
  }

  return dedupeModelsByFamily(provider, dynamicModels)
}

export interface ResolveProviderSelectedModelInput {
  provider: Provider
  currentModel: string
  availableModels: FetchedModel[]
  recommendedModel?: string
  recentlyUsedModels?: string[]
}

/**
 * Decide whether the stored selected model should move to a provider-fetched model.
 *
 * Rules:
 * - Local AI keeps `local-auto`; that synthetic id already resolves lazily.
 * - Manual user selections are respected while still upgrading dated snapshots
 *   within the same model family.
 * - Auto/default selections move to the provider-recommended model whenever the
 *   provider model list is available, so stale bundled defaults do not linger.
 * - If the provider no longer exposes the selected model, use the recommended
 *   model, then the first available provider model.
 */
export function resolveProviderSelectedModel({
  provider,
  currentModel,
  availableModels,
  recommendedModel,
  recentlyUsedModels = [],
}: ResolveProviderSelectedModelInput): string | null {
  if (!availableModels.length) return null

  if (provider === 'local') {
    if (currentModel === 'local-auto') return null
    if (currentModel && availableModels.some((model) => model.id === currentModel)) return null
    return recommendedModel ?? availableModels[0]?.id ?? null
  }

  const selectedEntry = `${provider}:${currentModel}`
  const wasUserSelected = recentlyUsedModels.includes(selectedEntry)
  const recommended = recommendedModel
    ? availableModels.find((model) => model.id === recommendedModel) ??
      availableModels.find((model) =>
        getModelFamilyKey(provider, model.id) === getModelFamilyKey(provider, recommendedModel)
      )
    : undefined

  if (!currentModel) return recommended?.id ?? availableModels[0]?.id ?? null

  const currentFamily = getModelFamilyKey(provider, currentModel)
  const latestSameFamily = availableModels.find(
    (model) => getModelFamilyKey(provider, model.id) === currentFamily,
  )
  if (latestSameFamily && latestSameFamily.id !== currentModel) {
    return latestSameFamily.id
  }

  const currentStillAvailable = availableModels.some((model) => model.id === currentModel)
  if (currentStillAvailable) {
    if (!wasUserSelected && recommended?.id && recommended.id !== currentModel) {
      return recommended.id
    }
    return null
  }

  return recommended?.id ?? availableModels[0]?.id ?? null
}
