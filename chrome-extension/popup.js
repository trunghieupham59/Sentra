const PORT = 39875

const $ = (id) => document.getElementById(id)

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const COPY_LABEL    = isMac ? '⌘C  Copy'    : 'Ctrl+C  Copy'
const REPLACE_LABEL = isMac ? '⌘↵  Replace' : 'Ctrl+↵  Replace'

// Last translated text — used by Copy and Replace buttons
let lastTranslated = ''

async function getSettings () {
  return new Promise((resolve) => {
    chrome.storage.local.get(['treToken', 'treTargetLang', 'treTranslationStyle'], (data) => {
      resolve({
        token: data.treToken || '',
        targetLang: data.treTargetLang || 'en',
        translationStyle: data.treTranslationStyle || 'general',
      })
    })
  })
}

/** Fetch the active provider/model from the native app via /api/config */
async function getAppConfig (token) {
  const resp = await fetch(`http://127.0.0.1:${PORT}/api/config`, {
    headers: { 'X-Viezan-Token': token },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data = await resp.json()
  if (!data.success) throw new Error('Could not fetch app config')
  return { provider: data.provider, model: data.model }
}

function showStatus (msg, type) {
  const el = $('status-msg')
  el.textContent = msg
  el.className = `statusbar ${type}`
  el.style.display = 'block'
  if (type !== 'loading') {
    setTimeout(() => { el.style.display = 'none' }, 4000)
  }
}

function hideStatus () {
  $('status-msg').style.display = 'none'
}

/** Provider metadata — SVG icon + full name + brand colors */
const PROVIDER_META = {
  gemini: {
    name: 'Google Gemini',
    color: '#1A73E8',
    bg: 'rgba(26,115,232,0.09)',
    border: 'rgba(26,115,232,0.22)',
    svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M12 2C12.3 5.5 13.8 8.8 16 10.5C13.8 12.2 12.3 15.5 12 19C11.7 15.5 10.2 12.2 8 10.5C10.2 8.8 11.7 5.5 12 2Z" fill="#1A73E8"/><path d="M2 10.5C5.5 10.8 8.8 10.2 10.5 8C12.2 10.2 15.5 10.8 19 10.5C15.5 10.2 12.2 11.8 10.5 14C8.8 11.8 5.5 10.2 2 10.5Z" fill="#1A73E8" opacity="0.5"/></svg>',
  },
  openai: {
    name: 'OpenAI GPT',
    color: '#10A37F',
    bg: 'rgba(16,163,127,0.09)',
    border: 'rgba(16,163,127,0.22)',
    svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M12 7L15.46 9V13L12 15L8.54 13V9L12 7Z" fill="#10A37F"/><path d="M12 3.5V7M12 15V18.5M8.54 9L5.5 7.25M15.46 13L18.5 14.75M8.54 13L5.5 14.75M15.46 9L18.5 7.25" stroke="#10A37F" stroke-width="1.5" stroke-linecap="round"/></svg>',
  },
  claude: {
    name: 'Anthropic Claude',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.09)',
    border: 'rgba(217,119,6,0.22)',
    svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><path d="M12 5.5L18.2 20.5H15.5L14.2 17H9.8L8.5 20.5H5.8L12 5.5ZM12 9.5L10.7 13H13.3L12 9.5Z" fill="#D97706"/></svg>',
  },
}

/** Update header status badge + controls bar provider/model badges */
async function loadAppInfo (token) {
  const dot   = $('status-dot')
  const label = $('status-label')
  const providerEl = $('ctrl-provider')
  const modelEl    = $('ctrl-model')

  // Loading state
  dot.className = 'status-dot loading'
  label.textContent = 'Connecting…'

  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/config`, {
      headers: { 'X-Viezan-Token': token },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error('bad')

    // Header: active status
    dot.className = 'status-dot'
    label.textContent = 'Active'

    // Controls bar: provider badge
    const meta = PROVIDER_META[data.provider]
    if (meta) {
      providerEl.className = 'ctrl-badge ctrl-badge-provider'
      providerEl.style.background = meta.bg
      providerEl.style.borderColor = meta.border
      providerEl.style.color = meta.color
      providerEl.innerHTML = `${meta.svg}${meta.name}`
    } else {
      providerEl.className = 'ctrl-badge ctrl-badge-provider'
      providerEl.textContent = data.provider || '—'
    }

    // Controls bar: model badge
    modelEl.className = 'ctrl-badge ctrl-badge-model'
    modelEl.textContent = data.model || '—'
    modelEl.style = ''
  } catch {
    dot.className = 'status-dot error'
    label.textContent = 'App not running'
    providerEl.className = 'ctrl-badge ctrl-badge-loading'
    providerEl.textContent = '—'
    modelEl.className = 'ctrl-badge ctrl-badge-loading'
    modelEl.textContent = '—'
  }
}

/** Show translation result and reveal Copy/Replace buttons */
function showResult (text) {
  lastTranslated = text
  const resultEl = $('result-text')
  resultEl.innerHTML = ''
  resultEl.textContent = text

  // Reveal Copy + Replace buttons
  $('footer-result').style.display = 'flex'

  // Update button labels with OS-aware shortcuts
  $('btn-copy-result').textContent = COPY_LABEL
  $('btn-replace').textContent = REPLACE_LABEL
}

/** Hide Copy/Replace and reset result panel */
function clearResult () {
  lastTranslated = ''
  $('result-text').innerHTML = '<span class="result-placeholder">Translation appears here…</span>'
  $('footer-result').style.display = 'none'
}

async function init () {
  const settings = await getSettings()
  const hasToken = !!settings.token

  $('not-connected-state').style.display = hasToken ? 'none' : 'block'
  $('connected-state').style.display     = hasToken ? 'block' : 'none'

  if (hasToken) {
    // Load provider/model info (non-blocking)
    loadAppInfo(settings.token)

    // Restore saved target language
    const langSelect = $('target-lang')
    if (settings.targetLang) langSelect.value = settings.targetLang
    langSelect.addEventListener('change', () => {
      chrome.storage.local.set({ treTargetLang: langSelect.value })
    })

    // Restore saved translation style
    const styleSelect = $('translation-style')
    if (settings.translationStyle) styleSelect.value = settings.translationStyle
    styleSelect.addEventListener('change', () => {
      chrome.storage.local.set({ treTranslationStyle: styleSelect.value })
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

// ── Translate button ────────────────────────────────────────────────────────

$('btn-translate').addEventListener('click', async () => {
  const text = $('input-text').value.trim()
  if (!text) return

  const settings = await getSettings()
  const targetLang = $('target-lang').value

  $('btn-translate').disabled = true
  clearResult()
  showStatus('Translating…', 'loading')

  try {
    const appConfig = await getAppConfig(settings.token)

    const resp = await fetch(`http://127.0.0.1:${PORT}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viezan-Token': settings.token,
      },
      body: JSON.stringify({
        text,
        targetLang,
        provider: appConfig.provider,
        model: appConfig.model,
        translationStyle: $('translation-style').value || 'general',
      }),
    })

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error(data.error || 'Translation failed')

    showResult(data.translatedText)
    hideStatus()
  } catch (err) {
    const msg = err.message || 'Unknown error'
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      showStatus('❌ Invalid token. Update it in Options.', 'error')
    } else if (msg.includes('fetch') || msg.includes('Failed')) {
      showStatus('❌ Cannot reach Viezan app. Is it running?', 'error')
    } else {
      showStatus(`❌ ${msg}`, 'error')
    }
  } finally {
    $('btn-translate').disabled = false
  }
})

// ── Copy button ─────────────────────────────────────────────────────────────

$('btn-copy-result').addEventListener('click', async () => {
  if (!lastTranslated) return
  try {
    await navigator.clipboard.writeText(lastTranslated)
    $('btn-copy-result').textContent = '✓ Copied!'
    setTimeout(() => {
      $('btn-copy-result').textContent = COPY_LABEL
    }, 1500)
  } catch {
    showStatus('❌ Failed to copy', 'error')
  }
})

// ── Replace button ──────────────────────────────────────────────────────────

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
        const focused = document.activeElement
        const tag = focused?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea') {
          const start = focused.selectionStart
          const end = focused.selectionEnd
          if (start !== end) {
            const before = focused.value.substring(0, start)
            const after  = focused.value.substring(end)
            focused.value = before + text + after
            focused.selectionStart = focused.selectionEnd = start + text.length
            focused.dispatchEvent(new Event('input', { bubbles: true }))
            return true
          }
        }
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
      setTimeout(() => {
        $('btn-replace').textContent = REPLACE_LABEL
      }, 1500)
    } else {
      showStatus('⚠ No text selected on page', 'error')
    }
  } catch {
    showStatus('❌ Cannot replace — try selecting text first', 'error')
  }
})

// ── Clear button ────────────────────────────────────────────────────────────

$('btn-clear').addEventListener('click', () => {
  $('input-text').value = ''
  clearResult()
  hideStatus()
})

// ── Options buttons ─────────────────────────────────────────────────────────

$('btn-options').addEventListener('click',    () => chrome.runtime.openOptionsPage())
$('btn-go-options').addEventListener('click', () => chrome.runtime.openOptionsPage())

// ── Keyboard shortcuts ──────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey

  // Cmd/Ctrl+Enter → Translate
  if (mod && e.key === 'Enter') {
    e.preventDefault()
    $('btn-translate').click()
  }

  // Cmd/Ctrl+C → Copy (only when result buttons are visible and textarea not focused)
  if (mod && e.key === 'c' && lastTranslated &&
      $('footer-result').style.display !== 'none' &&
      document.activeElement !== $('input-text')) {
    e.preventDefault()
    $('btn-copy-result').click()
  }
})

// ── Init ────────────────────────────────────────────────────────────────────

init()
