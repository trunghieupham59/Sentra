const PORT = 39875

const $ = (id) => document.getElementById(id)

// ── Show status ───────────────────────────────────────────────────────────────

function showStatus (msg, type, duration) {
  const el = $('status')
  el.textContent = msg
  el.className = `status ${type}`
  el.style.display = 'block'
  if (duration !== 0) {
    setTimeout(() => { el.style.display = 'none' }, duration || 4000)
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────

$('btn-save').addEventListener('click', () => {
  const token = $('token').value.trim()
  const targetLang = $('target-lang').value
  const translationStyle = $('translation-style').value

  if (!token) {
    showStatus('Please enter a Connection API Key.', 'error')
    return
  }

  chrome.storage.local.set({ treToken: token, treTargetLang: targetLang, treTranslationStyle: translationStyle }, () => {
    showStatus('Settings saved.', 'success')
  })
})

// ── Test Connection ───────────────────────────────────────────────────────────

$('btn-test').addEventListener('click', async () => {
  const token = $('token').value.trim()
  if (!token) {
    showStatus('Enter an API key first.', 'error')
    return
  }

  showStatus('Testing connection...', 'info', 0)

  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/status`, {
      headers: { 'X-Viezan-Token': token },
    })

    if (resp.status === 401) {
      showStatus('API key is invalid. Copy it again from the Viezan app.', 'error')
      return
    }
    if (!resp.ok) {
      showStatus(`Server responded with HTTP ${resp.status}`, 'error')
      return
    }

    const data = await resp.json()
    if (data.success) {
      // Auto-save settings on successful connection so content script & popup
      // always have the correct API key without requiring a separate "Save" click.
      const targetLang = $('target-lang').value
      const translationStyle = $('translation-style').value
      chrome.storage.local.set({ treToken: token, treTargetLang: targetLang, treTranslationStyle: translationStyle })
      showStatus(`Connected to Viezan v${data.version || '?'}. Settings saved.`, 'success')
      // Refresh the active provider/model display
      loadAiConfig(token)
    } else {
      showStatus('Unexpected response from Viezan app.', 'error')
    }
  } catch (err) {
    const msg = err?.message || String(err)
    if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('NetworkError')) {
      showStatus(
        'Cannot reach Viezan app on port 39875. ' +
        'Make sure the app is running. If it is, try reloading the extension (chrome://extensions > Reload).',
        'error'
      )
    } else {
      showStatus(msg, 'error')
    }
  }
})

// ── Fetch & display active AI config ─────────────────────────────────────────

function setProviderBadge (provider) {
  const badge = document.getElementById('ai-provider-badge')
  const meta = window.ViezanProviderMeta?.getProviderMeta(provider)
  const displayName = (window.ViezanModelDisplay
    ? window.ViezanModelDisplay.getProviderDisplayName(provider)
    : provider) || '-'
  badge.textContent = ''
  if (meta) {
    const mark = document.createElement('span')
    mark.className = 'provider-mark'
    mark.style.background = meta.color
    badge.append(mark, document.createTextNode(displayName))
  } else {
    badge.textContent = displayName
  }
}

async function loadAiConfig (token) {
  const loading = document.getElementById('ai-config-loading')
  const info    = document.getElementById('ai-config-info')
  const error   = document.getElementById('ai-config-error')

  loading.style.display = 'flex'
  info.style.display    = 'none'
  error.style.display   = 'none'

  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/config`, {
      headers: { 'X-Viezan-Token': token },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error('bad response')

    setProviderBadge(data.provider)
    // Use the desktop app's short pretty model name (e.g. "GPT 5.5 Mini")
    // instead of the raw provider id like "gpt-5.5-mini-2026-05-01".
    document.getElementById('ai-model-badge').textContent = window.ViezanModelDisplay
      ? window.ViezanModelDisplay.formatModelName(data.provider, data.model) || '-'
      : (data.model || '-')

    loading.style.display = 'none'
    info.style.display    = 'grid'
  } catch {
    loading.style.display = 'none'
    error.style.display   = 'block'
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init () {
  chrome.storage.local.get(['treToken', 'treTargetLang', 'treTranslationStyle'], (data) => {
    if (data.treToken)      $('token').value = data.treToken
    if (data.treTargetLang) $('target-lang').value = data.treTargetLang
    if (data.treTranslationStyle) $('translation-style').value = data.treTranslationStyle

    if (data.treToken) {
      loadAiConfig(data.treToken)
    } else {
      // No API key yet — show "not connected" state
      document.getElementById('ai-config-loading').style.display = 'none'
      document.getElementById('ai-config-error').style.display = 'block'
    }
  })
}

init()
