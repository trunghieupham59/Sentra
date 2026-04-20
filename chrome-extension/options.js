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

  if (!token) {
    showStatus('❌ Please enter a Connection Token.', 'error')
    return
  }

  chrome.storage.local.set({ treToken: token, treTargetLang: targetLang }, () => {
    showStatus('✓ Settings saved!', 'success')
  })
})

// ── Test Connection ───────────────────────────────────────────────────────────

$('btn-test').addEventListener('click', async () => {
  const token = $('token').value.trim()
  if (!token) {
    showStatus('❌ Enter a token first.', 'error')
    return
  }

  showStatus('Testing connection…', 'info', 0)

  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/status`, {
      headers: { 'X-TRE-Token': token },
    })

    if (resp.status === 401) {
      showStatus('❌ Token is invalid. Copy it again from the Sentra app.', 'error')
      return
    }
    if (!resp.ok) {
      showStatus(`❌ Server responded with HTTP ${resp.status}`, 'error')
      return
    }

    const data = await resp.json()
    if (data.success) {
      // Auto-save settings on successful connection so content script & popup
      // always have the correct token without requiring a separate "Save" click.
      const targetLang = $('target-lang').value
      chrome.storage.local.set({ treToken: token, treTargetLang: targetLang })
      showStatus(`✓ Connected to Sentra v${data.version || '?'} — Settings saved!`, 'success')
      // Refresh the active provider/model display
      loadAiConfig(token)
    } else {
      showStatus('❌ Unexpected response from Sentra app.', 'error')
    }
  } catch (err) {
    const msg = err?.message || String(err)
    if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('NetworkError')) {
      showStatus(
        '❌ Cannot reach Sentra app on port 39875. ' +
        'Make sure the app is running. If it is, try reloading the extension (chrome://extensions → Reload).',
        'error'
      )
    } else {
      showStatus(`❌ ${msg}`, 'error')
    }
  }
})

// ── Fetch & display active AI config ─────────────────────────────────────────

const PROVIDER_LABELS = {
  gemini: '✨ Google Gemini',
  openai: '🤖 OpenAI GPT',
  claude: '🧠 Anthropic Claude',
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
      headers: { 'X-TRE-Token': token },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error('bad response')

    document.getElementById('ai-provider-badge').textContent =
      PROVIDER_LABELS[data.provider] || data.provider
    document.getElementById('ai-model-badge').textContent = data.model || '—'

    loading.style.display = 'none'
    info.style.display    = 'block'
  } catch {
    loading.style.display = 'none'
    error.style.display   = 'block'
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init () {
  chrome.storage.local.get(['treToken', 'treTargetLang'], (data) => {
    if (data.treToken)      $('token').value = data.treToken
    if (data.treTargetLang) $('target-lang').value = data.treTargetLang

    if (data.treToken) {
      loadAiConfig(data.treToken)
    } else {
      // No token yet — show "not connected" state
      document.getElementById('ai-config-loading').style.display = 'none'
      document.getElementById('ai-config-error').style.display = 'block'
    }
  })
}

init()
