/**
 * Legacy Assistant — inject a floating Viezan icon into any browser tab
 * WITHOUT requiring a browser extension to be installed.
 *
 * Two modes:
 *  1. Auto-inject (macOS): uses osascript to inject JS into the frontmost
 *     browser tab every few seconds. Works with Chrome, Arc, Brave, Edge,
 *     Safari, and any Chromium-based browser on macOS.
 *
 *  2. Bookmarklet: the Settings page provides a bookmarklet URL the user
 *     can drag to their bookmarks bar — clicking it injects the assistant
 *     on demand in any browser on any OS.
 *
 * The injected floating assistant:
 *  • Shows a small Viezan icon in the bottom-right corner
 *  • When text is selected, hovering the icon shows a "Translate" button
 *  • Clicking it calls localhost:39875/api/translate (our local server)
 *  • Shows the result in a tooltip; also copies it to clipboard
 *  • 127.0.0.1 is exempt from mixed-content restrictions in modern browsers,
 *    so this works on both HTTP and HTTPS pages.
 */
import { exec, execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from 'electron'

// These are imported lazily to avoid circular deps — call the getters below.
let _getToken: () => string = () => ''
let _getPort: () => number = () => 39875

export function setLocalServerAccessors (getToken: () => string, getPort: () => number) {
  _getToken = getToken
  _getPort = getPort
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LegacyAssistantSettings {
  enabled: boolean       // auto-inject via osascript
  targetLang: string     // default translate-to language
}

// ── Persistence ───────────────────────────────────────────────────────────────

const SETTINGS_FILE = 'legacy-assistant-settings.json'
const DEFAULT: LegacyAssistantSettings = { enabled: false, targetLang: 'en' }

let currentSettings: LegacyAssistantSettings = { ...DEFAULT }

function getSettingsPath () {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

function loadSettings (): LegacyAssistantSettings {
  try {
    const p = getSettingsPath()
    if (fs.existsSync(p)) return { ...DEFAULT, ...JSON.parse(fs.readFileSync(p, 'utf-8')) }
  } catch { /* ignore */ }
  return { ...DEFAULT }
}

function saveSettings (s: LegacyAssistantSettings) {
  try { fs.writeFileSync(getSettingsPath(), JSON.stringify(s, null, 2), 'utf-8') } catch { /* ignore */ }
}

// ── Supported browsers (macOS app names) ──────────────────────────────────────

const CHROME_LIKE = [
  'Google Chrome', 'Google Chrome Canary',
  'Brave Browser', 'Microsoft Edge', 'Microsoft Edge Canary',
  'Arc', 'Opera', 'Opera GX', 'Vivaldi', 'Chromium',
  'Naver Whale',
]
const SAFARI_APPS = ['Safari', 'Safari Technology Preview']

// ── The inline floating-assistant script ──────────────────────────────────────
// This is injected directly into the page (no external fetch needed).
// Kept small and self-contained on purpose.

function buildAssistantScript (token: string, port: number, targetLang: string): string {
  return `(function(){
if(window.__viezanLA)return;window.__viezanLA=true;
var TK='${token}',PT=${port},TL='${targetLang}';
// --- button ---
var b=document.createElement('div');
b.id='__viezanLA_btn';
b.style.cssText='position:fixed;bottom:20px;right:20px;z-index:2147483647;width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);box-shadow:0 3px 14px rgba(79,70,229,.55);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s,opacity .15s;opacity:.85;user-select:none;';
b.innerHTML='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
b.addEventListener('mouseover',function(){b.style.transform='scale(1.08)';b.style.opacity='1';});
b.addEventListener('mouseout',function(){b.style.transform='';b.style.opacity='.85';});
document.body.appendChild(b);
// --- tooltip ---
var t=document.createElement('div');
t.id='__viezanLA_tip';
t.style.cssText='position:fixed;bottom:74px;right:20px;z-index:2147483647;max-width:300px;min-width:160px;background:#1e1b4b;color:#e0e7ff;padding:10px 13px;border-radius:10px;font:13px/1.5 -apple-system,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.4);display:none;word-break:break-word;';
document.body.appendChild(t);
var timer;
var MSG={noText:'Select text on the page first.',translating:'<span style="opacity:.6;font-size:11px">Translating\u2026</span>',header:'<span style="opacity:.55;font-size:10px;display:block;margin-bottom:3px">Viezan TRANSLATION</span>',failed:'Translation failed',offline:'Cannot reach Viezan app. Make sure it is running.'};
function show(msg,dur){t.innerHTML=msg;t.style.display='block';clearTimeout(timer);if(dur)timer=setTimeout(function(){t.style.display='none';},dur);}
// --- click ---
b.addEventListener('click',function(){
  var sel=window.getSelection(),txt=sel?sel.toString().trim():'';
  if(!txt){show(MSG.noText,3000);return;}
  show(MSG.translating,0);
  fetch('http://127.0.0.1:'+PT+'/api/translate',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-Viezan-Token':TK},
    body:JSON.stringify({text:txt,targetLang:TL})
  }).then(function(r){return r.json();}).then(function(d){
    if(d.success){
      show(MSG.header+d.translatedText,9000);
      try{navigator.clipboard.writeText(d.translatedText);}catch(e){}
    } else {
      show('Error: '+(d.error||MSG.failed),5000);
    }
  }).catch(function(){show(MSG.offline,5000);});
});
document.addEventListener('mousedown',function(e){
  if(e.target!==b&&e.target!==t&&!t.contains(e.target))t.style.display='none';
});
})();`
}

// ── osascript injection ───────────────────────────────────────────────────────

function escapeForAppleScript (js: string): string {
  // Minify whitespace, then escape for embedding inside a double-quoted AS string
  return js
    .replace(/\s+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}

function injectIntoChromeLike (appName: string, js: string): void {
  const escaped = escapeForAppleScript(js)
  exec(
    `osascript -e 'tell application "${appName}" to execute front window\\'s active tab javascript "${escaped}"'`,
    { timeout: 3000 },
    (_err) => { /* silently ignore */ }
  )
}

function injectIntoSafari (js: string): void {
  const escaped = escapeForAppleScript(js)
  exec(
    `osascript -e 'tell application "Safari" to do JavaScript "${escaped}" in current tab of front window'`,
    { timeout: 3000 },
    (_err) => { /* silently ignore */ }
  )
}

function getFrontmostApp (): string {
  try {
    return execSync(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
      { timeout: 1500, stdio: 'pipe' }
    ).toString().trim()
  } catch {
    return ''
  }
}

function tryInject (): void {
  if (!currentSettings.enabled) return
  if (process.platform !== 'darwin') return

  const token = _getToken()
  const port  = _getPort()
  if (!token) return

  const frontApp = getFrontmostApp()
  if (!frontApp) return

  const script = buildAssistantScript(token, port, currentSettings.targetLang)

  if (CHROME_LIKE.includes(frontApp)) {
    injectIntoChromeLike(frontApp, script)
  } else if (SAFARI_APPS.includes(frontApp)) {
    injectIntoSafari(script)
  }
}

// ── Bookmarklet builder ───────────────────────────────────────────────────────
// The bookmarklet embeds the FULL script inline so it works on any browser / OS
// without requiring the Viezan app to actively inject it.

export function buildBookmarklet (token: string, port: number, targetLang: string): string {
  const script = buildAssistantScript(token, port, targetLang)
  const minified = script.replace(/\s+/g, ' ').trim()
  return `javascript:${encodeURIComponent(minified)}`
}

// ── Injection loop ────────────────────────────────────────────────────────────

let timer: NodeJS.Timeout | null = null

function startLoop () {
  if (timer) return
  // First injection almost immediately, then every 2.5 s
  timer = setInterval(tryInject, 2500)
  setTimeout(tryInject, 400)
}

function stopLoop () {
  if (timer) { clearInterval(timer); timer = null }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initLegacyAssistant (ipcMain: Electron.IpcMain): void {
  currentSettings = loadSettings()
  if (currentSettings.enabled) startLoop()

  ipcMain.handle('legacyAssistant:update', (_event, patch: Partial<LegacyAssistantSettings>) => {
    currentSettings = { ...currentSettings, ...patch }
    saveSettings(currentSettings)
    if (currentSettings.enabled) { startLoop() } else { stopLoop() }
    return { success: true, settings: currentSettings }
  })

  ipcMain.handle('legacyAssistant:get', () => ({
    success: true,
    settings: currentSettings,
  }))

  ipcMain.handle('legacyAssistant:getBookmarklet', () => {
    const token = _getToken()
    const port  = _getPort()
    if (!token) return { success: false, error: 'Server not started yet' }
    return {
      success: true,
      bookmarklet: buildBookmarklet(token, port, currentSettings.targetLang),
    }
  })

  ipcMain.handle('legacyAssistant:injectNow', () => {
    tryInject()
    return { success: true }
  })
}
