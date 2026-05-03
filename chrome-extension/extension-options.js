/**
 * Shared option metadata for all Chrome Extension entrypoints.
 * Loaded as a plain script before popup/options/content code.
 */
;(function attachExtensionOptions (root) {
  const TARGET_LANGUAGES = Object.freeze([
    ['en', 'English'],
    ['vi', 'Vietnamese'],
    ['ja', 'Japanese'],
    ['zh', 'Chinese'],
    ['zh-TW', 'Chinese (Traditional)'],
    ['ko', 'Korean'],
    ['fr', 'French'],
    ['de', 'German'],
    ['es', 'Spanish'],
    ['pt', 'Portuguese'],
    ['ru', 'Russian'],
    ['ar', 'Arabic'],
    ['th', 'Thai'],
    ['id', 'Indonesian'],
    ['it', 'Italian'],
    ['nl', 'Dutch'],
    ['tr', 'Turkish'],
    ['hi', 'Hindi'],
  ])

  const TRANSLATION_STYLES = Object.freeze([
    ['general', 'General'],
    ['formal', 'Formal'],
    ['casual', 'Casual'],
    ['business', 'Business'],
    ['technical', 'Technical'],
    ['natural', 'Natural'],
  ])

  function populateSelect (select, options, labelOverrides = {}) {
    if (!select) return
    const previousValue = select.value
    select.textContent = ''
    for (const [value, label] of options) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = labelOverrides[value] || label
      select.appendChild(option)
    }
    if (previousValue && options.some(([value]) => value === previousValue)) {
      select.value = previousValue
    }
  }

  function populateTargetLanguageSelect (select, labelOverrides) {
    populateSelect(select, TARGET_LANGUAGES, labelOverrides)
  }

  function populateTranslationStyleSelect (select) {
    populateSelect(select, TRANSLATION_STYLES)
  }

  function populateDocumentSelects (doc = document, options = {}) {
    populateTargetLanguageSelect(doc.getElementById('target-lang'), options.targetLabelOverrides)
    populateTranslationStyleSelect(doc.getElementById('translation-style'))
  }

  root.ViezanExtensionOptions = {
    TARGET_LANGUAGES,
    TRANSLATION_STYLES,
    populateSelect,
    populateTargetLanguageSelect,
    populateTranslationStyleSelect,
    populateDocumentSelects,
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
