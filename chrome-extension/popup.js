const PORT = 39875

const $ = (id) => document.getElementById(id)

// Last translated text — used by Copy and Replace buttons
let lastTranslated = ''

async function getSettings () {
  return new Promise((resolve) => {
    chrome.storage.local.get(['lotusToken', 'lotusTargetLang', 'lotusProvider', 'lotusModel'], (data) => {
      resolve({
        token: data.lotusToken || '',
        targetLang: data.lotusTargetLang || 'en',
        provider: data.lotusProvider || 'gemini',
        model: data.lotusModel || 'gemini-2.0-flash',
      })
    })
  })
}

function showStatus (msg, type) {
  const el = $('status-msg')
  el.textContent = msg
  el.className = `status ${type}`
  el.style.display = 'block'
  if (type !== 'loading') {
    setTimeout(() => { el.style.display = 'none' }, 4000)
  }
}

function hideStatus () {
  $('status-msg').style.display = 'none'
}

async function init () {
  const settings = await getSettings()
  const hasToken = !!settings.token

  $('not-connected-state').style.display = hasToken ? 'none' : 'block'
  $('connected-state').style.display = hasToken ? 'block' : 'none'

  if (hasToken) {
    // Restore saved target lang
    const langSelect = $('target-lang')
    if (settings.targetLang) langSelect.value = settings.targetLang

    // Persist lang change
    langSelect.addEventListener('change', () => {
      chrome.storage.local.set({ lotusTargetLang: langSelect.value })
    })

    // Try to pre-fill with current tab selection
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString().trim() || '',
        }).catch(() => [{ result: '' }])
        if (result?.result) {
          $('input-text').value = result.result
        }
      }
    } catch { /* ignore — scripting may not be permitted */ }
  }
}

// Translate button
$('btn-translate').addEventListener('click', async () => {
  const text = $('input-text').value.trim()
  if (!text) return

  const settings = await getSettings()
  const langSelect = $('target-lang')
  const targetLang = langSelect.value

  $('btn-translate').disabled = true
  $('result-box').style.display = 'none'
  lastTranslated = ''
  showStatus('Translating…', 'loading')

  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lotus-Token': settings.token,
      },
      body: JSON.stringify({
        text,
        targetLang,
        provider: settings.provider,
        model: settings.model,
      }),
    })

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error(data.error || 'Translation failed')

    lastTranslated = data.translatedText
    $('result-text').textContent = data.translatedText
    $('result-box').style.display = 'block'

    // Reset button states
    $('btn-copy-result').textContent = '📋 Copy'
    $('btn-copy-result').classList.remove('copied')
    $('btn-replace').textContent = '↩ Replace'
    $('btn-replace').classList.remove('replaced')

    hideStatus()
  } catch (err) {
    const msg = err.message || 'Unknown error'
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      showStatus('❌ Invalid token. Update it in Options.', 'error')
    } else if (msg.includes('fetch') || msg.includes('Failed')) {
      showStatus('❌ Cannot reach Lotus app. Is it running?', 'error')
    } else {
      showStatus(`❌ ${msg}`, 'error')
    }
  } finally {
    $('btn-translate').disabled = false
  }
})

// Copy button — copies translated text to clipboard
$('btn-copy-result').addEventListener('click', async () => {
  if (!lastTranslated) return
  try {
    await navigator.clipboard.writeText(lastTranslated)
    $('btn-copy-result').textContent = '✓ Copied!'
    $('btn-copy-result').classList.add('copied')
    setTimeout(() => {
      $('btn-copy-result').textContent = '📋 Copy'
      $('btn-copy-result').classList.remove('copied')
    }, 2000)
  } catch {
    showStatus('❌ Failed to copy', 'error')
  }
})

// Replace button — replaces the selected text on the active page with the translation
$('btn-replace').addEventListener('click', async () => {
  if (!lastTranslated) return
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      showStatus('❌ No active tab found', 'error')
      return
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text) => {
        // Try execCommand first — works for input, textarea, contenteditable
        const focused = document.activeElement
        const tag = focused?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea') {
          const start = focused.selectionStart
          const end = focused.selectionEnd
          if (start !== end) {
            const before = focused.value.substring(0, start)
            const after = focused.value.substring(end)
            focused.value = before + text + after
            focused.selectionStart = focused.selectionEnd = start + text.length
            focused.dispatchEvent(new Event('input', { bubbles: true }))
            return true
          }
        }
        // contenteditable or regular page selection
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
          const range = sel.getRangeAt(0)
          range.deleteContents()
          const node = document.createTextNode(text)
          range.insertNode(node)
          // Move cursor after inserted text
          range.setStartAfter(node)
          range.setEndAfter(node)
          sel.removeAllRanges()
          sel.addRange(range)
          return true
        }
        return false
      },
      args: [lastTranslated],
    })

    if (result?.result) {
      $('btn-replace').textContent = '✓ Replaced!'
      $('btn-replace').classList.add('replaced')
      setTimeout(() => {
        $('btn-replace').textContent = '↩ Replace'
        $('btn-replace').classList.remove('replaced')
      }, 2000)
    } else {
      showStatus('⚠ No text selected on page', 'error')
    }
  } catch (err) {
    showStatus('❌ Cannot replace — try selecting text first', 'error')
  }
})

// Clear button
$('btn-clear').addEventListener('click', () => {
  $('input-text').value = ''
  $('result-box').style.display = 'none'
  lastTranslated = ''
  hideStatus()
})

// Options buttons
$('btn-options').addEventListener('click', () => chrome.runtime.openOptionsPage())
$('btn-go-options').addEventListener('click', () => chrome.runtime.openOptionsPage())

// Init
init()
