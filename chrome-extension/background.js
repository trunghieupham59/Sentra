/**
 * T.R.E Assistant — Background Service Worker (Manifest V3)
 *
 * Handles:
 *  • Context-menu "Translate with T.R.E Assistant" entry on selected text
 *  • Relaying translate requests from content scripts if needed
 */

const PORT = 39875

// ── Context menu ──────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'lotus-translate',
    title: 'Translate with T.R.E Assistant',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'lotus-translate') return
  const text = info.selectionText
  if (!text || !tab?.id) return

  // Forward translate request to the active tab's content script
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'LOTUS_TRANSLATE_SELECTION',
      text,
    })
  } catch {
    // Content script may not be loaded on this page
  }
})

// ── Message relay from content script ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'LOTUS_TRANSLATE') {
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

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`)
  }

  const data = await resp.json()
  if (!data.success) throw new Error(data.error || 'Translation failed')
  return { success: true, translatedText: data.translatedText }
}
