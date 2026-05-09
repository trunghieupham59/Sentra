import { describe, expect, it } from 'vitest'
import type { FetchedModel } from '../../types'
import { buildProviderModelOptions, resolveProviderSelectedModel } from '../modelSelection'

const m = (id: string): FetchedModel => ({ id, name: id, description: '' })

describe('buildProviderModelOptions', () => {
  it('dedupes cloud provider snapshots to the newest family member', () => {
    const models = buildProviderModelOptions('openai', [
      m('gpt-5-mini-2026-04-15'),
      m('gpt-5-mini-latest'),
      m('gpt-5-mini-2026-05-01'),
      m('gpt-5.2'),
    ])

    expect(models.map((model) => model.id)).toEqual([
      'gpt-5-mini-2026-05-01',
      'gpt-5.2',
    ])
  })

  it('keeps local-auto available when local runtime models are fetched', () => {
    const models = buildProviderModelOptions('local', [
      m('qwen3:8b'),
      m('gemma3:12b'),
    ])

    expect(models.map((model) => model.id)).toEqual([
      'local-auto',
      'qwen3:8b',
      'gemma3:12b',
    ])
  })
})

describe('resolveProviderSelectedModel', () => {
  it('moves default selections to the provider-recommended model', () => {
    const next = resolveProviderSelectedModel({
      provider: 'openai',
      currentModel: 'gpt-4o',
      availableModels: [m('gpt-5-mini'), m('gpt-4o')],
      recommendedModel: 'gpt-5-mini',
      recentlyUsedModels: [],
    })

    expect(next).toBe('gpt-5-mini')
  })

  it('keeps manual selections when the provider still exposes them', () => {
    const next = resolveProviderSelectedModel({
      provider: 'openai',
      currentModel: 'gpt-4o',
      availableModels: [m('gpt-5-mini'), m('gpt-4o')],
      recommendedModel: 'gpt-5-mini',
      recentlyUsedModels: ['openai:gpt-4o'],
    })

    expect(next).toBeNull()
  })

  it('upgrades manual selections to a newer snapshot in the same family', () => {
    const next = resolveProviderSelectedModel({
      provider: 'openai',
      currentModel: 'gpt-5-mini-2026-04-15',
      availableModels: [m('gpt-5-mini-2026-05-01')],
      recommendedModel: 'gpt-5-mini-2026-05-01',
      recentlyUsedModels: ['openai:gpt-5-mini-2026-04-15'],
    })

    expect(next).toBe('gpt-5-mini-2026-05-01')
  })

  it('falls back to recommended when a selected model disappears', () => {
    const next = resolveProviderSelectedModel({
      provider: 'claude',
      currentModel: 'claude-3-5-sonnet-20241022',
      availableModels: [m('claude-sonnet-4-20250514')],
      recommendedModel: 'claude-sonnet-4-20250514',
      recentlyUsedModels: ['claude:claude-3-5-sonnet-20241022'],
    })

    expect(next).toBe('claude-sonnet-4-20250514')
  })

  it('keeps local-auto because it is resolved lazily by the main process', () => {
    const next = resolveProviderSelectedModel({
      provider: 'local',
      currentModel: 'local-auto',
      availableModels: [m('local-auto'), m('qwen3:8b')],
      recommendedModel: 'qwen3:8b',
    })

    expect(next).toBeNull()
  })
})
