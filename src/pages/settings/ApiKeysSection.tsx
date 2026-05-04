import { useEffect, useState } from 'react'
import { ApiKeyInput } from '../../components/ApiKeyInput'
import { DeepResearchApiSection } from '../../components/chat/DeepResearchApiSection'
import { CostOverviewCard } from '../../components/cost/CostOverviewCard'
import { ProviderIcon } from '../../components/ProviderIcon'
import { DownloadIcon, RefreshIcon, SpinnerIcon, TrashIcon } from '../../components/ui/icons'
import { PROVIDERS } from '../../constants/providers'
import { JINA_DOCS_URL } from '../../constants/urls'
import { useAppStore, useT } from '../../store/useAppStore'
import type {
  LocalAiBenchmarkResult,
  LocalAiDiscoveryResult,
  LocalAiInstallProgress,
  LocalAiModelDownloadProgress,
  Provider,
} from '../../types'

function LocalAiProviderCard({
  status,
  benchmark,
  loading,
  benchmarking,
  downloadingModel,
  downloadProgress,
  uninstallingModel,
  installingOllama,
  onRefresh,
  onBenchmark,
  onDownloadModel,
  onUninstallModel,
  onInstallOllama,
  downloadError,
  downloadSuccess,
  installError,
  installSuccess,
  installProgress,
  showRestartPrompt,
  onCancelInstall,
  onRestartApp,
  onDismissRestartPrompt,
}: {
  status: LocalAiDiscoveryResult | null
  benchmark: LocalAiBenchmarkResult | null
  loading: boolean
  benchmarking: boolean
  downloadingModel: string | null
  downloadProgress: LocalAiModelDownloadProgress | null
  uninstallingModel: string | null
  installingOllama: boolean
  onRefresh: () => void
  onBenchmark: () => void
  onDownloadModel: (modelId: string) => void
  onUninstallModel: (modelId: string) => void
  onInstallOllama: () => void
  downloadError: string | null
  downloadSuccess: string | null
  installError: string | null
  installSuccess: string | null
  installProgress: LocalAiInstallProgress | null
  showRestartPrompt: boolean
  onCancelInstall: () => void
  onRestartApp: () => void
  onDismissRestartPrompt: () => void
}) {
  const t = useT()
  const available = status?.available ?? false
  const models = status?.models ?? []
  const suggestions = status?.suggestedModels?.length ? status.suggestedModels : benchmark?.suggestedModels ?? []
  const hardware = status?.hardware ?? benchmark?.hardware
  const metrics = benchmark?.metrics
  const canDownloadModels = status?.engine === 'ollama'
  const showRuntimeInstallPanel = !canDownloadModels
  const activeInstallPercent = Math.max(5, Math.min(100, installProgress?.percent ?? 8))
  const recommended = models.find((model) => model.id === status?.recommendedModel)
    ?? suggestions.find((model) => model.id === (status?.recommendedModel ?? benchmark?.recommendedModel))
  const formatModelDownloadBytes = (progress: LocalAiModelDownloadProgress) => {
    if (!progress.completedBytes || !progress.totalBytes) return null
    const completedGb = Math.round((progress.completedBytes / 1024 ** 3) * 10) / 10
    const totalGb = Math.round((progress.totalBytes / 1024 ** 3) * 10) / 10
    return `${completedGb}/${totalGb} GB`
  }

  return (
    <div className="card p-4 space-y-3 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-gray-700 flex-shrink-0">
            <ProviderIcon provider="local" size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t.settings_local_ai_title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {available
                ? `${status?.engine ?? 'local'} · ${status?.endpoint ?? ''}`
                : t.settings_local_ai_unavailable}
            </p>
          </div>
        </div>
        <span className={[
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
          available
            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
        ].join(' ')}>
          <span className={[
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            available ? 'bg-green-500' : 'bg-gray-400',
          ].join(' ')} />
          {available ? t.settings_local_ai_running : t.settings_local_ai_not_running}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800/70">
        <div className="min-w-0">
          <p className="font-medium text-gray-700 dark:text-gray-200">
            {recommended ? recommended.name : t.settings_local_ai_model_waiting}
          </p>
          <p className="text-gray-500 dark:text-gray-400">
            {available
              ? `${models.length} ${t.settings_local_ai_models_found} · ${hardware?.tier ?? 'balanced'}`
              : t.settings_local_ai_start_runtime}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onBenchmark}
            disabled={benchmarking}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 transition-colors hover:text-gray-900 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
          >
            {benchmarking ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : null}
            {benchmarking ? t.settings_local_ai_benchmarking : t.settings_local_ai_benchmark}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 transition-colors hover:text-gray-900 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700"
          >
            {loading ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <RefreshIcon className="w-3.5 h-3.5" />}
            {t.model_refresh}
          </button>
        </div>
      </div>

      {hardware && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
            <p className="text-gray-400">{t.settings_local_ai_tier}</p>
            <p className="font-medium text-gray-700 dark:text-gray-200">{hardware.tier}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
            <p className="text-gray-400">RAM</p>
            <p className="font-medium text-gray-700 dark:text-gray-200">{hardware.totalMemoryGb} GB</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
            <p className="text-gray-400">CPU</p>
            <p className="font-medium text-gray-700 dark:text-gray-200">{hardware.cpuCount} cores</p>
          </div>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
            <p className="text-gray-400">{t.settings_local_ai_cpu_score}</p>
            <p className="font-medium text-gray-700 dark:text-gray-200">{metrics.cpuScore}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
            <p className="text-gray-400">{t.settings_local_ai_memory_score}</p>
            <p className="font-medium text-gray-700 dark:text-gray-200">{metrics.memoryScore}</p>
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
            <p className="text-gray-400">
              {metrics.runtimeTokensPerSecond ? t.settings_local_ai_runtime_speed : t.settings_local_ai_benchmark_duration}
            </p>
            <p className="font-medium text-gray-700 dark:text-gray-200">
              {metrics.runtimeTokensPerSecond
                ? `${metrics.runtimeTokensPerSecond} tok/s`
                : `${Math.round(metrics.durationMs / 100) / 10}s`}
            </p>
          </div>
          {metrics.runtimeLatencyMs && (
            <div className="col-span-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/70">
              <p className="text-gray-400">{t.settings_local_ai_runtime_latency}</p>
              <p className="font-medium text-gray-700 dark:text-gray-200">
                {metrics.runtimeModel} · {metrics.runtimeLatencyMs}ms
              </p>
            </div>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t.settings_local_ai_suggested_models}
            </h4>
            {canDownloadModels ? (
              <span className="text-[11px] text-gray-400">{t.settings_local_ai_download_hint}</span>
            ) : (
              <button
                type="button"
                onClick={onInstallOllama}
                disabled={installingOllama}
                className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700"
              >
                {installingOllama && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
                {installingOllama ? t.settings_local_ai_installing_ollama : t.settings_local_ai_install_ollama}
              </button>
            )}
          </div>

          {showRuntimeInstallPanel && (
            <div className={[
              'rounded-xl border px-3 py-3 text-xs',
              installingOllama
                ? 'border-blue-100 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/20'
                : 'border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/70',
            ].join(' ')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {installingOllama && <SpinnerIcon className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-300" />}
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                      {installingOllama ? t.settings_local_ai_installing_ollama : t.settings_local_ai_install_runtime_title}
                    </p>
                    {installingOllama && (
                      <span className="rounded-full bg-white px-2 py-0.5 font-medium text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900">
                        {activeInstallPercent}%
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    {installingOllama
                      ? installProgress?.message ?? t.settings_local_ai_installing_ollama
                      : t.settings_local_ai_install_runtime_desc}
                  </p>
                </div>
                {installingOllama && (
                  <button
                    type="button"
                    onClick={onCancelInstall}
                    className="flex-shrink-0 rounded-lg bg-white px-3 py-1.5 font-medium text-blue-700 shadow-sm ring-1 ring-blue-100 transition-colors hover:bg-blue-50 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-900 dark:hover:bg-blue-900/60"
                  >
                    {t.settings_local_ai_cancel_install}
                  </button>
                )}
              </div>
              {installingOllama && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-blue-100 dark:bg-blue-950 dark:ring-blue-900">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                    style={{ width: `${activeInstallPercent}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {suggestions.slice(0, 5).map((model) => {
              const isDownloading = downloadingModel === model.id
              const isUninstalling = uninstallingModel === model.id
              const activeDownloadProgress = isDownloading && downloadProgress?.model === model.id ? downloadProgress : null
              const activeDownloadPercent = Math.max(1, Math.min(100, activeDownloadProgress?.percent ?? 1))
              const activeDownloadBytes = activeDownloadProgress ? formatModelDownloadBytes(activeDownloadProgress) : null
              const buttonLabel = model.installed
                ? t.settings_local_ai_uninstall
                : canDownloadModels
                  ? t.settings_local_ai_download
                  : t.settings_local_ai_waiting_runtime
              return (
                <div
                  key={model.id}
                  className="rounded-lg border border-gray-100 px-3 py-2 text-xs dark:border-gray-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-800 dark:text-gray-100">{model.name}</p>
                        {model.id === recommended?.id && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                            {t.settings_local_ai_recommended}
                          </span>
                        )}
                        {model.installed && (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:bg-green-950/50 dark:text-green-300">
                            {t.settings_local_ai_installed}
                          </span>
                        )}
                        {model.estimatedSizeGb && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            {t.settings_local_ai_model_size} ~{model.estimatedSizeGb} GB
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">{model.description}</p>
                    </div>
                    {canDownloadModels ? (
                      <button
                        type="button"
                        onClick={() => model.installed ? onUninstallModel(model.id) : onDownloadModel(model.id)}
                        disabled={isDownloading || isUninstalling || Boolean(downloadingModel) || Boolean(uninstallingModel)}
                        className={[
                          'flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-700',
                          model.installed
                            ? 'bg-red-50 text-red-600 ring-1 ring-red-100 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/60 dark:hover:bg-red-950/50'
                            : 'bg-blue-600 text-white hover:bg-blue-700',
                        ].join(' ')}
                      >
                        {(isDownloading || isUninstalling) && <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />}
                        {!model.installed && !isDownloading && <DownloadIcon className="w-3.5 h-3.5" />}
                        {model.installed && !isUninstalling && <TrashIcon className="w-3.5 h-3.5" />}
                        {isDownloading
                          ? `${activeDownloadPercent}%`
                          : isUninstalling
                            ? t.settings_local_ai_uninstalling
                            : buttonLabel}
                      </button>
                    ) : (
                      <span className="hidden flex-shrink-0 rounded-lg bg-gray-50 px-3 py-1.5 font-medium text-gray-400 ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-700 sm:block">
                        {buttonLabel}
                      </span>
                    )}
                  </div>
                  {activeDownloadProgress && (
                    <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-950/20">
                      <div className="flex items-center justify-between gap-3 text-[11px]">
                        <span className="min-w-0 truncate font-medium text-blue-700 dark:text-blue-300">
                          {t.settings_local_ai_downloading_model}: {activeDownloadProgress.message}
                        </span>
                        <span className="flex-shrink-0 font-semibold text-blue-700 dark:text-blue-300">
                          {activeDownloadBytes ? `${activeDownloadBytes} · ` : ''}{activeDownloadPercent}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-blue-100 dark:bg-blue-950 dark:ring-blue-900">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                          style={{ width: `${activeDownloadPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(downloadError || downloadSuccess || installError || installSuccess) && (
        <p className={[
          'rounded-lg px-3 py-2 text-xs font-medium',
          downloadError || installError
            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
            : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
        ].join(' ')}>
          {downloadError ?? installError ?? downloadSuccess ?? installSuccess}
        </p>
      )}

      {showRestartPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="local-ai-restart-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
            <h3 id="local-ai-restart-title" className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {t.settings_local_ai_restart_title}
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {t.settings_local_ai_restart_desc}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onDismissRestartPrompt}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t.settings_local_ai_restart_later}
              </button>
              <button
                type="button"
                onClick={onRestartApp}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {t.settings_local_ai_restart_now}
              </button>
            </div>
          </div>
        </div>
      )}

      {!available && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t.settings_local_ai_start_runtime}
        </p>
      )}
    </div>
  )
}

export function ApiKeysSection() {
  const setKeyStatus = useAppStore((state) => state.setKeyStatus)
  const keyStatus = useAppStore((state) => state.keyStatus)
  const setDynamicModels = useAppStore((state) => state.setDynamicModels)
  const setSelectedModel = useAppStore((state) => state.setSelectedModel)
  const costCurrency = useAppStore((state) => state.costCurrency)
  const setCostCurrency = useAppStore((state) => state.setCostCurrency)
  const apiKeyUsageTotals = useAppStore((state) => state.apiKeyUsageTotals)
  const resetProviderUsageCost = useAppStore((state) => state.resetProviderUsageCost)
  const resetAllUsageCost = useAppStore((state) => state.resetAllUsageCost)
  const t = useT()
  const cloudProviders = PROVIDERS.filter((provider) => provider.requiresApiKey !== false)

  const [keyData, setKeyData] = useState<Record<string, { exists: boolean; masked: string | null }>>({
    gemini: { exists: false, masked: null },
    claude: { exists: false, masked: null },
    openai: { exists: false, masked: null },
  })
  const [localStatus, setLocalStatus] = useState<LocalAiDiscoveryResult | null>(null)
  const [localBenchmark, setLocalBenchmark] = useState<LocalAiBenchmarkResult | null>(null)
  const [localLoading, setLocalLoading] = useState(false)
  const [localBenchmarking, setLocalBenchmarking] = useState(false)
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<LocalAiModelDownloadProgress | null>(null)
  const [uninstallingModel, setUninstallingModel] = useState<string | null>(null)
  const [installingOllama, setInstallingOllama] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installSuccess, setInstallSuccess] = useState<string | null>(null)
  const [installProgress, setInstallProgress] = useState<LocalAiInstallProgress | null>(null)
  const [showRestartPrompt, setShowRestartPrompt] = useState(false)

  const refreshLocalAi = async (): Promise<LocalAiDiscoveryResult | null> => {
    if (!window.api?.discoverLocalAi) return null
    setLocalLoading(true)
    try {
      const result = window.api.ensureLocalAiRuntime
        ? await window.api.ensureLocalAiRuntime()
        : await window.api.discoverLocalAi(true)
      setLocalStatus(result)
      setLocalBenchmark({
        hardware: result.hardware,
        suggestedModels: result.suggestedModels,
        recommendedModel: result.suggestedModels[0]?.id,
      })
      setKeyStatus('local', result.available)
      setDynamicModels('local', result.models)
      setSelectedModel('local', result.recommendedModel ?? 'local-auto')
      return result
    } finally {
      setLocalLoading(false)
    }
  }

  const runLocalBenchmark = async () => {
    if (!window.api?.benchmarkLocalAi) return
    setLocalBenchmarking(true)
    try {
      const result = await window.api.benchmarkLocalAi()
      setLocalBenchmark(result)
    } finally {
      setLocalBenchmarking(false)
    }
  }

  const handleDownloadLocalModel = async (modelId: string) => {
    if (!window.api?.downloadLocalAiModel) return
    setDownloadingModel(modelId)
    setDownloadProgress({
      model: modelId,
      status: 'running',
      percent: 1,
      message: t.settings_local_ai_downloading_model,
    })
    setDownloadError(null)
    setDownloadSuccess(null)
    setInstallError(null)
    setInstallSuccess(null)
    try {
      const result = await window.api.downloadLocalAiModel(modelId)
      if (!result.success) {
        setDownloadError(result.error ?? t.settings_local_ai_download_failed)
        return
      }
      setDownloadSuccess(`${t.settings_local_ai_downloaded}: ${result.model}`)
      await refreshLocalAi()
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : t.settings_local_ai_download_failed)
    } finally {
      setDownloadingModel(null)
      setDownloadProgress(null)
    }
  }

  const handleUninstallLocalModel = async (modelId: string) => {
    setUninstallingModel(modelId)
    setDownloadError(null)
    setDownloadSuccess(null)
    setInstallError(null)
    setInstallSuccess(null)
    try {
      if (!window.api?.uninstallLocalAiModel) {
        setDownloadError(t.settings_local_ai_uninstall_failed)
        return
      }
      const result = await window.api.uninstallLocalAiModel(modelId)
      if (!result.success) {
        setDownloadError(result.error ?? t.settings_local_ai_uninstall_failed)
        return
      }
      setDownloadSuccess(`${t.settings_local_ai_uninstalled}: ${result.model}`)
      await refreshLocalAi()
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : t.settings_local_ai_uninstall_failed)
    } finally {
      setUninstallingModel(null)
    }
  }

  const handleInstallOllama = async () => {
    if (!window.api?.installOllama) return
    setInstallingOllama(true)
    setInstallProgress({
      status: 'running',
      percent: 5,
      message: t.settings_local_ai_installing_ollama,
    })
    setDownloadError(null)
    setDownloadSuccess(null)
    setInstallError(null)
    setInstallSuccess(null)
    try {
      const result = await window.api.installOllama()
      if (!result.success) {
        setInstallError(result.cancelled ? t.settings_local_ai_install_cancelled : result.error ?? t.settings_local_ai_install_failed)
        return
      }
      if (result.manual) {
        setInstallSuccess(t.settings_local_ai_manual_install_opened)
        return
      }
      setInstallSuccess(t.settings_local_ai_checking_runtime)
      const discovery = await refreshLocalAi()
      if (!discovery?.available) {
        setInstallSuccess(null)
        setShowRestartPrompt(true)
        return
      }
      setInstallSuccess(t.settings_local_ai_ollama_installed)
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : t.settings_local_ai_install_failed)
    } finally {
      setInstallingOllama(false)
    }
  }

  const handleCancelOllamaInstall = async () => {
    await window.api?.cancelOllamaInstall?.()
  }

  const handleRestartApp = () => {
    void window.api?.relaunchApp?.()
  }

  useEffect(() => {
    if (!window.api?.onLocalAiInstallProgress) return
    return window.api.onLocalAiInstallProgress((progress) => {
      setInstallProgress(progress)
      if (progress.status === 'cancelled') {
        setInstallingOllama(false)
        setInstallError(t.settings_local_ai_install_cancelled)
      }
      if (progress.status === 'error') {
        setInstallingOllama(false)
        setInstallError(progress.message || t.settings_local_ai_install_failed)
      }
      if (progress.status === 'success') {
        setInstallingOllama(false)
      }
    })
  }, [t.settings_local_ai_install_cancelled, t.settings_local_ai_install_failed])

  useEffect(() => {
    if (!window.api?.onLocalAiModelDownloadProgress) return
    return window.api.onLocalAiModelDownloadProgress((progress) => {
      setDownloadProgress(progress)
      if (progress.status === 'error') {
        setDownloadError(progress.message)
      }
    })
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount; store setters are stable
  useEffect(() => {
    const loadKeys = async () => {
      if (!window.api) return
      for (const p of cloudProviders) {
        try {
          const result = await window.api.keychain.get(p.id)
          setKeyData((prev) => ({
            ...prev,
            [p.id]: { exists: result.exists ?? false, masked: result.masked ?? null },
          }))
          setKeyStatus(p.id as Provider, result.exists ?? false)
        } catch { /* ignore */ }
      }
    }
    loadKeys()
    void refreshLocalAi()
  }, [])

  const handleSaveKey = async (providerId: string, key: string) => {
    if (!window.api) throw new Error('App API not available')
    const result = await window.api.keychain.save(providerId, key)
    if (!result.success) throw new Error(result.error || 'Failed to save key')
    const updated = await window.api.keychain.get(providerId)
    setKeyData((prev) => ({
      ...prev,
      [providerId]: { exists: updated.exists ?? false, masked: updated.masked ?? null },
    }))
    setKeyStatus(providerId as Provider, true)
    setDynamicModels(providerId as Provider, [])
    resetProviderUsageCost(providerId as Provider)
  }

  const handleDeleteKey = async (providerId: string) => {
    if (!window.api) throw new Error('App API not available')
    await window.api.keychain.delete(providerId)
    setKeyData((prev) => ({
      ...prev,
      [providerId]: { exists: false, masked: null },
    }))
    setKeyStatus(providerId as Provider, false)
    setDynamicModels(providerId as Provider, [])
    resetProviderUsageCost(providerId as Provider)
  }

  const configuredCount = PROVIDERS.filter((p) =>
    p.requiresApiKey === false ? localStatus?.available : keyStatus[p.id] || keyData[p.id]?.exists
  ).length

  return (
    <div className="space-y-8">
      {/* Cost tracking dashboard — surfaces aggregate spend, tokens, and feature breakdown.
          Replaces the bare currency dropdown that used to live in the API Keys header. */}
      <section className="space-y-3">
        <CostOverviewCard
          totals={apiKeyUsageTotals}
          currency={costCurrency}
          onCurrencyChange={setCostCurrency}
          onResetAll={resetAllUsageCost}
        />
      </section>

      {/* AI Provider API Keys */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="section-label">{t.settings_api_keys}</h2>
          <span className="text-xs text-gray-400">
            {configuredCount}/{PROVIDERS.length} {t.settings_configured}
          </span>
        </div>
        {PROVIDERS.map((provider) => (
          provider.requiresApiKey === false ? (
            <LocalAiProviderCard
              key={provider.id}
              status={localStatus}
              benchmark={localBenchmark}
              loading={localLoading}
              benchmarking={localBenchmarking}
              downloadingModel={downloadingModel}
              downloadProgress={downloadProgress}
              uninstallingModel={uninstallingModel}
              installingOllama={installingOllama}
              onRefresh={refreshLocalAi}
              onBenchmark={runLocalBenchmark}
              onDownloadModel={handleDownloadLocalModel}
              onUninstallModel={handleUninstallLocalModel}
              onInstallOllama={handleInstallOllama}
              downloadError={downloadError}
              downloadSuccess={downloadSuccess}
              installError={installError}
              installSuccess={installSuccess}
              installProgress={installProgress}
              showRestartPrompt={showRestartPrompt}
              onCancelInstall={handleCancelOllamaInstall}
              onRestartApp={handleRestartApp}
              onDismissRestartPrompt={() => setShowRestartPrompt(false)}
            />
          ) : (
            <ApiKeyInput
              key={provider.id}
              provider={provider}
              hasKey={keyData[provider.id]?.exists ?? false}
              maskedKey={keyData[provider.id]?.masked ?? null}
              usageTotal={apiKeyUsageTotals[provider.id]}
              usageCurrency={costCurrency}
              usageLabel={t.settings_cost_total}
              onSave={(key) => handleSaveKey(provider.id, key)}
              onDelete={() => handleDeleteKey(provider.id)}
              onResetUsage={() => resetProviderUsageCost(provider.id as Provider)}
            />
          )
        ))}
      </section>

      {/* Deep Research Web Search API Keys */}
      <section className="space-y-3 border-t border-gray-200 pt-6 dark:border-gray-700">
        <div>
          <h2 className="section-label">{t.settings_web_search_section}</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t.settings_web_search_desc_prefix}{' '}
            <button
              type="button"
              onClick={() => window.api?.openExternal(JINA_DOCS_URL)}
              className="text-blue-500 hover:text-blue-700 hover:underline"
            >
              Jina AI
            </button>
            {' '}{t.settings_web_search_desc_suffix}
          </p>
        </div>

        {/* Shared provider table */}
        <DeepResearchApiSection />
      </section>
    </div>
  )
}
