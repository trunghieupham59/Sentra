const PORT = 39875

const $ = (id) => document.getElementById(id)

// ── Load saved settings ───────────────────────────────────────────────────────

function loadSettings () {
  chrome.storage.local.get(['lotusToken', 'lotusTargetLang', 'lotusProvider', 'lotusModel'], (data) => {
    if (data.lotusToken)     $('token').value = data.lotusToken
    if (data.lotusTargetLang) $('target-lang').value = data.lotusTargetLang
    if (data.lotusProvider)  $('provider').value = data.lotusProvider
    if (data.lotusModel)     $('model').value = data.lotusModel
  })
}

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
  const provider = $('provider').value
  const model = $('model').value

  if (!token) {
    showStatus('❌ Please enter a Connection Token.', 'error')
    return
  }

  chrome.storage.local.set({
    lotusToken: token,
    lotusTargetLang: targetLang,
    lotusProvider: provider,
    lotusModel: model,
  }, () => {
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
      headers: { 'X-Lotus-Token': token },
    })

    if (resp.status === 401) {
      showStatus('❌ Token is invalid. Copy it again from the Lotus app.', 'error')
      return
    }
    if (!resp.ok) {
      showStatus(`❌ Server responded with HTTP ${resp.status}`, 'error')
      return
    }

    const data = await resp.json()
    if (data.success) {
      showStatus(`✓ Connected to Lotus ${data.appName || ''} v${data.version || '?'}`, 'success')
    } else {
      showStatus('❌ Unexpected response from Lotus app.', 'error')
    }
  } catch (err) {
    if (err.message.includes('fetch') || err.message.includes('Failed')) {
      showStatus('❌ Cannot reach Lotus app. Make sure the Lotus app is running.', 'error')
    } else {
      showStatus(`❌ ${err.message}`, 'error')
    }
  }
})

// ── Init ──────────────────────────────────────────────────────────────────────

loadSettings()
