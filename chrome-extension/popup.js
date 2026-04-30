const PORT = 39875

const $ = (id) => document.getElementById(id)

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
const COPY_LABEL = 'Copy'
const REPLACE_LABEL = 'Replace'
const COPY_TITLE = isMac ? 'Copy translation (Cmd+C)' : 'Copy translation (Ctrl+C)'
const REPLACE_TITLE = isMac ? 'Replace selected text (Cmd+Enter)' : 'Replace selected text (Ctrl+Enter)'
const LISTEN_LABEL = 'Listen'

// Last translated text — used by Copy and Replace buttons
let lastTranslated = ''
let ttsAudio = null
let ttsAudioUrl = ''
let ttsLoading = false
let ttsRequestId = 0
let ttsUsingSpeech = false

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

async function fetchTtsAudio (text, lang, token) {
  const resp = await fetch(`http://127.0.0.1:${PORT}/api/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Viezan-Token': token,
    },
    body: JSON.stringify({ text, lang }),
  })
  const data = await resp.json().catch(() => null)
  if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
  if (!data.success || !data.audioBase64) throw new Error(data.error || 'TTS failed')
  return data
}

const TTS_LANG_TO_BCP47 = {
  en: 'en-US',
  vi: 'vi-VN',
  ja: 'ja-JP',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-PT',
  th: 'th-TH',
  ru: 'ru-RU',
  ar: 'ar-SA',
  id: 'id-ID',
  it: 'it-IT',
  nl: 'nl-NL',
  tr: 'tr-TR',
  hi: 'hi-IN',
}

function speakWithBrowserSpeech (text, lang) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false
  const bcp47 = TTS_LANG_TO_BCP47[lang] || 'en-US'
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = bcp47
  const voices = window.speechSynthesis.getVoices()
  const prefix = bcp47.split('-')[0]
  const local = voices.filter((voice) => voice.localService)
  utter.voice =
    local.find((voice) => voice.lang === bcp47) ||
    voices.find((voice) => voice.lang === bcp47) ||
    local.find((voice) => voice.lang.startsWith(prefix)) ||
    voices.find((voice) => voice.lang.startsWith(prefix)) ||
    null
  utter.onend = stopTtsAudio
  utter.onerror = stopTtsAudio
  ttsUsingSpeech = true
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
  $('btn-speak-result').textContent = 'Stop'
  return true
}

function base64ToBlobUrl (base64, mimeType) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' })
  return URL.createObjectURL(blob)
}

function stopTtsAudio () {
  ttsRequestId++
  if (ttsAudio) {
    try { ttsAudio.pause() } catch { /* ignore */ }
    ttsAudio = null
  }
  if (ttsUsingSpeech && window.speechSynthesis) {
    ttsUsingSpeech = false
    window.speechSynthesis.cancel()
  }
  if (ttsAudioUrl) {
    URL.revokeObjectURL(ttsAudioUrl)
    ttsAudioUrl = ''
  }
  ttsLoading = false
  $('btn-speak-result').textContent = LISTEN_LABEL
}

/** Provider metadata — full name + brand colors */
const PROVIDER_META = {
  gemini: {
    name: 'Google Gemini',
    color: '#1A73E8',
    bg: 'rgba(26,115,232,0.09)',
    border: 'rgba(26,115,232,0.22)',
  },
  openai: {
    name: 'OpenAI GPT',
    color: '#10A37F',
    bg: 'rgba(16,163,127,0.09)',
    border: 'rgba(16,163,127,0.22)',
  },
  claude: {
    name: 'Anthropic Claude',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.09)',
    border: 'rgba(217,119,6,0.22)',
  },
}

function setProviderBadge (el, provider) {
  const meta = PROVIDER_META[provider]
  el.textContent = ''
  el.className = 'meta-badge ctrl-badge-provider'
  el.style.background = meta?.bg || ''
  el.style.borderColor = meta?.border || ''
  el.style.color = meta?.color || ''

  if (meta) {
    const mark = document.createElement('span')
    mark.className = 'provider-mark'
    mark.style.background = meta.color
    el.append(mark, document.createTextNode(meta.name))
    return
  }

  el.textContent = provider || '-'
}

/** Update header status badge + controls bar provider/model badges */
async function loadAppInfo (token) {
  const dot   = $('status-dot')
  const label = $('status-label')
  const providerEl = $('ctrl-provider')
  const modelEl    = $('ctrl-model')

  // Loading state
  dot.className = 'status-dot loading'
  label.textContent = 'Connecting...'

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
    setProviderBadge(providerEl, data.provider)

    // Controls bar: model badge
    modelEl.className = 'meta-badge ctrl-badge-model'
    modelEl.textContent = data.model || '-'
    modelEl.removeAttribute('style')
  } catch {
    dot.className = 'status-dot error'
    label.textContent = 'App not running'
    providerEl.className = 'meta-badge ctrl-badge-loading'
    providerEl.textContent = 'Provider unavailable'
    modelEl.className = 'meta-badge ctrl-badge-model ctrl-badge-loading'
    modelEl.textContent = 'Model unavailable'
  }
}

/** Show translation result and reveal Copy/Replace buttons */
function showResult (text) {
  stopTtsAudio()
  lastTranslated = text
  const resultEl = $('result-text')
  resultEl.innerHTML = ''
  resultEl.textContent = text

  // Reveal Copy + Replace buttons
  $('footer-result').style.display = 'flex'

  // Update button labels with OS-aware shortcuts
  $('btn-copy-result').textContent = COPY_LABEL
  $('btn-replace').textContent = REPLACE_LABEL
  $('btn-copy-result').title = COPY_TITLE
  $('btn-replace').title = REPLACE_TITLE
}

/** Hide Copy/Replace and reset result panel */
function clearResult () {
  stopTtsAudio()
  lastTranslated = ''
  $('result-text').innerHTML = '<span class="result-placeholder">Translation appears here...</span>'
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
  showStatus('Translating...', 'loading')

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
      showStatus('Invalid API key. Update it in Options.', 'error')
    } else if (msg.includes('fetch') || msg.includes('Failed')) {
      showStatus('Cannot reach Viezan app. Is it running?', 'error')
    } else {
      showStatus(msg, 'error')
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
    $('btn-copy-result').textContent = 'Copied'
    setTimeout(() => {
      $('btn-copy-result').textContent = COPY_LABEL
    }, 1500)
  } catch {
    showStatus('Failed to copy', 'error')
  }
})

// ── Listen button ──────────────────────────────────────────────────────────

$('btn-speak-result').addEventListener('click', async () => {
  if (!lastTranslated || ttsLoading) {
    if (ttsLoading) stopTtsAudio()
    return
  }
  if (ttsAudio) {
    stopTtsAudio()
    return
  }

  try {
    const settings = await getSettings()
    if (!settings.token) throw new Error('Missing API key')
    ttsLoading = true
    const requestId = ++ttsRequestId
    $('btn-speak-result').textContent = 'Loading...'
    const lang = $('target-lang').value || settings.targetLang
    const result = await fetchTtsAudio(lastTranslated, lang, settings.token)
    if (requestId !== ttsRequestId) return
    ttsAudioUrl = base64ToBlobUrl(result.audioBase64, result.mimeType)
    ttsAudio = new Audio(ttsAudioUrl)
    ttsAudio.onended = stopTtsAudio
    ttsAudio.onerror = () => {
      stopTtsAudio()
      showStatus('Failed to play audio', 'error')
    }
    ttsLoading = false
    $('btn-speak-result').textContent = 'Stop'
    await ttsAudio.play().catch((err) => {
      stopTtsAudio()
      if (speakWithBrowserSpeech(lastTranslated, lang)) return
      throw err
    })
  } catch (err) {
    const lang = $('target-lang').value || 'en'
    stopTtsAudio()
    if (speakWithBrowserSpeech(lastTranslated, lang)) return
    const msg = err.message || 'TTS failed'
    if (msg.includes('401') || msg.includes('Unauthorized')) {
      showStatus('Invalid API key. Update it in Options.', 'error')
    } else if (msg.includes('fetch') || msg.includes('Failed')) {
      showStatus('Cannot reach Viezan app. Is it running?', 'error')
    } else {
      showStatus(msg, 'error')
    }
  }
})

// ── Replace button ──────────────────────────────────────────────────────────

$('btn-replace').addEventListener('click', async () => {
  if (!lastTranslated) return
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) {
      showStatus('No active tab found', 'error')
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
      $('btn-replace').textContent = 'Replaced'
      setTimeout(() => {
        $('btn-replace').textContent = REPLACE_LABEL
      }, 1500)
    } else {
      showStatus('No text selected on page', 'error')
    }
  } catch {
    showStatus('Cannot replace. Try selecting text first.', 'error')
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
