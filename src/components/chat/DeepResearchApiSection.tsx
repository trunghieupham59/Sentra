/**
 * DeepResearchApiSection — Inline API key management for Deep Research providers.
 *
 * Shown inside the AI Config popup on ChatPage AND in the Settings App (ApiKeysSection).
 *
 * Provider priority (highest → lowest quality):
 *   1. Tavily   — Best for LLMs, requires key (app.tavily.com)
 *   2. Brave    — Good quality, requires key (api.search.brave.com)
 *   3. Jina AI  — Free forever, no key needed (default fallback)
 *
 * Layout:
 *   [Jina AI — mặc định miễn phí ✓]
 *
 *   PROVIDER  STATUS  API KEY
 *   Tavily      ✓     [tvly-●●●●] Lưu
 *   Brave             [input...]  Lưu
 */
import { useEffect, useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { CheckIcon, XIcon } from '../ui/icons'

// ─── Single provider row ──────────────────────────────────────────────────────

interface KeyRowProps {
  label: string
  /** Provider id for keychain AND for webSearchVerify ('tavily' | 'brave') */
  keychainId: 'tavily' | 'brave'
  placeholder: string
  onStatusChange: (exists: boolean) => void
}

function KeyRow({ label, keychainId, placeholder, onStatusChange }: KeyRowProps) {
  const [masked, setMasked] = useState<string | null>(null)
  const [exists, setExists] = useState(false)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  /** 'idle' | 'verifying' | 'saving' */
  const [status, setStatus] = useState<'idle' | 'verifying' | 'saving'>('idle')
  const [verifyError, setVerifyError] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api) return
    window.api.keychain.get(keychainId).then((res) => {
      const e = res.exists ?? false
      setExists(e)
      setMasked(res.masked ?? null)
      onStatusChange(e)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keychainId])

  const handleSave = async () => {
    const key = input.trim()
    if (!key || !window.api) return
    setVerifyError(null)

    // Step 1 — Verify the key is actually valid (only if the IPC handler is available)
    if (typeof window.api.webSearchVerify === 'function') {
      setStatus('verifying')
      try {
        const verifyResult = await window.api.webSearchVerify({ provider: keychainId, apiKey: key })
        if (!verifyResult.valid) {
          setVerifyError(verifyResult.error ?? 'API key không hợp lệ')
          setStatus('idle')
          return
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Skip verification if the IPC handler isn't registered yet (app not fully rebuilt)
        const isIpcMissing =
          msg.includes('not a function') ||
          msg.includes('No handler registered') ||
          msg.includes('undefined') ||
          msg.includes('ERR_IPC')
        if (!isIpcMissing) {
          setVerifyError(msg || 'Không thể xác minh key')
          setStatus('idle')
          return
        }
        // IPC not available → fall through to save directly
      }
    }

    // Step 2 — Save to secure keychain
    setStatus('saving')
    try {
      await window.api.keychain.save(keychainId, key)
      const updated = await window.api.keychain.get(keychainId)
      const e = updated.exists ?? false
      setExists(e)
      setMasked(updated.masked ?? null)
      onStatusChange(e)
      setInput('')
      setEditing(false)
    } catch { /* ignore */ } finally {
      setStatus('idle')
    }
  }

  const handleDelete = async () => {
    if (!window.api) return
    await window.api.keychain.delete(keychainId).catch(() => {})
    setExists(false)
    setMasked(null)
    onStatusChange(false)
    setInput('')
    setEditing(false)
    setVerifyError(null)
  }

  const inViewMode = exists && !editing
  const isBusy = status !== 'idle'

  const saveLabel =
    status === 'verifying' ? 'Đang kiểm tra…'
    : status === 'saving'   ? 'Đang lưu…'
    : 'Lưu'

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[80px_32px_1fr_auto] items-center gap-x-2">
        {/* PROVIDER */}
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
          {label}
        </span>

        {/* STATUS */}
        <div className="flex items-center justify-center">
          {exists && !editing && (
            <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
          )}
        </div>

        {/* API KEY field */}
        <div className={`flex items-center px-2.5 py-1.5 rounded-lg min-w-0 border
                         ${verifyError
                           ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20'
                           : inViewMode
                             ? 'border-gray-100 dark:border-gray-800 bg-transparent'
                             : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60'}`}>
          {inViewMode ? (
            <span className="flex-1 text-xs font-mono text-gray-400 dark:text-gray-500 truncate">
              {masked ?? '••••••••'}
            </span>
          ) : (
            <input
              type="password"
              value={input}
              onChange={(e) => { setInput(e.target.value); setVerifyError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={placeholder}
              disabled={isBusy}
              className="flex-1 text-xs bg-transparent outline-none min-w-0
                         text-gray-700 dark:text-gray-200
                         placeholder-gray-400 dark:placeholder-gray-600
                         disabled:opacity-60"
            />
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {inViewMode ? (
            <>
              <button
                type="button"
                onClick={() => { setEditing(true); setVerifyError(null) }}
                className="text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200
                           cursor-pointer transition-colors px-1.5 py-1 rounded
                           hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Thay đổi
              </button>
              <button
                type="button"
                onClick={handleDelete}
                title="Xóa key"
                className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400
                           cursor-pointer transition-colors p-1 rounded"
              >
                <XIcon className="w-3 h-3" />
              </button>
            </>
          ) : (
            <>
              {editing && (
                <button
                  type="button"
                  onClick={() => { setEditing(false); setInput(''); setVerifyError(null) }}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded
                             hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!input.trim() || isBusy}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap
                           bg-indigo-500 hover:bg-indigo-600 text-white
                           disabled:opacity-50 disabled:cursor-not-allowed
                           cursor-pointer transition-colors"
              >
                {saveLabel}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Verification error */}
      {verifyError && (
        <div className="col-span-full ml-[112px] text-[11px] text-red-500 dark:text-red-400">
          {verifyError}
        </div>
      )}
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function DeepResearchApiSection() {
  const { setHasTavilyKey, setHasBraveKey } = useAppStore()

  return (
    <div className="flex flex-col gap-3">

      {/* Jina AI free badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                      bg-emerald-50 dark:bg-emerald-950/20
                      border border-emerald-100 dark:border-emerald-900/30">
        <CheckIcon className="w-3 h-3 text-emerald-500 flex-shrink-0" />
        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
          Jina AI — mặc định miễn phí, không cần API key
        </span>
      </div>

      {/* Table */}
      <div className="flex flex-col gap-2">
        {/* Column headers */}
        <div className="grid grid-cols-[80px_32px_1fr_auto] gap-x-2 px-0.5">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            Provider
          </span>
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center">
            ✓
          </span>
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
            API Key
          </span>
          <span />
        </div>

        {/* Tavily */}
        <KeyRow
          label="Tavily"
          keychainId="tavily"
          placeholder="tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          onStatusChange={setHasTavilyKey}
        />

        {/* Brave Search */}
        <KeyRow
          label="Brave Search"
          keychainId="brave"
          placeholder="BSA1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          onStatusChange={setHasBraveKey}
        />
      </div>

      {/* Hint */}
      <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed">
        Khi có API key, provider đó được ưu tiên hơn Jina AI miễn phí.
      </p>
    </div>
  )
}
