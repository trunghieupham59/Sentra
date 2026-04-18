/**
 * T.R.E Assistant — Content Script
 *
 * Injects a small floating icon button whenever the user selects text.
 * Clicking the button calls the T.R.E Assistant local API (localhost:39875) to translate
 * and shows the result in a tooltip above the selection.
 */

;(() => {
  // ── Extension context guard ────────────────────────────────────────────────
  // Content scripts access the real DOM through Chrome's proxy layer.
  // If the extension context is invalidated, even basic DOM operations throw.
  // Check synchronously BEFORE doing anything.
  try {
    if (!chrome.runtime?.id) return
  } catch {
    return
  }

  const PORT = 39875
  const ICON_URL = chrome.runtime.getURL('icons/icon48.png')

  // ── DOM setup ──────────────────────────────────────────────────────────────

  const root = document.body || document.documentElement

  // Build btn (avoid putting chrome-extension:// URL in innerHTML)
  const btn = document.createElement('button')
  btn.id = 'tre-assistant-btn'
  btn.title = 'T.R.E Assistant Translate'
  const btnImg = document.createElement('img')
  btnImg.src = ICON_URL
  btnImg.alt = 'T.R.E Assistant'
  btn.appendChild(btnImg)

  // Build tooltip (avoid putting chrome-extension:// URL in innerHTML)
  const tooltip = document.createElement('div')
  tooltip.id = 'tre-result-tooltip'
  tooltip.innerHTML = `
    <div class="tre-tooltip-header">
      <img class="tre-tooltip-logo" alt="T.R.E Assistant" />
      <span class="tre-tooltip-label">Translation</span>
    </div>
    <div class="tre-tooltip-text"></div>
    <div class="tre-tooltip-actions">
      <button class="tre-action-btn tre-copy-btn">📋 Copy</button>
      <button class="tre-action-btn tre-replace-btn">↵ Replace</button>
    </div>
  `
  // Set logo src separately after innerHTML is parsed (avoids chrome-extension:// in innerHTML)
  tooltip.querySelector('.tre-tooltip-logo').src = ICON_URL

  try {
    root.appendChild(btn)
    root.appendChild(tooltip)
  } catch {
    return // Failed to inject UI elements, bail out
  }

  const copyBtn = tooltip.querySelector('.tre-copy-btn')
  const replaceBtn = tooltip.querySelector('.tre-replace-btn')

  // ── State ─────────────────────────────────────────────────────────────────

  let lastSelection = ''
  let tooltipHideTimer = null
  let savedRange = null
  let currentTranslation = ''

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isContextValid () {
    try { return !!chrome.runtime?.id } catch { return false }
  }

  function getSettings () {
    return new Promise((resolve, reject) => {
      if (!isContextValid()) { reject(new Error('Extension context invalidated. Please reload the page.')); return }
      try {
        chrome.storage.local.get(['treToken', 'treTargetLang', 'treProvider', 'treModel'], (data) => {
          resolve({
            token: data.treToken || '',
            targetLang: data.treTargetLang || 'en',
            provider: data.treProvider || 'gemini',
            model: data.treModel || 'gemini-2.0-flash',
          })
        })
      } catch {
        reject(new Error('Extension context invalidated. Please reload the page.'))
      }
    })
  }

  async function translateText (text, settings) {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TRE-Token': settings.token,
      },
      body: JSON.stringify({
        text,
        targetLang: settings.targetLang,
        provider: settings.provider,
        model: settings.model,
      }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error(data.error || 'Translation failed')
    return data.translatedText
  }

  function positionElement (el, rect) {
    const margin = 8
    let top = rect.top - el.offsetHeight - margin
    let left = rect.left + rect.width / 2 - el.offsetWidth / 2

    // Keep on screen
    if (top < margin) top = rect.bottom + margin
    if (left < margin) left = margin
    if (left + el.offsetWidth > window.innerWidth - margin) {
      left = window.innerWidth - el.offsetWidth - margin
    }

    el.style.top = `${top + window.scrollY}px`
    el.style.left = `${left}px`
  }

  function resetBtnIcon () {
    btn.classList.remove('tre-loading')
    btn.innerHTML = ''
    const img = document.createElement('img')
    img.src = ICON_URL
    img.alt = 'T.R.E Assistant'
    btn.appendChild(img)
  }

  function showButton (rect) {
    resetBtnIcon()
    btn.style.display = 'flex'
    btn.style.top = `${rect.bottom + window.scrollY + 6}px`
    btn.style.left = `${rect.left + rect.width / 2 - 18}px`
  }

  function hideButton () {
    btn.style.display = 'none'
    resetBtnIcon()
  }

  function showTooltip (text, rect, range) {
    currentTranslation = text
    savedRange = range || null

    const tooltipText = tooltip.querySelector('.tre-tooltip-text')
    tooltipText.textContent = text
    tooltip.style.display = 'block'
    copyBtn.textContent = '📋 Copy'
    // Force reflow so offsetWidth is available
    tooltip.getBoundingClientRect()
    positionElement(tooltip, rect)

    clearTimeout(tooltipHideTimer)
    tooltipHideTimer = setTimeout(() => {
      tooltip.style.display = 'none'
    }, 6000)
  }

  function hideTooltip () {
    tooltip.style.display = 'none'
    clearTimeout(tooltipHideTimer)
  }

  // ── Tooltip hover: pause auto-hide ─────────────────────────────────────────

  tooltip.addEventListener('mouseenter', () => {
    clearTimeout(tooltipHideTimer)
  })

  tooltip.addEventListener('mouseleave', () => {
    clearTimeout(tooltipHideTimer)
    tooltipHideTimer = setTimeout(() => {
      tooltip.style.display = 'none'
    }, 2000)
  })

  // ── Copy button ────────────────────────────────────────────────────────────

  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(currentTranslation)
      copyBtn.textContent = '✓ Copied!'
      setTimeout(() => { copyBtn.textContent = '📋 Copy' }, 1500)
    } catch {
      copyBtn.textContent = '❌ Failed'
      setTimeout(() => { copyBtn.textContent = '📋 Copy' }, 1500)
    }
    clearTimeout(tooltipHideTimer)
    tooltipHideTimer = setTimeout(() => {
      tooltip.style.display = 'none'
    }, 3000)
  })

  // ── Replace button ─────────────────────────────────────────────────────────

  replaceBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (savedRange && currentTranslation) {
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(savedRange)
        const inserted = document.execCommand('insertText', false, currentTranslation)
        if (!inserted) {
          navigator.clipboard.writeText(currentTranslation).catch(() => {})
        }
      }
    }
    hideTooltip()
  })

  // ── Selection listener ─────────────────────────────────────────────────────

  document.addEventListener('mouseup', (e) => {
    if (e.target === btn || btn.contains(e.target)) return
    if (e.target === tooltip || tooltip.contains(e.target)) return

    setTimeout(() => {
      const sel = window.getSelection()
      const text = sel ? sel.toString().trim() : ''

      if (text.length > 1) {
        lastSelection = text
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        showButton(rect)
        hideTooltip()
      } else {
        hideButton()
      }
    }, 10)
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideButton()
      hideTooltip()
    }
  })

  document.addEventListener('mousedown', (e) => {
    if (
      e.target !== btn && !btn.contains(e.target) &&
      e.target !== tooltip && !tooltip.contains(e.target)
    ) {
      hideButton()
      hideTooltip()
    }
  })

  // ── Button click → translate ──────────────────────────────────────────────

  btn.addEventListener('click', async () => {
    const text = lastSelection
    if (!text) return

    // Show loading spinner inside the round button
    btn.classList.add('tre-loading')
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" style="animation:tre-spin 0.8s linear infinite;width:18px;height:18px;">
        <circle cx="12" cy="12" r="9" stroke-opacity="0.2"/>
        <path d="M12 3a9 9 0 0 1 9 9" />
      </svg>
    `

    try {
      const settings = await getSettings()
      if (!settings.token) {
        hideButton()
        alert('T.R.E Assistant Extension: Please set your connection token in the extension Options page first.')
        return
      }

      const sel = window.getSelection()
      let rect = { top: 100, bottom: 120, left: 100, width: 100 }
      let range = null
      if (sel && sel.rangeCount > 0) {
        range = sel.getRangeAt(0).cloneRange()
        rect = range.getBoundingClientRect()
      }

      const translated = await translateText(text, settings)
      hideButton()
      showTooltip(translated, rect, range)

      try { await navigator.clipboard.writeText(translated) } catch { /* ignore */ }
    } catch (err) {
      hideButton()
      const errMsg = err.message || 'Unknown error'
      if (errMsg.includes('context invalidated') || errMsg.includes('reload the page')) {
        alert('T.R.E Assistant Extension: Extension was updated. Please reload this page (F5) to use it again.')
      } else if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
        alert('T.R.E Assistant Extension: Token is invalid. Please update it in the Options page.')
      } else if (errMsg.includes('fetch') || errMsg.includes('Failed to fetch')) {
        alert('T.R.E Assistant Extension: Cannot connect to T.R.E Assistant app. Make sure the T.R.E Assistant app is running.')
      } else {
        alert(`T.R.E Assistant Extension: ${errMsg}`)
      }
    }
  })

  // Inject spin keyframe
  const style = document.createElement('style')
  style.textContent = `@keyframes tre-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`
  document.head.appendChild(style)
})()
