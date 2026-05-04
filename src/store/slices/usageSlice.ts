/**
 * usageSlice — persisted estimated API cost totals by provider/API key.
 *
 * The renderer stores only safe aggregate metadata: provider, model, estimated
 * token counts and USD-denominated cost. Raw API keys never enter this slice.
 *
 * Per-feature breakdown (chat / translate / live / dictionary) is also tracked
 * so the cost dashboard can show how each surface contributes to the total.
 */
import type {
  Provider,
  UsageCost,
  UsageCurrency,
  UsageFeatureTotal,
  UsageTotal,
} from '../../types'
import { DEFAULT_USAGE_CURRENCY } from '../../utils/usageCost'
import type { SliceSet } from './sliceTypes'

export interface UsageSlice {
  costCurrency: UsageCurrency
  apiKeyUsageTotals: Partial<Record<Provider, UsageTotal>>
  setCostCurrency: (currency: UsageCurrency) => void
  recordUsageCost: (cost: UsageCost) => void
  resetProviderUsageCost: (provider: Provider) => void
  resetAllUsageCost: () => void
}

export const createUsageSlice = (set: SliceSet): UsageSlice => ({
  costCurrency: DEFAULT_USAGE_CURRENCY,
  apiKeyUsageTotals: {},

  setCostCurrency: (currency) => set({ costCurrency: currency }),

  recordUsageCost: (cost) =>
    set((state: UsageSlice) => {
      const current = state.apiKeyUsageTotals[cost.provider]
      const currentFeature: UsageFeatureTotal | undefined = current?.byFeature?.[cost.feature]
      const nextFeature: UsageFeatureTotal = {
        amountUsd: (currentFeature?.amountUsd ?? 0) + cost.amountUsd,
        requestCount: (currentFeature?.requestCount ?? 0) + 1,
        totalTokens: (currentFeature?.totalTokens ?? 0) + cost.totalTokens,
      }
      const next: UsageTotal = {
        amountUsd: (current?.amountUsd ?? 0) + cost.amountUsd,
        inputTokens: (current?.inputTokens ?? 0) + cost.inputTokens,
        outputTokens: (current?.outputTokens ?? 0) + cost.outputTokens,
        totalTokens: (current?.totalTokens ?? 0) + cost.totalTokens,
        requestCount: (current?.requestCount ?? 0) + 1,
        updatedAt: cost.createdAt,
        byFeature: {
          ...(current?.byFeature ?? {}),
          [cost.feature]: nextFeature,
        },
      }
      return {
        apiKeyUsageTotals: {
          ...state.apiKeyUsageTotals,
          [cost.provider]: next,
        },
      }
    }),

  resetProviderUsageCost: (provider) =>
    set((state: UsageSlice) => {
      const nextTotals = { ...state.apiKeyUsageTotals }
      delete nextTotals[provider]
      return { apiKeyUsageTotals: nextTotals }
    }),

  resetAllUsageCost: () => set({ apiKeyUsageTotals: {} }),
})
