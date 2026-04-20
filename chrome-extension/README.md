# Sentra Translate — Chrome Extension (Legacy Assistant)

A Chrome/Chromium browser extension that lets you translate selected text on any webpage using the **Sentra native app** running on your machine.

## Architecture

```
Browser (Extension)  ←→  Sentra Native App (localhost:39875)
                              ↓
                         AI Provider (Gemini / OpenAI / Claude)
                              ↓
                         Uses API keys stored securely in OS Keychain
```

**API keys are never stored in the extension** — they remain in the Sentra native app's OS Keychain. The extension communicates with the app over a local-only HTTP server protected by a shared token.

---

## Installation (Developer / Unpacked)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/` folder from this repository
5. The Sentra icon will appear in your toolbar

---

## Setup

1. Open the **Sentra app** on your computer
2. Go to **Settings → Browser Extension (Legacy Assistant)**
3. Copy the **Connection Token** shown there
4. Click the Sentra extension icon → **⚙ Options**
5. Paste the token in the **Connection Token** field
6. Set your preferred **Target Language** and **AI Provider**
7. Click **Test Connection** to verify, then **Save Settings**

> ⚠️ The Sentra app must be **running** for translations to work.

---

## Features

### Floating Translate Button
When you select text on any webpage, a small **Sentra Translate** button appears near the selection. Click it to instantly translate the text. The result appears in a tooltip above the selection and is also copied to your clipboard.

### Popup Quick Translate
Click the Sentra toolbar icon to open a mini translate panel where you can:
- Type or paste text manually
- Select the target language
- See the translation result
- Auto-fill from your current selection

### Right-Click Context Menu
Right-click any selected text and choose **"Translate with Sentra"** from the context menu.

---

## Files

| File | Description |
|------|-------------|
| `manifest.json` | Chrome Extension Manifest V3 |
| `content.js` | Injects the floating button into every page |
| `content.css` | Styles for the floating button and tooltip |
| `background.js` | Service worker — handles context menu |
| `popup.html/js` | Toolbar popup for quick translation |
| `options.html/js` | Settings page for token & preferences |

---

## Security

- The local server listens **only on `127.0.0.1`** (loopback) — not accessible from other devices
- Every request requires the **`X-Sentra-Token`** header — random 32-byte hex secret
- The token is shown in the Sentra app Settings and stored in Chrome's `storage.local`
- API keys **never leave the Sentra native app**
