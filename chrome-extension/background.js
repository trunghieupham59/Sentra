/**
 * T.R.E Assistant — Background Service Worker (Manifest V3)
 *
 * Handles:
 *  • Context-menu "Translate with T.R.E Assistant" entry on selected text
 *  • Auto re-injection of content script when context is invalidated
 *  • Relaying translate requests from content scripts if needed
 */

const PORT = 39875

// ── Context menu ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  // (Re)create context menu — safe to call on every install/update
  try { chrome.contextMenus.create({ id: 'tre-translate', title: 'Translate with T.R.E Assistant', contexts: ['selection'] }) } catch { /* already exists */ }

  // Best-effort: try to re-inject into all open tabs on install/update.
  // Note: chrome.tabs.query({}) without url filter works WITHOUT the "tabs" permission.
  // chrome.scripting.executeScript will silently fail on non-injectable tabs (PDF, chrome://, etc.)
  if (details.reason === 'install' || details.reason === 'update') {
    try {
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (!tab.id) continue
        injectContentScript(tab.id)   // fire-and-forget, errors are caught inside
      }
    } catch { /* ignore */ }
  }
})

// ── Auto re-inject when user activates a tab ──────────────────────────────────
// This is the KEY fix for the "Extension was updated, please reload" problem.
//
// When the extension is reloaded (e.g. dev "Reload" in chrome://extensions),
// the service worker restarts but existing tabs still hold a stale content script
// whose extension context is dead. onInstalled does NOT fire for dev reloads.
//
// Solution: every time the user switches to a tab, ping the content script.
// If it doesn't respond → context is dead → silently re-inject fresh script.

// When user switches tabs
chrome.tabs.onActivated.addListener(({ tabId }) => {
  ensureContentScript(tabId)
})

// When a tab finishes loading / navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    ensureContentScript(tabId)
  }
})

// When user CMD+Tabs back into Chrome (window gains focus) — the active tab
// doesn't change so onActivated never fires, but we still need to check.
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return  // Chrome lost focus, ignore

  try {
    // chrome.tabs.query with only {active, windowId} does NOT need the "tabs" permission
    const [tab] = await chrome.tabs.query({ active: true, windowId })
    if (tab?.id) ensureContentScript(tab.id)
  } catch { /* ignore */ }
})

/**
 * Ping the content script in a tab.
 * If it doesn't confirm alive (throws OR returns falsy/undefined), re-inject it.
 *
 * We check the RESPONSE VALUE because when context is invalidated Chrome sometimes
 * resolves sendMessage with `undefined` instead of throwing — checking only the
 * try/catch would miss that case and incorrectly treat a dead script as alive.
 */
async function ensureContentScript (tabId) {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'TRE_PING' })
    if (resp?.alive) return   // confirmed alive — nothing to do
    // Resolved but with falsy/undefined → context may be dead or no handler
    injectContentScript(tabId)
  } catch {
    // sendMessage threw (no listener, or extension context error) → re-inject
    injectContentScript(tabId)
  }
}

/**
 * Programmatically inject content.css + content.js into a tab.
 * Silently ignores non-injectable tabs (chrome://, PDF, etc.).
 */
async function injectContentScript (tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] })
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
  } catch {
    // Tab is not injectable — ignore
  }
}

// ── Context menu click ────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'tre-translate') return
  const text = info.selectionText
  if (!text || !tab?.id) return

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TRE_TRANSLATE_SELECTION', text })
  } catch {
    // Content script may not be loaded on this page
  }
})

// ── Message relay from content script ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRE_TRANSLATE') {
    handleTranslate(message).then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message })
    })
    return true // keep channel open for async response
  }
})

async function handleTranslate (message) {
  const { text, token, targetLang, provider, model } = message

  const resp = await fetch(`http://127.0.0.1:${PORT}/api/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-TRE-Token': token,
    },
    body: JSON.stringify({ text, targetLang, provider, model }),
  })

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data.success) throw new Error(data.error || 'Translation failed')
  return { success: true, translatedText: data.translatedText }
}
