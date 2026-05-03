/**
 * Backward-compatible global alias for shared extension option helpers.
 * The implementation lives in local-bridge.js so content.js still works if
 * this optional companion script is not injected into an already-open tab.
 */
;(function attachExtensionOptions (root) {
  root.ViezanExtensionOptions = root.ViezanLocalBridge
})(typeof globalThis !== 'undefined' ? globalThis : window)
