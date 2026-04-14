/**
 * Lotus Translate — Content Script
 *
 * Injects a small floating "Translate" button whenever the user selects text.
 * Clicking the button calls the Lotus local API (localhost:39875) to translate
 * and shows the result in a tooltip above the selection.
 */

;(() => {
  const PORT = 39875

  // ── DOM setup ──────────────────────────────────────────────────────────────

  const btn = document.createElement('button')
  btn.id = 'lotus-assistant-btn'
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 8l6 6 6-6"/>
    </svg>
    Lotus Translate
  `
  document.documentElement.appendChild(btn)

  const tooltip = document.createElement('div')
  tooltip.id = 'lotus-result-tooltip'
  tooltip.innerHTML = `
    <div class="lotus-tooltip-label">Translation</div>
    <div class="lotus-tooltip-text"></div>
  `
  document.documentElement.appendChild(tooltip)

  // ── State ─────────────────────────────────────────────────────────────────

  let lastSelection = ''
  let tooltipHideTimer = null

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getSettings () {
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

  async function translateText (text, settings) {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lotus-Token': settings.token,
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
    const margin = 6
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

  function showButton (rect) {
    btn.style.display = 'flex'
    btn.style.top = `${rect.bottom + 6}px`
    btn.style.left = `${rect.left + rect.width / 2 - 60}px`
  }

  function hideButton () {
    btn.style.display = 'none'
    btn.classList.remove('lotus-loading')
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 8l6 6 6-6"/>
      </svg>
      Lotus Translate
    `
  }

  function showTooltip (text, rect) {
    const tooltipText = tooltip.querySelector('.lotus-tooltip-text')
    tooltipText.textContent = text
    tooltip.style.display = 'block'
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

  // ── Selection listener ─────────────────────────────────────────────────────

  document.addEventListener('mouseup', (e) => {
    // Ignore clicks on our own elements
    if (e.target === btn || btn.contains(e.target)) return

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
    if (e.target !== btn && !btn.contains(e.target) && e.target !== tooltip && !tooltip.contains(e.target)) {
      hideButton()
    }
  })

  // ── Button click → translate ──────────────────────────────────────────────

  btn.addEventListener('click', async () => {
    const text = lastSelection
    if (!text) return

    const settings = await getSettings()
    if (!settings.token) {
      alert('Lotus Extension: Please set your connection token in the extension Options page first.')
      return
    }

    // Show loading state
    btn.classList.add('lotus-loading')
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:lotus-spin 0.8s linear infinite">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      Translating…
    `

    try {
      const sel = window.getSelection()
      let rect = { top: 100, bottom: 120, left: 100, width: 100 }
      if (sel && sel.rangeCount > 0) {
        rect = sel.getRangeAt(0).getBoundingClientRect()
      }

      const translated = await translateText(text, settings)
      hideButton()
      showTooltip(translated, rect)

      // Also copy to clipboard
      try { await navigator.clipboard.writeText(translated) } catch { /* ignore */ }
    } catch (err) {
      hideButton()
      const errMsg = err.message || 'Unknown error'
      if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
        alert('Lotus Extension: Token is invalid. Please update it in the Options page.')
      } else if (errMsg.includes('fetch') || errMsg.includes('Failed to fetch')) {
        alert('Lotus Extension: Cannot connect to Lotus app. Make sure the Lotus app is running.')
      } else {
        alert(`Lotus Extension: ${errMsg}`)
      }
    }
  })

  // Inject spin keyframe for the loading icon
  const style = document.createElement('style')
  style.textContent = `@keyframes lotus-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`
  document.head.appendChild(style)
})()
