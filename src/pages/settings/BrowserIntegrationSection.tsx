import { useCallback, useEffect, useState } from 'react'
import { InlineErrorBanner } from '../../components/ui/InlineErrorBanner'
import { SettingsFormActions } from '../../components/ui/SettingsFormActions'
import { TokenTtlPicker } from '../../components/ui/TokenTtlPicker'
import {
  GitHubIcon, KeyIcon,
  PlusIcon, RefreshIcon, SpinnerIcon, TrashIcon, XIcon,
} from '../../components/ui/icons'
import { GITHUB_RELEASES_URL } from '../../constants/urls'
import { useAppStore, useT } from '../../store/useAppStore'
import { formatDate, tpl } from '../../utils/tpl'

// ── Token-scoped constants ────────────────────────────────────────────────────

/** Default TTL (days) pre-selected when opening the create-token form. */
const DEFAULT_TOKEN_TTL_DAYS = 30

/** Days remaining below which the expiry badge turns amber as a warning. */
const TOKEN_EXPIRY_WARNING_DAYS = 7

/** Milliseconds in one day — used to convert expiry timestamps to days. */
const ONE_DAY_MS = 1_000 * 60 * 60 * 24

/** How long (ms) the "Copied!" badge stays visible after copying a token. */
const TOKEN_COPY_FEEDBACK_MS = 2_000

/** Prefix used when auto-generating a default token name. */
const DEFAULT_TOKEN_NAME_PREFIX = 'Chrome Extension'

// ── Types ─────────────────────────────────────────────────────────────────────

type ExtTokenInfo = { id: string; name: string; createdAt: number; expiresAt: number }

// ── Main component ────────────────────────────────────────────────────────────

export function BrowserIntegrationSection() {
  const { locale } = useAppStore()
  const t = useT()

  // ── Extension token state ──────────────────────────────────────────────────
  const [extTokens, setExtTokens] = useState<ExtTokenInfo[]>([])
  const [extTokensLoading, setExtTokensLoading] = useState(false)
  const [extTokensError, setExtTokensError] = useState('')
  const [revealedToken, setRevealedToken] = useState<{ token: string; name: string; expiresAt: number } | null>(null)
  const [revealedCopied, setRevealedCopied] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenTtl, setNewTokenTtl] = useState(DEFAULT_TOKEN_TTL_DAYS)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [tokenActionError, setTokenActionError] = useState('')

  const defaultTokenName = () => {
    const today = formatDate(Date.now(), locale)
    return `${DEFAULT_TOKEN_NAME_PREFIX} - ${today}`
  }

  // ── D-2: Token request helper — removes guard+try/catch duplication ────────
  async function tokenRequest<T>(fn: () => Promise<T>): Promise<T | null> {
    if (!window.api?.localServer) return null
    setTokenActionError('')
    try {
      return await fn()
    } catch (e) {
      setTokenActionError(e instanceof Error ? e.message : String(e))
      return null
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────
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
      } else {
        setExtTokensError(t.settings_token_error_load)
      }
    } catch (e) {
      setExtTokensError(`${t.settings_token_ipc_error} ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setExtTokensLoading(false)
    }
  // biome-ignore lint/correctness/useExhaustiveDependencies: t keeps error messages in sync with locale
  }, [t])

  useEffect(() => { loadTokenList() }, [loadTokenList])

  // ── Token mutation handlers ────────────────────────────────────────────────

  const handleCreateToken = async () => {
    setCreating(true)
    const res = await tokenRequest(() =>
      window.api.localServer.createToken({
        name: newTokenName.trim() || defaultTokenName(),
        ttlDays: newTokenTtl,
      })
    )
    if (res?.success && res.token) {
      setRevealedToken({ token: res.token, name: res.name ?? '', expiresAt: res.expiresAt ?? 0 })
      setRevealedCopied(false)
      setShowCreateForm(false)
      setNewTokenName('')
      setNewTokenTtl(DEFAULT_TOKEN_TTL_DAYS)
      await loadTokenList()
    } else if (res && !res.success) {
      setTokenActionError(res.error ?? t.settings_token_error_create)
    }
    setCreating(false)
  }

  const handleDeleteToken = async (id: string) => {
    setDeletingId(id)
    const res = await tokenRequest(() =>
      window.api.localServer.deleteToken({ id })
    )
    if (res) {
      setExtTokens(prev => prev.filter(tk => tk.id !== id))
      if (revealedToken) setRevealedToken(null)
    }
    setDeletingId(null)
  }

  const handleRegenerateToken = async (id: string) => {
    setRegeneratingId(id)
    const res = await tokenRequest(() =>
      window.api.localServer.regenerateToken({ id })
    )
    if (res?.success && res.token) {
      setRevealedToken({ token: res.token, name: res.name ?? '', expiresAt: res.expiresAt ?? 0 })
      setRevealedCopied(false)
      await loadTokenList()
    } else if (res && !res.success) {
      setTokenActionError(res.error ?? t.settings_token_error_regenerate)
    }
    setRegeneratingId(null)
  }

  const handleCopyRevealed = async () => {
    if (!revealedToken) return
    await navigator.clipboard.writeText(revealedToken.token)
    setRevealedCopied(true)
    setTimeout(() => setRevealedCopied(false), TOKEN_COPY_FEEDBACK_MS)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-3">
      <div>
        <h2 className="section-label">{t.settings_extension_section}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_legacy_section_desc}</p>
      </div>

      {/* ── Chrome Extension token card ── */}
      <div className="card divide-y divide-gray-100 dark:divide-gray-700">

        <div className="px-4 pt-3 pb-1">
          {/* TODO: H-8 — move to i18n key (settings_chrome_extension_label) */}
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Chrome Extension</p>
        </div>

        {/* Download & Install */}
        <div className="px-4 py-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t.settings_extension_download_title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.settings_extension_download_desc}</p>
          </div>
          <div className="space-y-1.5">
            {([
              t.settings_extension_install_step1,
              t.settings_extension_install_step2,
              t.settings_extension_install_step3,
              t.settings_extension_install_step4,
            ] as const).map((step, i) => (
              <div key={step} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-gray-600 dark:text-gray-400">{step}</p>
              </div>
            ))}
          </div>
          {/* H-1 + H-2: use GitHubIcon component + GITHUB_RELEASES_URL constant */}
          <button
            type="button"
            onClick={() => window.api?.openExternal(GITHUB_RELEASES_URL)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
                       bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600
                       text-white font-medium transition-colors cursor-pointer"
          >
            <GitHubIcon />
            {t.settings_extension_download_btn}
          </button>
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
                onCancel={() => {
                  setShowCreateForm(false)
                  setNewTokenName('')
                  setNewTokenTtl(DEFAULT_TOKEN_TTL_DAYS)
                }}
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
                <KeyIcon className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    {tpl(t.settings_token_reveal_title, { name: revealedToken.name })}
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                    {t.settings_token_reveal_body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevealedToken(null)}
                  className="p-1 text-amber-400 hover:text-amber-600 cursor-pointer flex-shrink-0"
                  title={t.settings_token_close}
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
                {t.settings_token_expires_label} {formatDate(revealedToken.expiresAt, locale)}
              </p>
            </div>
          )}

          {tokenActionError && (
            <InlineErrorBanner
              message={tokenActionError}
              onDismiss={() => setTokenActionError('')}
            />
          )}
          {extTokensError && (
            <InlineErrorBanner
              message={extTokensError}
              retryLabel={t.settings_token_retry}
              onRetry={loadTokenList}
            />
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
                // H-5: use named constant instead of magic expression
                const daysLeft = Math.ceil(msLeft / ONE_DAY_MS)
                const expired = msLeft <= 0
                const expireDate = formatDate(tk.expiresAt, locale)
                const isRegen = regeneratingId === tk.id
                const isDel = deletingId === tk.id
                return (
                  <div key={tk.id} className="flex items-center gap-3 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{tk.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {expired ? (
                          <span className="text-[10px] text-red-500 font-medium">{t.settings_token_expired}</span>
                        ) : daysLeft <= TOKEN_EXPIRY_WARNING_DAYS ? (
                          // H-4: TOKEN_EXPIRY_WARNING_DAYS instead of magic 7
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

      </div>
    </section>
  )
}
