// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  benchmarkLocalAiSystem,
  type LocalAiHardwareProfile,
  type LocalAiModel,
  recommendLocalModel,
  scoreLocalModelForHardware,
} from '../localAi'

const lowHardware: LocalAiHardwareProfile = {
  platform: 'darwin',
  arch: 'arm64',
  cpuCount: 4,
  totalMemoryGb: 8,
  tier: 'balanced',
}

const powerfulHardware: LocalAiHardwareProfile = {
  platform: 'darwin',
  arch: 'arm64',
  cpuCount: 10,
  totalMemoryGb: 32,
  tier: 'max',
}

describe('local AI model recommendation', () => {
  it('prefers a small multilingual model on balanced hardware', () => {
    const models: LocalAiModel[] = [
      { id: 'qwen3:4b', name: 'Qwen3 4B', description: '' },
      { id: 'qwen3:30b', name: 'Qwen3 30B', description: '' },
    ]

    expect(recommendLocalModel(models, lowHardware)).toBe('qwen3:4b')
  })

  it('allows larger models on max tier hardware', () => {
    const models: LocalAiModel[] = [
      { id: 'llama3.2:1b', name: 'Llama 3.2 1B', description: '' },
      { id: 'qwen3:14b', name: 'Qwen3 14B', description: '' },
    ]

    expect(recommendLocalModel(models, powerfulHardware)).toBe('qwen3:14b')
  })

  it('penalizes embedding-only models', () => {
    const chatScore = scoreLocalModelForHardware({ id: 'gemma3:4b', name: 'Gemma 3 4B', description: '' }, lowHardware)
    const embedScore = scoreLocalModelForHardware({ id: 'nomic-embed-text', name: 'Embed', description: '' }, lowHardware)

    expect(chatScore).toBeGreaterThan(embedScore)
  })

  it('returns a benchmark with measured scores and downloadable model suggestions', async () => {
    const benchmark = await benchmarkLocalAiSystem()

    expect(benchmark.hardware.totalMemoryGb).toBeGreaterThan(0)
    expect(benchmark.metrics.cpuScore).toBeGreaterThan(0)
    expect(benchmark.metrics.memoryScore).toBeGreaterThan(0)
    expect(benchmark.metrics.durationMs).toBeGreaterThan(0)
    expect(benchmark.suggestedModels.length).toBeGreaterThan(0)
    expect(benchmark.suggestedModels[0].downloadModel).toBeTruthy()
    expect(benchmark.suggestedModels[0].estimatedSizeGb).toBeGreaterThan(0)
    expect(benchmark.recommendedModel).toBe(benchmark.suggestedModels[0].id)
  })

  it('includes multiple model families in the curated suggestions', async () => {
    const benchmark = await benchmarkLocalAiSystem()
    const suggestedIds = benchmark.suggestedModels.map((model) => model.id)

    expect(suggestedIds.some((id) => id.startsWith('llama'))).toBe(true)
    expect(suggestedIds.some((id) => id.startsWith('deepseek'))).toBe(true)
    expect(suggestedIds.some((id) => id.startsWith('qwen'))).toBe(true)
  })
})
