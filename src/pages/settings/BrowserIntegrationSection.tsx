import { useCallback, useEffect, useState } from 'react'
import { BookmarkletDragLink } from '../../components/ui/BookmarkletDragLink'
import { SettingsCopyButton } from '../../components/ui/SettingsCopyButton'
import { SettingsFormActions } from '../../components/ui/SettingsFormActions'
import { ToggleSwitch } from '../../components/ui/ToggleSwitch'
import { TokenTtlPicker } from '../../components/ui/TokenTtlPicker'
import { AlertTriangleIcon, PlusIcon, RefreshIcon, SpinnerIcon, TrashIcon, XIcon } from '../../components/ui/icons'
import { useAppStore, useT } from '../../store/useAppStore'

type ExtTokenInfo = { id: string; name: string; createdAt: number; expiresAt: number }

/** Simple template helper: replaces {key} placeholders */
const tpl = (str: string, vars: Record<string, string | number>) =>
  str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))

export function BrowserIntegrationSection() {
  const { targetLang } = useAppStore()
  const t = useT()

  const isMac = window.api?.platform === 'darwin'
  const laTargetLang = targetLang

  // ── Legacy Assistant state ─────────────────────────────────────────────────
  const [laEnabled, setLaEnabled] = useState(false)
  const [laBookmarklet, setLaBookmarklet] = useState('')
  const [laBookmarkletCopied, setLaBookmarkletCopied] = useState(false)

  useEffect(() => {
    if (!window.api?.legacyAssistant) return
    window.api.legacyAssistant.get().then((res: { success: boolean; settings?: Record<string, unknown> }) => {
      if (res?.success && res.settings) {
        setLaEnabled(res.settings.enabled === true)
      }
    })
  }, [])

  const loadBookmarklet = useCallback(async () => {
    if (!window.api?.legacyAssistant) return
    const res = await window.api.legacyAssistant.getBookmarklet()
    if (res?.success) setLaBookmarklet(res.bookmarklet ?? '')
  }, [])

  useEffect(() => { loadBookmarklet() }, [loadBookmarklet])

  // Auto-sync targetLang to legacy assistant backend when store changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: laEnabled accessed inside
  useEffect(() => {
    if (!window.api?.legacyAssistant) return
    window.api.legacyAssistant.update({ targetLang: laTargetLang })
    loadBookmarklet()
  }, [laTargetLang, loadBookmarklet])

  const handleLaToggle = async () => {
    const next = !laEnabled
    setLaEnabled(next)
    await window.api?.legacyAssistant?.update({ enabled: next, targetLang: laTargetLang })
  }

  const handleCopyBookmarklet = async () => {
    let url = laBookmarklet
    if (!url && window.api?.legacyAssistant) {
      const res = await window.api.legacyAssistant.getBookmarklet()
      if (res?.success && res.bookmarklet) {
        url = res.bookmarklet
        setLaBookmarklet(url)
      }
    }
    if (!url) return
    await navigator.clipboard.writeText(url)
    setLaBookmarkletCopied(true)
    setTimeout(() => setLaBookmarkletCopied(false), 2000)
  }

  const handleInjectNow = () => {
    window.api?.legacyAssistant?.injectNow()
  }

  // ── Extension token state ──────────────────────────────────────────────────
  const [extPort, setExtPort] = useState(39875)
  const [extTokens, setExtTokens] = useState<ExtTokenInfo[]>([])
  const [extTokensLoading, setExtTokensLoading] = useState(false)
  const [extTokensError, setExtTokensError] = useState('')
  const [revealedToken, setRevealedToken] = useState<{ token: string; name: string; expiresAt: number } | null>(null)
  const [revealedCopied, setRevealedCopied] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenTtl, setNewTokenTtl] = useState(30)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [extPortCopied, setExtPortCopied] = useState(false)
  const [tokenActionError, setTokenActionError] = useState('')

  const defaultTokenName = () => {
    const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    return `Chrome Extension - ${today}`
  }

  const loadTokenList = useCallback(async () => {
    if (!window.api?.localServer) {
      setExtTokensError(t.settings_token_error_connect)
      return
    }
    setExtTokensLoading(true)
    setExtTokensError('')
    try {
      const res = await window.api.localServer.listTokens()
      if (res?.success) {
        setExtTokens(res.tokens ?? [])
        setExtPort(res.port ?? 39875)
      } else {
        setExtTokensError(t.settings_token_error_load)
      }
    } catch (e) {
      setExtTokensError(`${t.settings_token_ipc_error} ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExtTokensLoading(false)
    }
  // biome-ignore lint/correctness/useExhaustiveDependencies: t is included to keep error messages in sync with locale
  }, [t])

  useEffect(() => { loadTokenList() }, [loadTokenList])

  const handleCreateToken = async () => {
    if (!window.api?.localServer) return
    setCreating(true)
    setTokenActionError('')
    try {
      const res = await window.api.localServer.createToken({
        name: newTokenName.trim() || defaultTokenName(),
        ttlDays: newTokenTtl,
      })
      if (res?.success && res.token) {
        setRevealedToken({ token: res.token, name: res.name ?? '', expiresAt: res.expiresAt ?? 0 })
        setRevealedCopied(false)
        setShowCreateForm(false)
        setNewTokenName('')
        setNewTokenTtl(30)
        await loadTokenList()
      } else if (!res?.success) {
        setTokenActionError(res?.error ?? t.settings_token_error_create)
      }
    } catch (e) {
      setTokenActionError(e instanceof Error ? e.message : t.settings_token_error_create)
    } finally { setCreating(false) }
  }

  const handleDeleteToken = async (id: string) => {
    if (!window.api?.localServer) return
    setDeletingId(id)
    setTokenActionError('')
    try {
      await window.api.localServer.deleteToken({ id })
      setExtTokens(prev => prev.filter(tk => tk.id !== id))
      if (revealedToken) setRevealedToken(null)
    } catch (e) {
      setTokenActionError(e instanceof Error ? e.message : t.settings_token_error_delete)
    } finally { setDeletingId(null) }
  }

  const handleRegenerateToken = async (id: string) => {
    if (!window.api?.localServer) return
    setRegeneratingId(id)
    setTokenActionError('')
    try {
      const res = await window.api.localServer.regenerateToken({ id })
      if (res?.success && res.token) {
        setRevealedToken({ token: res.token, name: res.name ?? '', expiresAt: res.expiresAt ?? 0 })
        setRevealedCopied(false)
        await loadTokenList()
      } else if (!res?.success) {
        setTokenActionError(res?.error ?? t.settings_token_error_regenerate)
      }
    } catch (e) {
      setTokenActionError(e instanceof Error ? e.message : t.settings_token_error_regenerate)
    } finally { setRegeneratingId(null) }
  }

  const handleCopyRevealed = async () => {
    if (!revealedToken) return
    await navigator.clipboard.writeText(revealedToken.token)
    setRevealedCopied(true)
    setTimeout(() => setRevealedCopied(false), 2000)
  }

  const handleCopyExtUrl = async () => {
    await navigator.clipboard.writeText(`http://localhost:${extPort}`)
    setExtPortCopied(true)
    setTimeout(() => setExtPortCopied(false), 2000)
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="section-label">{t.settings_legacy_section}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_legacy_section_desc}</p>
      </div>

      {/* ── Legacy Assistant card ── */}
      <div className="card divide-y divide-gray-100 dark:divide-gray-700">

        <div className="px-4 pt-3 pb-1">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Legacy Assistant</p>
        </div>

        {/* Auto-inject toggle — macOS only */}
        {isMac ? (
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_la_auto_enabled}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_la_auto_enabled_desc}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleInjectNow}
                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                           text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              >
                {t.settings_la_inject_now}
              </button>
              <ToggleSwitch
                checked={laEnabled}
                onChange={() => handleLaToggle()}
                color="green"
              />
            </div>
          </div>
        ) : (
          <div className="px-4 py-3.5">
            <p className="text-xs text-amber-600 dark:text-amber-400">{t.settings_la_macos_only}</p>
          </div>
        )}

        {/* Bookmarklet */}
        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Bookmarklet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_bookmarklet_desc}</p>
          </div>

          <div className="space-y-2">
            {/* Step 1: Drag */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t.settings_bookmarklet_step1}</p>
                <BookmarkletDragLink href={laBookmarklet} loadingText={t.settings_bookmarklet_loading} label={t.settings_bookmarklet_label} />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">{t.settings_bookmarklet_alt_hint}</p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <SettingsCopyButton
                    copied={laBookmarkletCopied}
                    onClick={handleCopyBookmarklet}
                    labelCopy={t.settings_bookmarklet_copy}
                    labelCopied={t.settings_bookmarklet_copied}
                  />
                  <button
                    type="button"
                    onClick={loadBookmarklet}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg border border-gray-200 dark:border-gray-600
                               bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300
                               hover:border-amber-400 hover:text-amber-600 transition-colors cursor-pointer font-medium"
                    title={t.settings_bookmarklet_reload_title}
                  >
                    <RefreshIcon />
                    {t.settings_bookmarklet_reload}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Use */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t.settings_bookmarklet_step2}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {t.settings_bookmarklet_step2_desc}{' '}
                  <span className="font-medium text-gray-600 dark:text-gray-300">
                    {(t.lang_names as Record<string, string>)[laTargetLang] ?? laTargetLang}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Chrome Extension token card ── */}
      <div className="card divide-y divide-gray-100 dark:divide-gray-700">

        <div className="px-4 pt-3 pb-1">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Chrome Extension</p>
        </div>

        <div className="px-4 py-3.5 space-y-3">
          {/* Header: Manage tokens + Create button */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_token_manage}</p>
            <button
              type="button"
              onClick={() => setShowCreateForm(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-blue-200 dark:border-blue-800
                         bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400
                         hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer font-medium"
            >
              <PlusIcon />
              {t.settings_token_create}
            </button>
          </div>

          {/* Create form */}
          {showCreateForm && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 space-y-3 border border-gray-200 dark:border-gray-700">
              <div className="space-y-1">
                <label htmlFor="new-token-name" className="text-xs font-medium text-gray-700 dark:text-gray-300">{t.settings_token_name_label}</label>
                <input
                  id="new-token-name"
                  type="text"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder={defaultTokenName()}
                  className="w-full text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600
                             rounded-lg px-3 py-2 outline-none focus:border-blue-400 dark:focus:border-blue-600
                             text-gray-800 dark:text-gray-200 placeholder-gray-400"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{t.settings_token_ttl_label}</p>
                <TokenTtlPicker
                  value={newTokenTtl}
                  onChange={setNewTokenTtl}
                  options={[
                    { days: 7,   label: t.settings_token_ttl_7 },
                    { days: 30,  label: t.settings_token_ttl_30 },
                    { days: 90,  label: t.settings_token_ttl_90 },
                    { days: 365, label: t.settings_token_ttl_365 },
                  ]}
                />
              </div>
              <SettingsFormActions
                onCancel={() => { setShowCreateForm(false); setNewTokenName(''); setNewTokenTtl(30) }}
                onSubmit={handleCreateToken}
                cancelLabel={t.settings_token_cancel}
                submitLabel={t.settings_token_generate}
                submitting={creating}
                topPadding
              />
            </div>
          )}

          {/* One-time token reveal */}
          {revealedToken && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-amber-500 text-sm flex-shrink-0">🔑</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    Token "{revealedToken.name}" — sao chép ngay!
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                    {t.settings_token_reveal_body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealedToken(null)}
                  className="p-1 text-amber-400 hover:text-amber-600 cursor-pointer flex-shrink-0"
                  title="Đóng"
                >
                  <XIcon />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg px-3 py-2 border border-amber-200 dark:border-amber-800">
                <code className="text-xs text-gray-800 dark:text-gray-200 font-mono break-all flex-1 select-all">
                  {revealedToken.token}
                </code>
                <button
                  type="button"
                  onClick={handleCopyRevealed}
                  className={`flex-shrink-0 px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer font-medium ${
                    revealedCopied
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                  }`}
                >
                  {revealedCopied ? t.settings_token_copied : t.settings_token_copy}
                </button>
              </div>
              <p className="text-[11px] text-amber-500 dark:text-amber-400">
                {t.settings_token_expires_label} {new Date(revealedToken.expiresAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          )}

          {/* Token action error */}
          {tokenActionError && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900">
              <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500" />
              <span className="flex-1">{tokenActionError}</span>
              <button type="button" onClick={() => setTokenActionError('')} className="p-0.5 hover:text-red-700 cursor-pointer" title="Đóng">
                <XIcon className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Token list error */}
          {extTokensError && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900">
              <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-500" />
              <span className="flex-1">{extTokensError}</span>
              <button type="button" onClick={loadTokenList} className="underline font-medium cursor-pointer">{t.settings_token_retry}</button>
            </div>
          )}

          {/* Loading */}
          {extTokensLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
              {t.settings_token_loading}
            </div>
          )}

          {/* Empty state */}
          {!extTokensLoading && extTokens.length === 0 && !extTokensError && (
            <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-3 italic">
              {t.settings_token_empty}
            </p>
          )}

          {/* Token list */}
          {extTokens.length > 0 && (
            <div className="space-y-2">
              {extTokens.map((tk) => {
                const now = Date.now()
                const msLeft = tk.expiresAt - now
                const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
                const expired = msLeft <= 0
                const expireDate = new Date(tk.expiresAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const isRegen = regeneratingId === tk.id
                const isDel = deletingId === tk.id
                return (
                  <div key={tk.id} className="flex items-center gap-3 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{tk.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {expired ? (
                          <span className="text-[10px] text-red-500 font-medium">{t.settings_token_expired}</span>
                        ) : daysLeft <= 7 ? (
                          <span className="text-[10px] text-amber-500 font-medium">{tpl(t.settings_token_days_warning, { days: daysLeft, date: expireDate })}</span>
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{tpl(t.settings_token_days_info, { date: expireDate, days: daysLeft })}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Regenerate */}
                      <button
                        type="button"
                        onClick={() => handleRegenerateToken(tk.id)}
                        disabled={isRegen || isDel}
                        title={t.settings_token_regenerate_title}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg border border-gray-200 dark:border-gray-600
                                   text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer
                                   disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRegen ? <SpinnerIcon className="w-3 h-3 animate-spin" /> : <RefreshIcon />}
                        {t.settings_token_regenerate}
                      </button>
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteToken(tk.id)}
                        disabled={isDel || isRegen}
                        title={t.settings_token_delete_title}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950
                                   transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isDel ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <TrashIcon />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Port info + Copy URL */}
        <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{t.settings_extension_port}</span>
          <div className="flex items-center gap-2">
            <code className="font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {extPort}
            </code>
            <SettingsCopyButton
              copied={extPortCopied}
              onClick={handleCopyExtUrl}
              labelCopy={t.settings_token_copy_url_title}
              labelCopied={t.settings_bookmarklet_copied}
              title={t.settings_token_copy_url_title}
            />
          </div>
        </div>

      </div>
    </section>
  )
}
