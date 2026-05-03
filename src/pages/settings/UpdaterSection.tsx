import { useEffect, useState } from 'react'
import { CheckUpdateButton } from '../../components/ui/CheckUpdateButton'
import { AlertTriangleIcon, CheckCircleIcon, CheckIcon, DownloadIcon, SpinnerIcon } from '../../components/ui/icons'
import { useT } from '../../store/useAppStore'
import { tpl } from '../../utils/tpl'

type UpdaterStatusType = {
  type: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error-codesign' | 'error'
  version?: string
  percent?: number
  installMode?: 'restart' | 'open-installer'
  error?: string
  /** Present on macOS (unsigned build): direct link to the DMG asset or release page. */
  downloadUrl?: string
}

export function UpdaterSection() {
  const t = useT()
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatusType>({ type: 'idle' })
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    if (!window.api?.updater) return
    window.api.updater.getVersion().then((res: { version: string }) => {
      if (res?.version) setAppVersion(res.version)
    })
    const unsub = window.api.updater.onStatus((status) => {
      setUpdaterStatus(status as UpdaterStatusType)
    })
    return unsub
  }, [])

  const handleCheckUpdate = async () => {
    if (!window.api?.updater) return
    setUpdaterStatus({ type: 'checking' })
    await window.api.updater.check()
  }

  const handleDownloadUpdate = () => window.api?.updater?.download()
  const handleInstallUpdate  = () => window.api?.updater?.install()
  const handleOpenInstaller  = () => window.api?.updater?.openInstaller?.()
  const installerMode = updaterStatus.type === 'downloaded' && updaterStatus.installMode === 'open-installer'
  const showManualInstaller = updaterStatus.type === 'downloaded' && updaterStatus.installMode === 'restart'

  return (
    <section className="space-y-3">
      <div>
        <h2 className="section-label">{t.settings_update_section}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_update_section_desc}</p>
      </div>

      <div className="card divide-y divide-gray-100 dark:divide-gray-700">

        {/* Current version + Check button */}
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_update_current_version}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
              v{appVersion || window.api?.version || '—'}
            </p>
          </div>
          <CheckUpdateButton
            status={updaterStatus.type}
            checkLabel={t.settings_update_check}
            checkingLabel={t.settings_update_checking}
            onClick={handleCheckUpdate}
          />
        </div>

        {/* Status row — shown when not idle or checking */}
        {updaterStatus.type !== 'idle' && updaterStatus.type !== 'checking' && (
          <div className="px-4 py-3 space-y-2">

            {/* Update available */}
            {updaterStatus.type === 'available' && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                  <DownloadIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{tpl(t.settings_update_available, { version: updaterStatus.version ?? '' })}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadUpdate}
                  className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors cursor-pointer"
                >
                  {updaterStatus.downloadUrl ? t.settings_update_download_installer : t.settings_update_download}
                </button>
              </div>
            )}

            {/* Up to date */}
            {updaterStatus.type === 'not-available' && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <CheckIcon className="w-4 h-4 flex-shrink-0" />
                <span>{tpl(t.settings_update_not_available, { version: updaterStatus.version ?? appVersion ?? '' })}</span>
              </div>
            )}

            {/* Downloading */}
            {updaterStatus.type === 'downloading' && (
              <div className="space-y-1.5">
                <div className="flex items-center text-xs text-blue-600 dark:text-blue-400">
                  <span className="flex items-center gap-2">
                    <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                    {tpl(t.settings_update_downloading, { percent: updaterStatus.percent ?? 0 })}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${updaterStatus.percent ?? 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Downloaded — ready to install */}
            {updaterStatus.type === 'downloaded' && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                  <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                  <span>{tpl(t.settings_update_downloaded, { version: updaterStatus.version ?? '' })}</span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {showManualInstaller && (
                    <button
                      type="button"
                      onClick={handleOpenInstaller}
                      className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors cursor-pointer"
                    >
                      {t.settings_update_open_installer}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleInstallUpdate}
                    className="px-3 py-1.5 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors cursor-pointer"
                  >
                    {installerMode ? t.settings_update_open_installer : t.settings_update_install}
                  </button>
                </div>
              </div>
            )}

            {/* Code-signature error (macOS unsigned app) */}
            {updaterStatus.type === 'error-codesign' && (
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{t.settings_update_error_codesign}</span>
              </div>
            )}

            {/* Generic error */}
            {updaterStatus.type === 'error' && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{t.settings_update_error}{updaterStatus.error ? `: ${updaterStatus.error}` : ''}</span>
              </div>
            )}

          </div>
        )}

      </div>
    </section>
  )
}
