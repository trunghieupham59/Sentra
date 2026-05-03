import { type ChildProcess, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { app, type IpcMain, type WebContents } from 'electron'

export type LocalAiEngine = 'ollama' | 'lmstudio' | 'llamacpp'
export type LocalAiHardwareTier = 'low' | 'balanced' | 'powerful' | 'max'

export interface LocalAiRuntimeCandidate {
  engine: LocalAiEngine
  endpoint: string
  managementEndpoint?: string
}

export interface LocalAiModel {
  id: string
  name: string
  description: string
  engine?: LocalAiEngine
  sizeBytes?: number
  contextLength?: number
  supportsVision?: boolean
  downloadModel?: string
  estimatedSizeGb?: number
  recommendedTier?: LocalAiHardwareTier
  installed?: boolean
}

export interface LocalAiHardwareProfile {
  platform: NodeJS.Platform
  arch: string
  cpuCount: number
  totalMemoryGb: number
  tier: LocalAiHardwareTier
}

export interface LocalAiDiscoveryResult {
  success: boolean
  available: boolean
  engine?: LocalAiEngine
  endpoint?: string
  models: LocalAiModel[]
  suggestedModels: LocalAiModel[]
  recommendedModel?: string
  hardware: LocalAiHardwareProfile
  error?: string
}

export interface LocalAiDownloadResult {
  success: boolean
  model: string
  error?: string
}

export interface LocalAiModelActionResult {
  success: boolean
  model: string
  error?: string
}

export interface LocalAiModelDownloadProgress {
  model: string
  status: 'running' | 'success' | 'error'
  percent: number
  message: string
  completedBytes?: number
  totalBytes?: number
}

export interface LocalAiInstallResult {
  success: boolean
  error?: string
  output?: string
  cancelled?: boolean
}

export interface LocalAiInstallProgress {
  status: 'running' | 'success' | 'error' | 'cancelled'
  percent: number
  message: string
}

export interface LocalAiBenchmarkMetrics {
  cpuScore: number
  memoryScore: number
  combinedScore: number
  durationMs: number
  runtimeModel?: string
  runtimeLatencyMs?: number
  runtimeTokensPerSecond?: number
}

export interface LocalAiBenchmarkResult {
  hardware: LocalAiHardwareProfile
  suggestedModels: LocalAiModel[]
  recommendedModel?: string
  metrics: LocalAiBenchmarkMetrics
}

interface OpenAiChatCompletion {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

interface OllamaPullProgress {
  status?: string
  digest?: string
  total?: number
  completed?: number
  error?: string
}

interface OpenAiModelList {
  data?: Array<{
    id?: string
    name?: string
    owned_by?: string
    meta?: {
      n_ctx_train?: number
      size?: number
      n_params?: number
      capabilities?: unknown
    } | null
  }>
}

export const LOCAL_PROVIDER_ID = 'local'
export const LOCAL_AI_AUTO_MODEL = 'local-auto'
export const LOCAL_AI_PLACEHOLDER_KEY = 'local-ai'

const LOCAL_AI_PROBE_TIMEOUT_MS = 1200
const LOCAL_AI_CACHE_TTL_MS = 5000
const LOCAL_AI_INSTALL_TIMEOUT_MS = 10 * 60 * 1000
const LOCAL_AI_RUNTIME_BENCHMARK_TIMEOUT_MS = 15_000
const LOCAL_AI_RUNTIME_START_TIMEOUT_MS = 18_000
const LOCAL_AI_RUNTIME_START_POLL_MS = 600
const OLLAMA_INSTALL_SCRIPT_URL = 'https://ollama.com/install.sh'
const OLLAMA_INSTALL_SCRIPT_NAME = 'ollama-install.sh'

export const LOCAL_AI_RUNTIME_CANDIDATES: LocalAiRuntimeCandidate[] = [
  { engine: 'ollama', endpoint: 'http://127.0.0.1:11434/v1', managementEndpoint: 'http://127.0.0.1:11434/api' },
  { engine: 'lmstudio', endpoint: 'http://127.0.0.1:1234/v1' },
  { engine: 'llamacpp', endpoint: 'http://127.0.0.1:8080/v1' },
]

let discoveryCache: { expiresAt: number; result: LocalAiDiscoveryResult } | null = null
let activeOllamaInstall: {
  child: ChildProcess
  cancel: () => void
} | null = null
let activeOllamaStart: Promise<LocalAiDiscoveryResult> | null = null
let managedOllamaProcess: ChildProcess | null = null

export function isLocalProvider(provider: string) {
  return provider === LOCAL_PROVIDER_ID
}

export function getLocalAiHardwareProfile(): LocalAiHardwareProfile {
  const totalMemoryGb = Math.round((os.totalmem() / 1024 ** 3) * 10) / 10
  const cpuCount = Math.max(os.cpus().length, 1)
  let tier: LocalAiHardwareTier = 'low'

  if (totalMemoryGb >= 32 && cpuCount >= 8) tier = 'max'
  else if (totalMemoryGb >= 16 && cpuCount >= 6) tier = 'powerful'
  else if (totalMemoryGb >= 8 && cpuCount >= 4) tier = 'balanced'

  return {
    platform: process.platform,
    arch: process.arch,
    cpuCount,
    totalMemoryGb,
    tier,
  }
}

function getModelSizeHintGb(modelId: string, sizeBytes?: number): number {
  if (sizeBytes && sizeBytes > 0) return sizeBytes / 1024 ** 3
  const lower = modelId.toLowerCase()
  const paramMatch = lower.match(/(?:^|[:\-_])(\d+(?:\.\d+)?)b(?:$|[:\-_])/)
  if (paramMatch) {
    const paramsB = Number.parseFloat(paramMatch[1])
    if (Number.isFinite(paramsB)) return Math.max(paramsB * 0.65, 0.5)
  }
  return lower.includes('30b') || lower.includes('32b') ? 20
    : lower.includes('27b') ? 17
      : lower.includes('14b') ? 9
        : lower.includes('12b') ? 8
          : lower.includes('8b') ? 5
            : lower.includes('4b') ? 3
              : lower.includes('3b') ? 2
                : lower.includes('1b') ? 1
                  : 4
}

function maxRecommendedModelSizeGb(tier: LocalAiHardwareTier): number {
  if (tier === 'max') return 22
  if (tier === 'powerful') return 10
  if (tier === 'balanced') return 5.5
  return 2.5
}

function getLocalAiModelCatalog(hardware = getLocalAiHardwareProfile()): LocalAiModel[] {
  const catalog: LocalAiModel[] = [
    {
      id: 'llama3.2:1b',
      name: 'Llama 3.2 1B',
      description: 'Fastest option for low-memory machines',
      downloadModel: 'llama3.2:1b',
      recommendedTier: 'low',
    },
    {
      id: 'llama3.2:3b',
      name: 'Llama 3.2 3B',
      description: 'Small, responsive translation and chat model',
      downloadModel: 'llama3.2:3b',
      recommendedTier: 'balanced',
    },
    {
      id: 'deepseek-r1:1.5b',
      name: 'DeepSeek R1 1.5B',
      description: 'Small reasoning model for low-memory machines',
      downloadModel: 'deepseek-r1:1.5b',
      recommendedTier: 'low',
    },
    {
      id: 'qwen3:4b',
      name: 'Qwen3 4B',
      description: 'Recommended balanced multilingual model',
      downloadModel: 'qwen3:4b',
      recommendedTier: 'balanced',
    },
    {
      id: 'gemma3:4b',
      name: 'Gemma 3 4B',
      description: 'Balanced model with vision-capable local runtimes',
      downloadModel: 'gemma3:4b',
      recommendedTier: 'balanced',
      supportsVision: true,
    },
    {
      id: 'phi4-mini:latest',
      name: 'Phi-4 Mini',
      description: 'Compact general local model for responsive tasks',
      downloadModel: 'phi4-mini:latest',
      recommendedTier: 'balanced',
    },
    {
      id: 'mistral:7b',
      name: 'Mistral 7B',
      description: 'General-purpose instruct model with broad local support',
      downloadModel: 'mistral:7b',
      recommendedTier: 'powerful',
    },
    {
      id: 'deepseek-r1:7b',
      name: 'DeepSeek R1 7B',
      description: 'Reasoning-focused model for stronger local machines',
      downloadModel: 'deepseek-r1:7b',
      recommendedTier: 'powerful',
    },
    {
      id: 'qwen3:8b',
      name: 'Qwen3 8B',
      description: 'Higher quality local model for stronger machines',
      downloadModel: 'qwen3:8b',
      recommendedTier: 'powerful',
    },
    {
      id: 'gemma3:12b',
      name: 'Gemma 3 12B',
      description: 'Powerful local model with vision-capable runtimes',
      downloadModel: 'gemma3:12b',
      recommendedTier: 'powerful',
      supportsVision: true,
    },
    {
      id: 'qwen3:14b',
      name: 'Qwen3 14B',
      description: 'Strong local reasoning and multilingual quality',
      downloadModel: 'qwen3:14b',
      recommendedTier: 'max',
    },
    {
      id: 'deepseek-r1:14b',
      name: 'DeepSeek R1 14B',
      description: 'High-quality local reasoning model for max-tier systems',
      downloadModel: 'deepseek-r1:14b',
      recommendedTier: 'max',
    },
    {
      id: 'gemma3:27b',
      name: 'Gemma 3 27B',
      description: 'High-end local model for max-tier systems',
      downloadModel: 'gemma3:27b',
      recommendedTier: 'max',
      supportsVision: true,
    },
  ]

  return catalog
    .map((model) => ({
      ...model,
      estimatedSizeGb: Math.round(getModelSizeHintGb(model.id, model.sizeBytes) * 10) / 10,
      description: `${model.description} · ${describeLocalModel(model, hardware)}`,
    }))
    .sort((a, b) => scoreLocalModelForHardware(b, hardware) - scoreLocalModelForHardware(a, hardware))
}

export function scoreLocalModelForHardware(model: LocalAiModel, hardware = getLocalAiHardwareProfile()): number {
  const id = model.id.toLowerCase()
  const sizeGb = getModelSizeHintGb(model.id, model.sizeBytes)
  const maxSizeGb = maxRecommendedModelSizeGb(hardware.tier)
  let score = 100

  if (sizeGb > maxSizeGb) score -= (sizeGb - maxSizeGb) * 35
  else score += sizeGb * 8

  if (id.includes('qwen3')) score += 42
  if (id.includes('gemma3')) score += 38
  if (id.includes('deepseek-r1')) score += 34
  if (id.includes('llama3.2')) score += 28
  if (id.includes('llama3.1')) score += 20
  if (id.includes('mistral') || id.includes('phi')) score += 16
  if (id.includes('instruct') || id.includes('it')) score += 10
  if (id.includes('vision') || model.supportsVision) score += 6
  if (id.includes('embed') || id.includes('embedding')) score -= 120
  if (id.includes('rerank')) score -= 120
  if (id.includes('coder') || id.includes('code')) score -= 12
  if (id.includes('base')) score -= 25

  if (hardware.tier === 'low' && sizeGb <= 2.5) score += 22
  if (hardware.tier === 'balanced' && sizeGb >= 2.5 && sizeGb <= 5.5) score += 22
  if (hardware.tier === 'powerful' && sizeGb >= 5 && sizeGb <= 10) score += 20
  if (hardware.tier === 'max' && sizeGb >= 8 && sizeGb <= 22) score += 18

  return score
}

export function recommendLocalModel(models: LocalAiModel[], hardware = getLocalAiHardwareProfile()): string | undefined {
  const chatModels = models.filter((model) => scoreLocalModelForHardware(model, hardware) > 0)
  if (chatModels.length === 0) return models[0]?.id
  return chatModels.reduce((best, model) =>
    scoreLocalModelForHardware(model, hardware) > scoreLocalModelForHardware(best, hardware) ? model : best
  ).id
}

function runCpuBenchmark(targetMs = 180) {
  const startedAt = performance.now()
  const endAt = startedAt + targetMs
  let iterations = 0
  let value = 0x12345678

  while (performance.now() < endAt) {
    for (let i = 0; i < 50_000; i += 1) {
      value = Math.imul(value ^ (value >>> 13), 0x5bd1e995)
      iterations += 1
    }
  }

  const elapsedMs = Math.max(performance.now() - startedAt, 1)
  return Math.round((iterations / elapsedMs) / 100)
}

function runMemoryBenchmark(targetMs = 140) {
  const startedAt = performance.now()
  const endAt = startedAt + targetMs
  const buffer = new Float64Array(256 * 1024)
  let rounds = 0
  let checksum = 0

  while (performance.now() < endAt) {
    for (let i = 0; i < buffer.length; i += 1) {
      buffer[i] = (buffer[i] + i + rounds) % 1024
      checksum += buffer[i]
    }
    rounds += 1
  }

  const elapsedMs = Math.max(performance.now() - startedAt, 1)
  const bytesTouched = rounds * buffer.byteLength
  if (checksum === Number.NEGATIVE_INFINITY) return 0
  return Math.round((bytesTouched / 1024 ** 2 / elapsedMs) * 100)
}

function estimateTokenCount(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return 1
  return Math.max(Math.ceil(trimmed.length / 4), trimmed.split(/\s+/).length)
}

async function runRuntimeBenchmark(discovery: LocalAiDiscoveryResult): Promise<Partial<LocalAiBenchmarkMetrics>> {
  if (!discovery.available || !discovery.endpoint) return {}
  const model = discovery.recommendedModel ?? discovery.models[0]?.id
  if (!model) return {}

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOCAL_AI_RUNTIME_BENCHMARK_TIMEOUT_MS)
  const startedAt = performance.now()
  try {
    const response = await fetch(`${discovery.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${LOCAL_AI_PLACEHOLDER_KEY}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a concise local AI benchmark responder.' },
          { role: 'user', content: 'Reply with exactly eight words about local AI performance.' },
        ],
        max_tokens: 32,
        temperature: 0,
        stream: false,
      }),
    })
    if (!response.ok) return {}
    const payload = await response.json() as OpenAiChatCompletion
    const content = payload.choices?.[0]?.message?.content ?? ''
    const latencyMs = Math.max(performance.now() - startedAt, 1)
    const tokens = estimateTokenCount(content)
    return {
      runtimeModel: model,
      runtimeLatencyMs: Math.round(latencyMs),
      runtimeTokensPerSecond: Math.round((tokens / latencyMs) * 1000 * 10) / 10,
    }
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

export async function benchmarkLocalAiSystem(): Promise<LocalAiBenchmarkResult> {
  const benchmarkStartedAt = performance.now()
  const baseHardware = getLocalAiHardwareProfile()
  const cpuScore = runCpuBenchmark()
  const memoryScore = runMemoryBenchmark()
  const combinedScore = Math.round(cpuScore * 0.65 + memoryScore * 0.35)
  const runtimeMetrics = await runRuntimeBenchmark(await discoverLocalAiRuntimes(true))
  const hardware = {
    ...baseHardware,
    tier: tierFromBenchmark(baseHardware, combinedScore),
  }
  const suggestedModels = getLocalAiModelCatalog(hardware)
  return {
    hardware,
    suggestedModels,
    recommendedModel: suggestedModels[0]?.id,
    metrics: {
      cpuScore,
      memoryScore,
      combinedScore,
      durationMs: Math.round(performance.now() - benchmarkStartedAt),
      ...runtimeMetrics,
    },
  }
}

function tierFromBenchmark(hardware: LocalAiHardwareProfile, combinedScore: number): LocalAiHardwareTier {
  if (hardware.totalMemoryGb >= 32 && hardware.cpuCount >= 8 && combinedScore >= 250) return 'max'
  if (hardware.totalMemoryGb >= 16 && hardware.cpuCount >= 6 && combinedScore >= 160) return 'powerful'
  if (hardware.totalMemoryGb >= 8 && hardware.cpuCount >= 4 && combinedScore >= 80) return 'balanced'
  return 'low'
}

function describeLocalModel(model: LocalAiModel, hardware: LocalAiHardwareProfile): string {
  if (model.id === LOCAL_AI_AUTO_MODEL) return 'Auto-select best local model'
  const sizeGb = getModelSizeHintGb(model.id, model.sizeBytes)
  const fit = sizeGb <= maxRecommendedModelSizeGb(hardware.tier) ? 'Recommended fit' : 'May be slow'
  return model.supportsVision ? `${fit} · Vision` : fit
}

function normalizeModels(payload: OpenAiModelList, engine: LocalAiEngine, hardware: LocalAiHardwareProfile): LocalAiModel[] {
  return (payload.data ?? [])
    .map((item) => {
      const id = String(item.id ?? item.name ?? '').trim()
      if (!id) return null
      const model: LocalAiModel = {
        id,
        name: id,
        description: '',
        engine,
        sizeBytes: item.meta?.size,
        estimatedSizeGb: Math.round(getModelSizeHintGb(id, item.meta?.size) * 10) / 10,
        contextLength: item.meta?.n_ctx_train,
        supportsVision: id.toLowerCase().includes('vision') || id.toLowerCase().includes('gemma3'),
      }
      model.description = describeLocalModel(model, hardware)
      return model
    })
    .filter((model): model is LocalAiModel => model !== null)
}

function markInstalledSuggestions(suggestedModels: LocalAiModel[], installedModels: LocalAiModel[]) {
  const installedIds = new Set(installedModels.map((model) => model.id.toLowerCase()))
  return suggestedModels.map((model) => ({
    ...model,
    installed: installedIds.has(model.id.toLowerCase()),
  }))
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJsonWithTimeout(url: string, timeoutMs = LOCAL_AI_PROBE_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function probeLocalAiRuntime(candidate: LocalAiRuntimeCandidate): Promise<LocalAiDiscoveryResult | null> {
  const hardware = getLocalAiHardwareProfile()
  try {
    const payload = await fetchJsonWithTimeout(`${candidate.endpoint}/models`) as OpenAiModelList
    const models = normalizeModels(payload, candidate.engine, hardware)
    const suggestedModels = markInstalledSuggestions(getLocalAiModelCatalog(hardware), models)
    const recommendedModel = recommendLocalModel(models, hardware)
    return {
      success: true,
      available: true,
      engine: candidate.engine,
      endpoint: candidate.endpoint,
      models,
      suggestedModels,
      recommendedModel,
      hardware,
    }
  } catch {
    return null
  }
}

export async function discoverLocalAiRuntimes(force = false): Promise<LocalAiDiscoveryResult> {
  const now = Date.now()
  if (!force && discoveryCache && discoveryCache.expiresAt > now) {
    return discoveryCache.result
  }

  for (const candidate of LOCAL_AI_RUNTIME_CANDIDATES) {
    const result = await probeLocalAiRuntime(candidate)
    if (result) {
      discoveryCache = { expiresAt: now + LOCAL_AI_CACHE_TTL_MS, result }
      return result
    }
  }

  const result: LocalAiDiscoveryResult = {
    success: false,
    available: false,
    models: [],
    suggestedModels: getLocalAiModelCatalog(getLocalAiHardwareProfile()),
    hardware: getLocalAiHardwareProfile(),
    error: 'No local AI runtime found. Start a supported local runtime and refresh.',
  }
  discoveryCache = { expiresAt: now + LOCAL_AI_CACHE_TTL_MS, result }
  return result
}

function getOllamaRuntimeCandidate() {
  return LOCAL_AI_RUNTIME_CANDIDATES.find((candidate) => candidate.engine === 'ollama') ?? LOCAL_AI_RUNTIME_CANDIDATES[0]
}

function createUnavailableLocalAiResult(error: string): LocalAiDiscoveryResult {
  return {
    success: false,
    available: false,
    models: [],
    suggestedModels: getLocalAiModelCatalog(getLocalAiHardwareProfile()),
    hardware: getLocalAiHardwareProfile(),
    error,
  }
}

function getBundledOllamaExecutablePath() {
  const resourcesPath = process.resourcesPath
  const executable = process.platform === 'win32' ? 'ollama.exe' : 'ollama'
  const platformDir = process.platform === 'darwin'
    ? 'macos'
    : process.platform === 'win32'
      ? 'windows'
      : 'linux'
  const candidates = [
    path.join(resourcesPath, 'local-ai', 'ollama', platformDir, process.arch, executable),
    path.join(resourcesPath, 'local-ai', 'ollama', platformDir, executable),
    path.join(resourcesPath, 'local-ai', 'ollama', executable),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function startDetachedProcess(command: string, args: string[], options: { env?: NodeJS.ProcessEnv; trackManaged?: boolean } = {}) {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const child = spawn(command, args, {
      detached: true,
      env: options.env,
      stdio: 'ignore',
    })
    const settle = (started: boolean) => {
      if (settled) return
      settled = true
      if (started) {
        if (options.trackManaged) managedOllamaProcess = child
        child.unref()
      }
      resolve(started)
    }

    child.once('error', () => settle(false))
    child.once('spawn', () => settle(true))
  })
}

async function waitForOllamaRuntime(timeoutMs = LOCAL_AI_RUNTIME_START_TIMEOUT_MS) {
  const candidate = getOllamaRuntimeCandidate()
  const expiresAt = Date.now() + timeoutMs
  while (Date.now() < expiresAt) {
    const result = await probeLocalAiRuntime(candidate)
    if (result?.available) {
      discoveryCache = { expiresAt: Date.now() + LOCAL_AI_CACHE_TTL_MS, result }
      return result
    }
    await delay(LOCAL_AI_RUNTIME_START_POLL_MS)
  }
  return null
}

async function startBundledOllamaRuntime() {
  const executablePath = getBundledOllamaExecutablePath()
  if (!executablePath) return null

  const started = await startDetachedProcess(executablePath, ['serve'], {
    env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' },
    trackManaged: true,
  })
  if (!started) return null
  return waitForOllamaRuntime()
}

function openMacOllamaApp() {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const child = spawn('/usr/bin/open', ['-g', '-a', 'Ollama', '--args', 'hidden'], {
      stdio: 'ignore',
    })
    const settle = (opened: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(opened)
    }
    const timer = setTimeout(() => settle(true), 1500)

    child.once('error', () => settle(false))
    child.once('close', (code) => settle(code === 0))
  })
}

async function startInstalledOllamaApp() {
  if (process.platform !== 'darwin') return null

  const opened = await openMacOllamaApp()
  if (!opened) return null
  return waitForOllamaRuntime()
}

async function startOllamaCliRuntime() {
  const executable = process.platform === 'win32' ? 'ollama.exe' : 'ollama'
  const started = await startDetachedProcess(executable, ['serve'], {
    env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' },
    trackManaged: true,
  })
  if (!started) return null
  return waitForOllamaRuntime()
}

async function startManagedOllamaRuntime(): Promise<LocalAiDiscoveryResult> {
  const existing = await probeLocalAiRuntime(getOllamaRuntimeCandidate())
  if (existing?.available) return existing

  const bundled = await startBundledOllamaRuntime()
  if (bundled?.available) return bundled

  const appRuntime = await startInstalledOllamaApp()
  if (appRuntime?.available) return appRuntime

  const cliRuntime = await startOllamaCliRuntime()
  if (cliRuntime?.available) return cliRuntime

  return createUnavailableLocalAiResult('No local AI runtime found. Install Ollama or start LM Studio/llama.cpp and refresh.')
}

async function ensureOllamaRuntime(): Promise<LocalAiDiscoveryResult> {
  const existing = await probeLocalAiRuntime(getOllamaRuntimeCandidate())
  if (existing?.available) return existing

  if (!activeOllamaStart) {
    activeOllamaStart = startManagedOllamaRuntime()
      .finally(() => {
        activeOllamaStart = null
      })
  }
  return activeOllamaStart
}

export async function ensureLocalAiRuntime(): Promise<LocalAiDiscoveryResult> {
  const discovered = await discoverLocalAiRuntimes(true)
  if (discovered.available) return discovered

  return ensureOllamaRuntime()
}

export function stopManagedLocalAiRuntime() {
  const child = managedOllamaProcess
  managedOllamaProcess = null
  if (!child?.pid) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      // Managed runtime shutdown is best-effort; a user-owned Ollama app is never killed here.
    }
  }
}

export async function resolveLocalAiRequestModel(model: string): Promise<{ baseURL: string; model: string; engine: LocalAiEngine }> {
  const discovery = await ensureLocalAiRuntime()
  if (!discovery.available || !discovery.endpoint || !discovery.engine) {
    throw new Error(discovery.error ?? 'Local AI runtime is not running')
  }
  const resolvedModel = model === LOCAL_AI_AUTO_MODEL ? discovery.recommendedModel : model
  if (!resolvedModel) {
    throw new Error('No local AI model is available. Download a model in your local runtime and refresh.')
  }
  return { baseURL: discovery.endpoint, model: resolvedModel, engine: discovery.engine }
}

export function getLocalAiStaticModels(): LocalAiModel[] {
  const hardware = getLocalAiHardwareProfile()
  const autoModel: LocalAiModel = {
    id: LOCAL_AI_AUTO_MODEL,
    name: 'Auto local model',
    description: 'Detect and use the best running local model',
  }
  return [
    autoModel,
    { id: 'qwen3:4b', name: 'Qwen3 4B', description: describeLocalModel({ id: 'qwen3:4b', name: '', description: '' }, hardware) },
    { id: 'gemma3:4b', name: 'Gemma 3 4B', description: describeLocalModel({ id: 'gemma3:4b', name: '', description: '', supportsVision: true }, hardware), supportsVision: true },
    { id: 'llama3.2:3b', name: 'Llama 3.2 3B', description: describeLocalModel({ id: 'llama3.2:3b', name: '', description: '' }, hardware) },
  ]
}

function getOllamaManagementEndpoint() {
  return LOCAL_AI_RUNTIME_CANDIDATES.find((candidate) => candidate.engine === 'ollama')?.managementEndpoint
    ?? 'http://127.0.0.1:11434/api'
}

function emitModelDownloadProgress(sender: WebContents | undefined, progress: LocalAiModelDownloadProgress) {
  if (!sender || sender.isDestroyed()) return
  sender.send('local-ai:modelDownloadProgress', progress)
}

function emitPullProgress(sender: WebContents | undefined, model: string, payload: OllamaPullProgress, fallbackPercent: number) {
  const totalBytes = typeof payload.total === 'number' && payload.total > 0 ? payload.total : undefined
  const completedBytes = typeof payload.completed === 'number' && payload.completed >= 0 ? payload.completed : undefined
  const percent = totalBytes && completedBytes
    ? Math.min(99, Math.max(1, Math.round((completedBytes / totalBytes) * 100)))
    : fallbackPercent
  emitModelDownloadProgress(sender, {
    model,
    status: 'running',
    percent,
    message: payload.status ?? 'Downloading model...',
    completedBytes,
    totalBytes,
  })
  return percent
}

async function readResponseText(response: Response) {
  const text = await response.text()
  if (!text.trim()) return ''
  try {
    const payload = JSON.parse(text) as { error?: unknown; message?: unknown }
    const error = typeof payload.error === 'string' ? payload.error : null
    const message = typeof payload.message === 'string' ? payload.message : null
    return error ?? message ?? text
  } catch {
    return text
  }
}

function getOllamaCliExecutable() {
  return getBundledOllamaExecutablePath() ?? (process.platform === 'win32' ? 'ollama.exe' : 'ollama')
}

function removeOllamaModelWithCli(model: string): Promise<LocalAiModelActionResult> {
  return new Promise((resolve) => {
    const child = spawn(getOllamaCliExecutable(), ['rm', model], {
      env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const append = (chunk: Buffer | string) => {
      output = `${output}${chunk.toString()}`.slice(-2000)
    }

    child.stdout?.on('data', append)
    child.stderr?.on('data', append)
    child.once('error', (error) => {
      resolve({ success: false, model, error: `ollama rm failed: ${error.message}` })
    })
    child.once('close', (code) => {
      if (code === 0) {
        resolve({ success: true, model })
        return
      }
      const message = output.trim() || `exit code ${code ?? 'unknown'}`
      resolve({ success: false, model, error: `ollama rm failed: ${message}` })
    })
  })
}

export async function downloadLocalAiModel(modelId: string, sender?: WebContents): Promise<LocalAiDownloadResult> {
  const hardware = getLocalAiHardwareProfile()
  const suggestedModels = getLocalAiModelCatalog(hardware)
  const benchmark = { suggestedModels }
  const target = benchmark.suggestedModels.find((model) => model.id === modelId || model.downloadModel === modelId)
  if (!target?.downloadModel) {
    return { success: false, model: modelId, error: `Unsupported local model: ${modelId}` }
  }

  const ollamaProbe = await ensureOllamaRuntime()
  if (!ollamaProbe?.available) {
    return {
      success: false,
      model: target.downloadModel,
      error: 'Ollama is required for direct model downloads. Install Ollama or start a local runtime and try again.',
    }
  }

  const response = await fetch(`${getOllamaManagementEndpoint()}/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: target.downloadModel, stream: true }),
  })

  if (!response.ok) {
    const body = await response.text()
    return { success: false, model: target.downloadModel, error: `Download failed (${response.status}): ${body}` }
  }

  emitModelDownloadProgress(sender, {
    model: target.downloadModel,
    status: 'running',
    percent: 1,
    message: 'Starting model download...',
  })

  let percent = 1
  let streamError: string | null = null
  const reader = response.body?.getReader()
  if (reader) {
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const payload = JSON.parse(trimmed) as OllamaPullProgress
          if (payload.error) {
            streamError = payload.error
            break
          }
          percent = emitPullProgress(sender, target.downloadModel, payload, percent)
        } catch {
          // Ignore malformed stream lines; Ollama progress is best-effort.
        }
      }
      if (streamError) break
    }
    const tail = buffer.trim()
    if (tail && !streamError) {
      try {
        const payload = JSON.parse(tail) as OllamaPullProgress
        if (payload.error) streamError = payload.error
        else percent = emitPullProgress(sender, target.downloadModel, payload, percent)
      } catch {
        // Ignore malformed trailing line.
      }
    }
  }

  if (streamError) {
    emitModelDownloadProgress(sender, {
      model: target.downloadModel,
      status: 'error',
      percent,
      message: streamError,
    })
    return { success: false, model: target.downloadModel, error: streamError }
  }

  discoveryCache = null
  emitModelDownloadProgress(sender, {
    model: target.downloadModel,
    status: 'success',
    percent: 100,
    message: 'Model downloaded.',
  })
  return { success: true, model: target.downloadModel }
}

export async function uninstallLocalAiModel(modelId: string): Promise<LocalAiModelActionResult> {
  const model = String(modelId).trim()
  if (!model) {
    return { success: false, model: modelId, error: 'Model is required.' }
  }

  const ollamaProbe = await ensureOllamaRuntime()
  if (!ollamaProbe?.available) {
    return {
      success: false,
      model,
      error: 'Ollama is required to uninstall local models. Install Ollama or start a local runtime and try again.',
    }
  }

  const managementEndpoint = getOllamaManagementEndpoint()
  const body = JSON.stringify({ model })

  try {
    await fetch(`${managementEndpoint}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: '', keep_alive: 0, stream: false }),
    })
  } catch {
    // Unloading is best-effort; delete/rm below will return the actionable error.
  }

  const apiErrors: string[] = []
  for (const method of ['DELETE', 'POST']) {
    try {
      const response = await fetch(`${managementEndpoint}/delete`, {
        method,
        headers: { 'content-type': 'application/json' },
        body,
      })
      if (response.ok) {
        discoveryCache = null
        return { success: true, model }
      }
      const responseText = await readResponseText(response)
      apiErrors.push(`${method} /api/delete returned ${response.status}${responseText ? `: ${responseText}` : ''}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      apiErrors.push(`${method} /api/delete failed: ${message}`)
    }
  }

  const cliResult = await removeOllamaModelWithCli(model)
  if (cliResult.success) {
    discoveryCache = null
    return { success: true, model }
  }

  const detail = [...apiErrors, cliResult.error].filter(Boolean).join(' | ')
  return {
    success: false,
    model,
    error: detail ? `Uninstall failed: ${detail}` : 'Uninstall failed.',
  }
}

function emitInstallProgress(sender: WebContents | undefined, progress: LocalAiInstallProgress) {
  if (!sender || sender.isDestroyed()) return
  sender.send('local-ai:installProgress', progress)
}

function appendInstallOutput(current: string, chunk: Buffer | string) {
  return `${current}${chunk.toString()}`.slice(-4000)
}

function getReadableInstallMessage(chunk: Buffer | string) {
  const lines = chunk.toString().trim().split('\n').map((line) => line.trim()).filter(Boolean)
  const line = lines[lines.length - 1]
  if (!line) return null
  if (/^#+\s*\d+(?:\.\d+)?%/.test(line)) return null
  if (line.includes('% Total') || line.includes('Dload') || line.includes('Upload')) return null
  if (/^\d+\s+\d+\s+\d+/.test(line)) return null
  return line
}

function getReadableInstallOutput(output: string) {
  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^#+\s*\d+(?:\.\d+)?%/.test(line))
    .filter((line) => !line.includes('% Total') && !line.includes('Dload') && !line.includes('Upload'))
    .filter((line) => !/^\d+\s+\d+\s+\d+/.test(line))
  return lines.slice(-4).join(' ')
}

function getInstallFailureMessage(code: number | null, output: string) {
  const readableOutput = getReadableInstallOutput(output)
  if (readableOutput) return `Local runtime install failed: ${readableOutput}`
  return `Local runtime install failed with exit code ${code ?? 'unknown'}.`
}

function shouldRetryMacInstallWithAdmin(code: number | null, output: string) {
  if (process.platform !== 'darwin' || code === 0) return false
  return /permission denied|operation not permitted|not permitted|administrator|sudo|\/applications|\/usr\/local\/bin|ln:|mv:|mkdir/i.test(output)
}

function quoteShellArg(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function escapeAppleScriptString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function downloadOllamaInstallScript(): Promise<string> {
  const response = await fetch(OLLAMA_INSTALL_SCRIPT_URL)
  if (!response.ok) {
    throw new Error(`Installer download failed (${response.status})`)
  }

  const script = await response.text()
  if (!script.includes('ollama') || !script.includes('OLLAMA')) {
    throw new Error('Installer provenance check failed.')
  }

  const dir = path.join(app.getPath('userData'), 'installers')
  fs.mkdirSync(dir, { recursive: true })
  const scriptPath = path.join(dir, `${Date.now()}-${OLLAMA_INSTALL_SCRIPT_NAME}`)
  fs.writeFileSync(scriptPath, script, { encoding: 'utf-8', mode: 0o700 })
  return scriptPath
}

function removeInstallScript(scriptPath: string | null) {
  if (!scriptPath) return
  try { fs.unlinkSync(scriptPath) } catch { /* ignore */ }
}

function startOllamaApp() {
  if (process.platform !== 'darwin') return
  try {
    const child = spawn('/usr/bin/open', ['-a', 'Ollama', '--args', 'hidden'], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()
  } catch {
    // Starting the app is best-effort; discovery can still happen after user opens it.
  }
}

function stopOllamaInstallProcess() {
  const active = activeOllamaInstall
  if (!active) return false
  active.cancel()
  return true
}

export async function installOllamaRuntime(sender?: WebContents): Promise<LocalAiInstallResult> {
  if (process.platform === 'win32') {
    return {
      success: false,
      error: 'Direct local runtime install is currently supported on macOS and Linux. Use a runtime installer manually on Windows.',
    }
  }
  if (activeOllamaInstall) {
    return {
      success: false,
      error: 'Local runtime install is already running.',
    }
  }

  emitInstallProgress(sender, {
    status: 'running',
    percent: 4,
    message: 'Downloading local runtime installer from ollama.com...',
  })

  let scriptPath: string
  try {
    scriptPath = await downloadOllamaInstallScript()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    emitInstallProgress(sender, {
      status: 'error',
      percent: 4,
      message,
    })
    return {
      success: false,
      error: `Local runtime install failed: ${message}`,
    }
  }

  return new Promise((resolve) => {
    const child = spawn('/bin/sh', [scriptPath], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    let percent = 8
    let cancelled = false
    let timedOut = false
    let resolved = false

    const finish = (result: LocalAiInstallResult, progress: LocalAiInstallProgress) => {
      if (resolved) return
      resolved = true
      clearInterval(progressTimer)
      clearTimeout(timeoutTimer)
      removeInstallScript(scriptPath)
      activeOllamaInstall = null
      emitInstallProgress(sender, progress)
      resolve(result)
    }

    const cancel = () => {
      cancelled = true
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch {
          child.kill('SIGTERM')
        }
      }
    }

    const terminateChild = (target: ChildProcess) => {
      if (target.pid) {
        try {
          process.kill(-target.pid, 'SIGTERM')
        } catch {
          target.kill('SIGTERM')
        }
      }
    }

    const runMacAdminFallback = () => {
      const adminCommand = `OLLAMA_NO_START=1 /bin/sh ${quoteShellArg(scriptPath)}`
      const appleScript = `do shell script "${escapeAppleScriptString(adminCommand)}" with administrator privileges`
      const adminChild = spawn('/usr/bin/osascript', ['-e', appleScript], {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      activeOllamaInstall = {
        child: adminChild,
        cancel: () => {
          cancelled = true
          terminateChild(adminChild)
        },
      }
      percent = Math.max(percent, 72)
      emitInstallProgress(sender, {
        status: 'running',
        percent,
        message: 'Requesting administrator permission to finish runtime setup...',
      })

      adminChild.stdout?.on('data', (chunk: Buffer) => {
        output = appendInstallOutput(output, chunk)
        const message = getReadableInstallMessage(chunk)
        if (!message) return
        emitInstallProgress(sender, { status: 'running', percent, message })
      })

      adminChild.stderr?.on('data', (chunk: Buffer) => {
        output = appendInstallOutput(output, chunk)
        const message = getReadableInstallMessage(chunk)
        if (!message) return
        emitInstallProgress(sender, { status: 'running', percent, message })
      })

      adminChild.on('error', (error) => {
        finish(
          { success: false, error: `Local runtime install failed: ${error.message}`, output },
          { status: 'error', percent, message: error.message }
        )
      })

      adminChild.on('close', (adminCode) => {
        if (cancelled) {
          finish(
            { success: false, cancelled: true, error: 'Local runtime install was cancelled.', output },
            { status: 'cancelled', percent, message: 'Local runtime install cancelled.' }
          )
          return
        }
        if (timedOut) {
          finish(
            { success: false, error: 'Local runtime install timed out.', output },
            { status: 'error', percent, message: 'Local runtime install timed out.' }
          )
          return
        }
        if (adminCode !== 0) {
          const message = getInstallFailureMessage(adminCode, output)
          finish(
            { success: false, error: message, output },
            { status: 'error', percent, message }
          )
          return
        }
        discoveryCache = null
        startOllamaApp()
        finish(
          { success: true, output },
          { status: 'success', percent: 100, message: 'Local runtime installed.' }
        )
      })
    }

    activeOllamaInstall = { child, cancel }
    percent = Math.max(percent, 12)
    emitInstallProgress(sender, {
      status: 'running',
      percent,
      message: 'Starting verified local runtime installer...',
    })

    const progressTimer = setInterval(() => {
      percent = Math.min(percent + 5, 92)
      emitInstallProgress(sender, {
        status: 'running',
        percent,
        message: percent < 45
          ? 'Downloading runtime installer...'
          : percent < 80
            ? 'Installing local runtime...'
            : 'Finalizing local runtime setup...',
      })
    }, 1200)

    const timeoutTimer = setTimeout(() => {
      timedOut = true
      cancel()
    }, LOCAL_AI_INSTALL_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => {
      output = appendInstallOutput(output, chunk)
      const message = getReadableInstallMessage(chunk)
      if (!message) return
      emitInstallProgress(sender, {
        status: 'running',
        percent,
        message,
      })
    })

    child.stderr.on('data', (chunk: Buffer) => {
      output = appendInstallOutput(output, chunk)
      const message = getReadableInstallMessage(chunk)
      if (!message) return
      emitInstallProgress(sender, {
        status: 'running',
        percent,
        message,
      })
    })

    child.on('error', (error) => {
      finish(
        { success: false, error: `Local runtime install failed: ${error.message}`, output },
        { status: 'error', percent, message: error.message }
      )
    })

    child.on('close', (code) => {
      if (cancelled) {
        finish(
          { success: false, cancelled: true, error: 'Local runtime install was cancelled.', output },
          { status: 'cancelled', percent, message: 'Local runtime install cancelled.' }
        )
        return
      }
      if (timedOut) {
        finish(
          { success: false, error: 'Local runtime install timed out.', output },
          { status: 'error', percent, message: 'Local runtime install timed out.' }
        )
        return
      }
      if (code !== 0) {
        if (shouldRetryMacInstallWithAdmin(code, output)) {
          runMacAdminFallback()
          return
        }
        const message = getInstallFailureMessage(code, output)
        finish(
          { success: false, error: message, output },
          { status: 'error', percent, message }
        )
        return
      }
      discoveryCache = null
      finish(
        { success: true, output },
        { status: 'success', percent: 100, message: 'Local runtime installed.' }
      )
    })
  })
}

export function registerLocalAiHandlers(ipcMain: IpcMain) {
  ipcMain.handle('local-ai:discover', async (_event, force?: boolean) => discoverLocalAiRuntimes(Boolean(force)))
  ipcMain.handle('local-ai:ensureRuntime', async () => ensureLocalAiRuntime())
  ipcMain.handle('local-ai:benchmark', async () => benchmarkLocalAiSystem())
  ipcMain.handle('local-ai:downloadModel', async (event, modelId: string) => downloadLocalAiModel(modelId, event.sender))
  ipcMain.handle('local-ai:uninstallModel', async (_event, modelId: string) => uninstallLocalAiModel(modelId))
  ipcMain.handle('local-ai:installOllama', async (event) => installOllamaRuntime(event.sender))
  ipcMain.handle('local-ai:cancelInstallOllama', async () => ({ success: stopOllamaInstallProcess() }))
}
