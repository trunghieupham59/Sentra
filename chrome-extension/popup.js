const PORT = 39875

const $ = (id) => document.getElementById(id)

// Last translated text — used by Copy and Replace buttons
let lastTranslated = ''

async function getSettings () {
  return new Promise((resolve) => {
    chrome.storage.local.get(['treToken', 'treTargetLang'], (data) => {
      resolve({
        token: data.treToken || '',
        targetLang: data.treTargetLang || 'en',
      })
    })
  })
}

/** Fetch the active provider/model from the native app via /api/config */
async function getAppConfig (token) {
  const resp = await fetch(`http://127.0.0.1:${PORT}/api/config`, {
    headers: { 'X-TRE-Token': token },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data.success) throw new Error('Could not fetch app config')
  return { provider: data.provider, model: data.model }
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

const PROVIDER_LABELS = {
  gemini: '✨ Gemini',
  openai: '🤖 OpenAI',
  claude: '🧠 Claude',
}

async function loadAiInfoBar (token) {
  const dot      = $('ai-dot')
  const infoText = $('ai-info-text')

  dot.className = 'ai-dot loading'
  infoText.innerHTML = 'Loading…'

  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/config`, {
      headers: { 'X-TRE-Token': token },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error('bad')

    const providerLabel = PROVIDER_LABELS[data.provider] || data.provider
    dot.className = 'ai-dot'
    infoText.innerHTML =
      `<span class="ai-pill">${providerLabel}</span>` +
      `<span class="ai-pill ai-pill-model">${data.model || '—'}</span>`
  } catch {
    dot.className = 'ai-dot error'
    infoText.textContent = 'App not running'
  }
}

async function init () {
  const settings = await getSettings()
  const hasToken = !!settings.token

  $('not-connected-state').style.display = hasToken ? 'none' : 'block'
  $('connected-state').style.display = hasToken ? 'block' : 'none'

  if (hasToken) {
    // Load active provider/model info bar
    loadAiInfoBar(settings.token)

    // Restore saved target lang
    const langSelect = $('target-lang')
    if (settings.targetLang) langSelect.value = settings.targetLang

    // Persist lang change
    langSelect.addEventListener('change', () => {
      chrome.storage.local.set({ treTargetLang: langSelect.value })
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
  const targetLang = $('target-lang').value

  $('btn-translate').disabled = true
  $('result-box').style.display = 'none'
  lastTranslated = ''
  showStatus('Translating…', 'loading')

  try {
    // Fetch provider/model from the native app — always in sync with the app's selection
    const appConfig = await getAppConfig(settings.token)

    const resp = await fetch(`http://127.0.0.1:${PORT}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TRE-Token': settings.token,
      },
      body: JSON.stringify({
        text,
        targetLang,
        provider: appConfig.provider,
        model: appConfig.model,
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
      showStatus('❌ Cannot reach Sentra app. Is it running?', 'error')
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
