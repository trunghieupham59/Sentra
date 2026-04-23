/**
 * Viezan — Content Script
 *
 * Injects a small floating icon button whenever the user selects text.
 * Clicking the button calls the Viezan local API (localhost:39875) to translate
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
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const COPY_LABEL    = isMac ? '⌘C  Copy'    : 'Ctrl+C  Copy'
  const REPLACE_LABEL = isMac ? '⌘↵  Replace' : 'Ctrl+↵  Replace'

  // ── Cleanup stale UI from a previous content script instance ──────────────
  // When the extension is reloaded/updated, background.js re-injects this
  // script into open tabs. Remove any leftover elements from the old instance
  // so we don't end up with duplicate buttons or tooltips.
  document.getElementById('Viezan-btn')?.remove()
  document.getElementById('tre-result-tooltip')?.remove()

  // ── DOM setup ──────────────────────────────────────────────────────────────

  const root = document.body || document.documentElement

  // Build btn (avoid putting chrome-extension:// URL in innerHTML)
  const btn = document.createElement('button')
  btn.id = 'Viezan-btn'
  btn.title = 'Viezan Translate'
  const btnImg = document.createElement('img')
  btnImg.src = ICON_URL
  btnImg.alt = 'Viezan'
  btn.appendChild(btnImg)

  // Build tooltip (avoid putting chrome-extension:// URL in innerHTML)
  const tooltip = document.createElement('div')
  tooltip.id = 'tre-result-tooltip'
  tooltip.innerHTML = `
    <div class="tre-tooltip-header">
      <img class="tre-tooltip-logo" alt="Viezan" />
      <span class="tre-tooltip-label">VIEZAN</span>
      <span class="tre-status-badge">
        <span class="tre-status-dot tre-status-loading"></span>
        <span class="tre-status-text">Connecting…</span>
      </span>
      <div class="tre-header-spacer"></div>
      <button class="tre-close-btn" title="Close">✕</button>
    </div>
    <div class="tre-controls-row">
      <span class="tre-ctrl-item tre-ctrl-provider">—</span>
      <span class="tre-ctrl-item tre-ctrl-model">—</span>
      <div class="tre-ctrl-divider"></div>
      <select class="tre-lang-select" title="Target language">
        <option value="en">🇺🇸 English</option>
        <option value="vi">🇻🇳 Vietnamese</option>
        <option value="ja">🇯🇵 Japanese</option>
        <option value="zh">🇨🇳 Chinese</option>
        <option value="ko">🇰🇷 Korean</option>
        <option value="fr">🇫🇷 French</option>
        <option value="de">🇩🇪 German</option>
        <option value="es">🇪🇸 Spanish</option>
        <option value="th">🇹🇭 Thai</option>
        <option value="ru">🇷🇺 Russian</option>
      </select>
      <select class="tre-style-select" title="Translation style">
        <option value="friendly">Friendly</option>
        <option value="neutral">Neutral</option>
        <option value="professional">Professional</option>
        <option value="business">Business</option>
        <option value="slack">Slack</option>
        <option value="polite">Polite</option>
        <option value="technical">Technical</option>
      </select>
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
      <!-- labels updated dynamically after isMac detection -->
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
  const styleSelect = tooltip.querySelector('.tre-style-select')
  const closeBtn = tooltip.querySelector('.tre-close-btn')

  // Apply OS-aware shortcut labels to action buttons
  copyBtn.textContent = COPY_LABEL
  replaceBtn.textContent = REPLACE_LABEL

  // ── State ─────────────────────────────────────────────────────────────────

  let lastSelection = ''
  let lastSelectionRect = null   // saved rect for tooltip positioning
  let savedRange = null          // for DOM/contenteditable selections
  let savedInputEl = null        // for textarea/input selections
  let savedInputStart = 0        // textarea selectionStart
  let savedInputEnd = 0          // textarea selectionEnd
  let currentTranslation = ''

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isContextValid () {
    try { return !!chrome.runtime?.id } catch { return false }
  }

  function getSettings () {
    return new Promise((resolve, reject) => {
      if (!isContextValid()) { reject(new Error('Extension context invalidated. Please reload the page.')); return }
      try {
        chrome.storage.local.get(['treToken', 'treTargetLang', 'treTranslationStyle'], (data) => {
          resolve({
            token: data.treToken || '',
            targetLang: data.treTargetLang || 'en',
            translationStyle: data.treTranslationStyle || 'neutral',
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
      headers: { 'X-Viezan-Token': token },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error('Could not fetch app config')
    return { provider: data.provider, model: data.model }
  }

  /** Provider metadata — SVG icon + full name + brand colors (mirrors the main app) */
  const PROVIDER_META = {
    gemini: {
      name: 'Google Gemini',
      color: '#1A73E8',
      bg: 'rgba(26,115,232,0.08)',
      border: 'rgba(26,115,232,0.2)',
      svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2C12.3 5.5 13.8 8.8 16 10.5C13.8 12.2 12.3 15.5 12 19C11.7 15.5 10.2 12.2 8 10.5C10.2 8.8 11.7 5.5 12 2Z" fill="#1A73E8"/><path d="M2 10.5C5.5 10.8 8.8 10.2 10.5 8C12.2 10.2 15.5 10.8 19 10.5C15.5 10.2 12.2 11.8 10.5 14C8.8 11.8 5.5 10.2 2 10.5Z" fill="#1A73E8" opacity="0.5"/></svg>',
    },
    openai: {
      name: 'OpenAI GPT',
      color: '#10A37F',
      bg: 'rgba(16,163,127,0.08)',
      border: 'rgba(16,163,127,0.2)',
      svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 7L15.46 9V13L12 15L8.54 13V9L12 7Z" fill="#10A37F"/><path d="M12 3.5V7M12 15V18.5M8.54 9L5.5 7.25M15.46 13L18.5 14.75M8.54 13L5.5 14.75M15.46 9L18.5 7.25" stroke="#10A37F" stroke-width="1.5" stroke-linecap="round"/></svg>',
    },
    claude: {
      name: 'Anthropic Claude',
      color: '#D97706',
      bg: 'rgba(217,119,6,0.08)',
      border: 'rgba(217,119,6,0.2)',
      svg: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5.5L18.2 20.5H15.5L14.2 17H9.8L8.5 20.5H5.8L12 5.5ZM12 9.5L10.7 13H13.3L12 9.5Z" fill="#D97706"/></svg>',
    },
  }

  /** Populate the provider/model badges and status in the controls row */
  async function updateAiInfo (token) {
    const providerEl  = tooltip.querySelector('.tre-ctrl-provider')
    const modelEl     = tooltip.querySelector('.tre-ctrl-model')
    const statusDot   = tooltip.querySelector('.tre-status-dot')
    const statusText  = tooltip.querySelector('.tre-status-text')
    if (!providerEl || !modelEl) return
    try {
      const config = await getAppConfig(token)
      const meta = PROVIDER_META[config.provider]

      // Update status → Active
      if (statusDot)  { statusDot.className = 'tre-status-dot tre-status-active' }
      if (statusText) { statusText.textContent = 'Active' }

      // Provider badge
      if (meta) {
        providerEl.innerHTML = `${meta.svg}${meta.name}`
        providerEl.style.cssText = `background:${meta.bg};border-color:${meta.border};color:${meta.color}`
      } else {
        providerEl.textContent = config.provider || '—'
        providerEl.style.cssText = ''
      }

      // Model badge
      modelEl.textContent = config.model || '—'
      modelEl.style.cssText = ''
    } catch {
      if (statusDot)  { statusDot.className = 'tre-status-dot tre-status-error' }
      if (statusText) { statusText.textContent = 'Offline' }
      if (providerEl) { providerEl.textContent = '—' }
      if (modelEl)    { modelEl.textContent = '—' }
    }
  }

  async function translateText (text, settings) {
    const appConfig = await getAppConfig(settings.token)
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viezan-Token': settings.token,
      },
      body: JSON.stringify({
        text,
        targetLang: settings.targetLang,
        provider: appConfig.provider,
        model: appConfig.model,
        translationStyle: settings.translationStyle || styleSelect.value || 'neutral',
      }),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    if (!data.success) throw new Error(data.error || 'Translation failed')
    return data.translatedText
  }

  function positionElement (el, rect) {
    const margin = 8
    const elH = el.offsetHeight
    const elW = el.offsetWidth

    // Smart vertical: prefer above selection; fall back to below; clamp if neither fits
    let top
    if (rect.top - elH - margin >= margin) {
      // Enough space above → show above
      top = rect.top - elH - margin
    } else if (rect.bottom + elH + margin <= window.innerHeight - margin) {
      // Enough space below → show below
      top = rect.bottom + margin
    } else {
      // Neither fits perfectly → place as high as possible without going off-screen
      top = Math.max(margin, window.innerHeight - elH - margin)
    }

    // Horizontal: centre on selection, clamped to viewport
    let left = rect.left + rect.width / 2 - elW / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - elW - margin))

    el.style.top = `${top}px`
    el.style.left = `${left}px`
  }

  function resetBtnIcon () {
    btn.classList.remove('tre-loading')
    btn.innerHTML = ''
    const img = document.createElement('img')
    img.src = ICON_URL
    img.alt = 'Viezan'
    btn.appendChild(img)
  }

  function showButton (rect) {
    lastSelectionRect = rect   // save for use in button click handler
    resetBtnIcon()
    btn.style.display = 'flex'

    const btnSize = 36
    const gap = 6
    const margin = 8

    // Smart vertical: prefer below selection; if too close to bottom, show above
    let top
    if (rect.bottom + gap + btnSize <= window.innerHeight - margin) {
      top = rect.bottom + gap
    } else {
      top = rect.top - gap - btnSize
    }
    // Clamp to viewport
    top = Math.max(margin, Math.min(top, window.innerHeight - btnSize - margin))

    // Horizontal: centre on selection, clamped to viewport
    let left = rect.left + rect.width / 2 - btnSize / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - btnSize - margin))

    btn.style.top = `${top}px`
    btn.style.left = `${left}px`
  }

  function hideButton () {
    btn.style.display = 'none'
    resetBtnIcon()
  }

  function showTooltip (text, rect, range, targetLang, translationStyle) {
    currentTranslation = text
    // Only update savedRange if a valid range is provided.
    // Clicking the translate button clears the browser selection, so `range`
    // from the btn click handler is often null — we must keep the range that
    // was captured earlier at selection time (mouseup / checkKeyboardSelection).
    if (range) savedRange = range

    // Sync language selector to current target language
    if (targetLang && langSelect.value !== targetLang) {
      langSelect.value = targetLang
    }

    // Sync style selector to current translation style
    if (translationStyle && styleSelect.value !== translationStyle) {
      styleSelect.value = translationStyle
    }

    // Left panel: original / source text
    tooltip.querySelector('.tre-source-text').textContent = lastSelection.replace(/\n{2,}/g, '\n')

    // Right panel: translation result
    tooltip.querySelector('.tre-tooltip-text').textContent = text.replace(/\n{2,}/g, '\n')

    tooltip.style.display = 'block'
    copyBtn.textContent = COPY_LABEL
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
      setTimeout(() => { copyBtn.textContent = COPY_LABEL }, 1500)
    } catch {
      copyBtn.textContent = '❌ Failed'
      setTimeout(() => { copyBtn.textContent = COPY_LABEL }, 1500)
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
      tooltipText.textContent = translated.replace(/\n{2,}/g, '\n')
      copyBtn.textContent = COPY_LABEL
      try { await navigator.clipboard.writeText(translated) } catch { /* ignore */ }
    } catch (err) {
      tooltipText.textContent = '❌ ' + (err.message || 'Translation failed')
    }
  })

  // ── Style selector → re-translate ─────────────────────────────────────────

  styleSelect.addEventListener('change', async (e) => {
    e.stopPropagation()
    const newStyle = styleSelect.value

    // Persist the new style choice across sessions
    if (isContextValid()) {
      try { chrome.storage.local.set({ treTranslationStyle: newStyle }) } catch { /* ignore */ }
    }

    if (!lastSelection) return

    const tooltipText = tooltip.querySelector('.tre-tooltip-text')
    tooltipText.textContent = '⏳ Translating…'

    try {
      const settings = await getSettings()
      settings.translationStyle = newStyle   // use the just-selected style
      const translated = await translateText(lastSelection, settings)
      currentTranslation = translated
      tooltipText.textContent = translated.replace(/\n{2,}/g, '\n')
      copyBtn.textContent = COPY_LABEL
      try { await navigator.clipboard.writeText(translated) } catch { /* ignore */ }
    } catch (err) {
      tooltipText.textContent = '❌ ' + (err.message || 'Translation failed')
    }
  })

  // ── Replace button ─────────────────────────────────────────────────────────

  replaceBtn.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!currentTranslation) { hideTooltip(); return }

    // ── Case 1: textarea / input ───────────────────────────────────────────
    if (savedInputEl && typeof savedInputEl.selectionStart === 'number') {
      const el = savedInputEl
      el.focus()
      el.setSelectionRange(savedInputStart, savedInputEnd)
      // Try native insertText first (preserves undo history)
      const ok = document.execCommand('insertText', false, currentTranslation)
      if (!ok) {
        // Fallback: direct value manipulation
        const before = el.value.substring(0, savedInputStart)
        const after  = el.value.substring(savedInputEnd)
        el.value = before + currentTranslation + after
        el.setSelectionRange(
          savedInputStart + currentTranslation.length,
          savedInputStart + currentTranslation.length
        )
        el.dispatchEvent(new Event('input',  { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      hideTooltip()
      return
    }

    // ── Case 2: contenteditable / DOM selection ────────────────────────────
    if (savedRange) {
      // Find the contenteditable element that owns the range
      let editableEl = null
      try {
        const node = savedRange.commonAncestorContainer
        const el   = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
        editableEl = el?.closest('[contenteditable]')
      } catch { /* ignore */ }

      // ── Strategy 1: sync copy → focus → restore selection → sync paste ────
      // KEY INSIGHT: navigator.clipboard.writeText() is async — awaiting it loses
      // the user gesture context, causing execCommand('paste') to be blocked.
      // Solution: use a hidden textarea + execCommand('copy') (synchronous!) to
      // write to clipboard, then immediately execCommand('paste') in the same
      // user gesture microtask. This fires a TRUSTED paste event that block-based
      // editors (Tiptap, ProseMirror, Notion…) handle via their own paste handlers.
      let handled = false
      try {
        // 1a. Copy translation to clipboard synchronously (no async/await needed)
        const tmp = document.createElement('textarea')
        tmp.value = currentTranslation
        tmp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
        document.body.appendChild(tmp)
        tmp.focus()
        tmp.select()
        document.execCommand('copy')
        document.body.removeChild(tmp)

        // 1b. Focus the editor and restore the original multi-block selection
        if (editableEl) editableEl.focus()
        const sel = window.getSelection()
        if (sel) {
          sel.removeAllRanges()
          sel.addRange(savedRange)
        }

        // 1c. Paste — fires a trusted paste event read by the editor's paste handler
        handled = document.execCommand('paste')
      } catch { /* ignore */ }

      // ── Strategy 2: Synthetic ClipboardEvent (for editors listening to paste) ─
      if (!handled) {
        try {
          if (editableEl) editableEl.focus()
          const sel = window.getSelection()
          if (sel) { sel.removeAllRanges(); sel.addRange(savedRange) }
          const dt = new DataTransfer()
          dt.setData('text/plain', currentTranslation)
          const pasteEvt = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt })
          const target = editableEl || document.activeElement || document.body
          target.dispatchEvent(pasteEvt)
          handled = pasteEvt.defaultPrevented
        } catch { /* ignore */ }
      }

      // ── Strategy 3: execCommand('insertText') — simple contenteditable ────
      if (!handled) {
        if (editableEl) editableEl.focus()
        const sel = window.getSelection()
        if (sel) { sel.removeAllRanges(); sel.addRange(savedRange) }
        document.execCommand('insertText', false, currentTranslation)
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
        savedInputEl = null  // this is a DOM selection, not textarea
        // Save range NOW while selection is still alive (before btn click clears it)
        try { savedRange = sel.getRangeAt(0).cloneRange() } catch { savedRange = null }
        const rect = savedRange ? savedRange.getBoundingClientRect() : { top: 80, bottom: 100, left: window.innerWidth / 2, width: 0 }
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
          // Save textarea reference + selection bounds for Replace
          savedInputEl    = activeEl
          savedInputStart = start
          savedInputEnd   = end
          savedRange      = null  // not applicable for textarea
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
    savedInputEl = null  // reset textarea state — this is a DOM selection
    const sel = window.getSelection()
    const text = sel ? sel.toString().trim() : ''

    if (text.length > 1) {
      lastSelection = text
      let rect = null
      try {
        if (sel.rangeCount > 0) {
          // Save range NOW while selection is alive (keyboard selection is still active)
          savedRange = sel.getRangeAt(0).cloneRange()
          rect = savedRange.getBoundingClientRect()
        }
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

    // ── Tooltip keyboard shortcuts (only when tooltip is visible) ─────────
    if (tooltip.style.display !== 'none') {
      const mod = e.metaKey || e.ctrlKey
      // Cmd/Ctrl+C → Copy translation
      if (mod && e.key === 'c') {
        e.preventDefault()
        copyBtn.click()
      }
      // Cmd/Ctrl+Enter → Replace
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        replaceBtn.click()
      }
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
        alert('Viezan Extension: Please set your connection token in the extension Options page first.')
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
      showTooltip(translated, rect, range, settings.targetLang, settings.translationStyle)
      // Update provider/model info in header (non-blocking)
      updateAiInfo(settings.token)

      try { await navigator.clipboard.writeText(translated) } catch { /* ignore */ }
    } catch (err) {
      hideButton()
      const errMsg = err.message || 'Unknown error'
      if (errMsg.includes('context invalidated') || errMsg.includes('reload the page')) {
        alert('Viezan Extension: Extension was updated. Please reload this page (F5) to use it again.')
      } else if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
        alert('Viezan Extension: Token is invalid. Please update it in the Options page.')
      } else if (errMsg.includes('fetch') || errMsg.includes('Failed to fetch')) {
        alert('Viezan Extension: Cannot connect to Viezan app. Make sure the Viezan app is running.')
      } else {
        alert(`Viezan Extension: ${errMsg}`)
      }
    }
  })

  // ── Ping handler (used by background to check if this script is alive) ────────
  // background.js sends VIEZAN_PING periodically; if we respond, it knows the context
  // is valid and skips re-injection. No response = dead context = re-inject.

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'VIEZAN_PING') {
      sendResponse({ alive: true })
      return true
    }

    // ── Keyboard shortcut: translate currently selected text ───────────────
    if (msg.type === 'VIEZAN_TRANSLATE_SHORTCUT') {
      const activeEl = document.activeElement
      const tag = activeEl?.tagName?.toLowerCase()

      // Case 1: textarea / input selection
      if ((tag === 'input' || tag === 'textarea') && typeof activeEl.selectionStart === 'number') {
        const start = activeEl.selectionStart
        const end = activeEl.selectionEnd
        if (end > start) {
          const text = activeEl.value.substring(start, end).trim()
          if (text.length > 1) {
            lastSelection = text
            savedInputEl    = activeEl
            savedInputStart = start
            savedInputEnd   = end
            savedRange      = null
            const rect = activeEl.getBoundingClientRect()
            showButton(rect)
            setTimeout(() => btn.click(), 50)
            sendResponse({ ok: true })
            return true
          }
        }
      }

      // Case 2: DOM / contenteditable selection
      const sel = window.getSelection()
      const text = sel ? sel.toString().trim() : ''
      if (text.length > 1) {
        lastSelection = text
        savedInputEl = null
        try { savedRange = sel.getRangeAt(0).cloneRange() } catch { savedRange = null }
        const rect = savedRange ? savedRange.getBoundingClientRect() : { top: 100, bottom: 120, left: window.innerWidth / 2, width: 0 }
        showButton(rect)
        setTimeout(() => btn.click(), 50)
      } else if (btn.style.display !== 'none') {
        // Floating button already visible from a prior selection — just trigger it
        btn.click()
      }

      sendResponse({ ok: true })
      return true
    }
  })

  // Inject spin keyframe
  const style = document.createElement('style')
  style.textContent = `@keyframes tre-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`
  document.head.appendChild(style)
})()
