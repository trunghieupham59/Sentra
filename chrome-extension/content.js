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
      <span class="tre-tooltip-label">T.R.E Assistant</span>
      <select class="tre-lang-select" title="Target language">
        <option value="en">🇺🇸 EN</option>
        <option value="vi">🇻🇳 VI</option>
        <option value="ja">🇯🇵 JA</option>
        <option value="zh">🇨🇳 ZH</option>
        <option value="ko">🇰🇷 KO</option>
        <option value="fr">🇫🇷 FR</option>
        <option value="de">🇩🇪 DE</option>
        <option value="es">🇪🇸 ES</option>
        <option value="th">🇹🇭 TH</option>
        <option value="ru">🇷🇺 RU</option>
      </select>
      <button class="tre-close-btn" title="Close">✕</button>
    </div>
    <div class="tre-tooltip-body">
      <div class="tre-panel tre-source-panel">
        <div class="tre-panel-label">Original</div>
        <div class="tre-source-text"></div>
      </div>
      <div class="tre-panel-divider"></div>
      <div class="tre-panel tre-result-panel">
        <div class="tre-panel-label">Translation</div>
        <div class="tre-tooltip-text"></div>
      </div>
    </div>
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
  const langSelect = tooltip.querySelector('.tre-lang-select')
  const closeBtn = tooltip.querySelector('.tre-close-btn')

  // ── State ─────────────────────────────────────────────────────────────────

  let lastSelection = ''
  let lastSelectionRect = null   // saved rect for tooltip positioning
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
        chrome.storage.local.get(['treToken', 'treTargetLang'], (data) => {
          resolve({
            token: data.treToken || '',
            targetLang: data.treTargetLang || 'en',
          })
        })
      } catch {
        reject(new Error('Extension context invalidated. Please reload the page.'))
      }
    })
  }

  /** Fetch active provider/model from the native app — always mirrors app's current selection */
  async function getAppConfig (token) {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/config`, {
      headers: { 'X-TRE-Token': token },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error('Could not fetch app config')
    return { provider: data.provider, model: data.model }
  }

  async function translateText (text, settings) {
    const appConfig = await getAppConfig(settings.token)
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TRE-Token': settings.token,
      },
      body: JSON.stringify({
        text,
        targetLang: settings.targetLang,
        provider: appConfig.provider,
        model: appConfig.model,
      }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error(data.error || 'Translation failed')
    return data.translatedText
  }

  function positionElement (el, rect) {
    const margin = 8
    // position:fixed → coords are relative to viewport (same as getBoundingClientRect)
    // Do NOT add window.scrollY
    let top = rect.top - el.offsetHeight - margin
    let left = rect.left + rect.width / 2 - el.offsetWidth / 2

    // Keep on screen
    if (top < margin) top = rect.bottom + margin
    if (left < margin) left = margin
    if (left + el.offsetWidth > window.innerWidth - margin) {
      left = window.innerWidth - el.offsetWidth - margin
    }

    el.style.top = `${top}px`
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
    lastSelectionRect = rect   // save for use in button click handler
    resetBtnIcon()
    btn.style.display = 'flex'
    // position:fixed → rect.bottom is already viewport-relative; no scrollY needed
    btn.style.top = `${rect.bottom + 6}px`
    btn.style.left = `${rect.left + rect.width / 2 - 18}px`
  }

  function hideButton () {
    btn.style.display = 'none'
    resetBtnIcon()
  }

  function showTooltip (text, rect, range, targetLang) {
    currentTranslation = text
    savedRange = range || null

    // Sync language selector to current target language
    if (targetLang && langSelect.value !== targetLang) {
      langSelect.value = targetLang
    }

    // Left panel: original / source text
    tooltip.querySelector('.tre-source-text').textContent = lastSelection

    // Right panel: translation result
    tooltip.querySelector('.tre-tooltip-text').textContent = text

    tooltip.style.display = 'block'
    copyBtn.textContent = '📋 Copy'
    // Force reflow so offsetWidth is available
    tooltip.getBoundingClientRect()
    positionElement(tooltip, rect)
  }

  function hideTooltip () {
    tooltip.style.display = 'none'
  }

  // ── Close button ───────────────────────────────────────────────────────────

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    hideTooltip()
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
  })

  // ── Language selector → re-translate ──────────────────────────────────────

  langSelect.addEventListener('change', async (e) => {
    e.stopPropagation()
    const newLang = langSelect.value

    // Persist the new language choice so Options page & future sessions reflect it
    if (isContextValid()) {
      try { chrome.storage.local.set({ treTargetLang: newLang }) } catch { /* ignore */ }
    }

    if (!lastSelection) return

    const tooltipText = tooltip.querySelector('.tre-tooltip-text')
    tooltipText.textContent = '⏳ Translating…'

    try {
      const settings = await getSettings()
      settings.targetLang = newLang          // use the just-selected language
      const translated = await translateText(lastSelection, settings)
      currentTranslation = translated
      tooltipText.textContent = translated
      copyBtn.textContent = '📋 Copy'
      try { await navigator.clipboard.writeText(translated) } catch { /* ignore */ }
    } catch (err) {
      tooltipText.textContent = '❌ ' + (err.message || 'Translation failed')
    }
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

  // ── Selection listener — mouse ─────────────────────────────────────────────

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

  // ── Selection listener — keyboard (Cmd+A / Ctrl+A / Shift+Arrow etc.) ──────

  function checkKeyboardSelection () {
    const activeEl = document.activeElement
    const tag = activeEl?.tagName?.toLowerCase()

    // input/textarea: window.getSelection() doesn't work — use selectionStart/End
    if ((tag === 'input' || tag === 'textarea') && typeof activeEl.selectionStart === 'number') {
      const start = activeEl.selectionStart
      const end = activeEl.selectionEnd
      if (end > start) {
        const text = activeEl.value.substring(start, end).trim()
        if (text.length > 1) {
          lastSelection = text
          // Position button near the bottom of the input element
          const rect = activeEl.getBoundingClientRect()
          showButton(rect)
          hideTooltip()
          return
        }
      }
      hideButton()
      return
    }

    // Normal DOM selection (page text, contenteditable, etc.)
    const sel = window.getSelection()
    const text = sel ? sel.toString().trim() : ''

    if (text.length > 1) {
      lastSelection = text
      let rect = null
      try {
        if (sel.rangeCount > 0) rect = sel.getRangeAt(0).getBoundingClientRect()
      } catch { /* ignore */ }

      // Fallback if rect is empty (e.g., Ctrl+A on whole page)
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        rect = { top: 80, bottom: 100, left: window.innerWidth / 2, width: 0 }
      }

      showButton(rect)
      hideTooltip()
    } else {
      hideButton()
    }
  }

  document.addEventListener('keyup', (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase()
    const isSelectAll = (e.metaKey || e.ctrlKey) && e.key === 'a'
    const isShiftSelection = e.shiftKey && (
      e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
      e.key === 'Home' || e.key === 'End' ||
      e.key === 'PageUp' || e.key === 'PageDown'
    )

    // For input/textarea: only show button on Cmd+A (select-all), not Shift+Arrow
    // (Shift+Arrow in inputs is normal editing — don't interrupt that)
    if (tag === 'input' || tag === 'textarea') {
      if (isSelectAll) setTimeout(checkKeyboardSelection, 50)
      return
    }

    // Outside inputs: trigger on Cmd+A or Shift+Arrow-based selections
    if (isSelectAll || isShiftSelection) {
      setTimeout(checkKeyboardSelection, 50)
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideButton()
      hideTooltip()
      return
    }

    // CMD+A (macOS) / CTRL+A (Windows/Linux) — must be caught on keydown because
    // macOS does NOT fire keyup for CMD+key shortcuts (OS intercepts them).
    const isSelectAll = (e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')
    if (isSelectAll) {
      // Wait a tick for the browser to apply the full-page selection
      setTimeout(checkKeyboardSelection, 100)
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

      // Determine rect for tooltip positioning:
      // - For DOM selections (page text): use getSelection range
      // - For input/textarea (Cmd+A): use lastSelectionRect saved when button was shown
      const sel = window.getSelection()
      let rect = lastSelectionRect || { top: 100, bottom: 120, left: 100, width: 100 }
      let range = null
      if (sel && sel.rangeCount > 0) {
        range = sel.getRangeAt(0).cloneRange()
        const selRect = range.getBoundingClientRect()
        if (selRect && selRect.width > 0) rect = selRect
      }

      const translated = await translateText(text, settings)
      hideButton()
      showTooltip(translated, rect, range, settings.targetLang)

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
