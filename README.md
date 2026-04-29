<p align="right">
  <a href="https://me.momo.vn/aMI2T6tWf3uRteU4tqUZtn">
    <img src="https://img.shields.io/badge/☕%20Support%20via%20MoMo-ae2070?style=for-the-badge" alt="Support via MoMo">
  </a>
</p>

# Viezan — AI Translation Desktop App

<p align="center">
  <img src="public/icon.png" width="96" alt="Viezan logo">
</p>

<p align="center">
  A powerful AI translation desktop app running 100% locally on <strong>macOS</strong>, <strong>Windows</strong> and <strong>Linux</strong>.<br>
  Supports <strong>Google Gemini</strong>, <strong>Anthropic Claude</strong> and <strong>OpenAI GPT</strong> — API keys stored securely in OS Keychain, never sent to any intermediate server.
</p>

<p align="center">
  <a href="https://github.com/trunghieupham59/Viezan/releases/latest">
    <img src="https://img.shields.io/github/v/release/trunghieupham59/Viezan?style=flat-square&color=f97316" alt="Latest Release">
  </a>
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/Electron-v41-47848F?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-v18-61DAFB?style=flat-square&logo=react" alt="React">
</p>

---

## 📸 Screenshots

<p align="center">
  <a href="https://trunghieupham59.github.io/viezan/" title="🎬 Interactive 3D Slider">
    <img src="docs/screenshots/demo.gif" width="800" alt="Viezan Screenshots — click to open interactive slider">
  </a>
</p>

<p align="center">
  <a href="https://trunghieupham59.github.io/viezan/">🎬 Open Interactive Slider →</a>
</p>

---

## 📦 Download

| Platform | Installer |
|----------|-----------|
|  macOS (Apple Silicon) | [Download v1.1.5 ARM64 DMG](https://github.com/trunghieupham59/Viezan/releases/tag/v1.1.5) |
|  macOS (Intel x64) | [Download v1.1.5 x64 DMG](https://github.com/trunghieupham59/Viezan/releases/tag/v1.1.5) |
| ⊞ Windows (x64) | [Download v1.1.5 x64 installer](https://github.com/trunghieupham59/Viezan/releases/tag/v1.1.5) |
| 🐧 Linux (x64) | [Download v1.1.5 AppImage](https://github.com/trunghieupham59/Viezan/releases/tag/v1.1.5) |
| 🌐 Chrome Extension | [Download ZIP from v1.1.5 release](https://github.com/trunghieupham59/Viezan/releases/tag/v1.1.5) |

> View all releases: [github.com/trunghieupham59/Viezan/releases](https://github.com/trunghieupham59/Viezan/releases)

---

## 🆕 What's New in v1.1.5

### ✨ New Features

| Feature | Details |
|---------|---------|
| 🧠 **Local AI Provider** | Run translation, rewrite and chat through local OpenAI-compatible runtimes without an API key |
| 🧰 **Ollama Setup Flow** | Detects Ollama, LM Studio and llama.cpp; can install/start Ollama and refresh local runtime status from Settings |
| 📊 **Hardware Benchmarking** | Measures CPU/RAM tier, recommends local models, and resolves `local-auto` to the best available local model |
| ⬇️ **Model Download Progress** | Pull curated Ollama models from Viezan with streamed progress, size labels, installed badges and uninstall actions |
| 🧹 **History Bulk Actions** | Select and delete multiple Translate, Chat and Live history entries in one flow |
| 🧩 **Chrome Extension Selection UI** | Redesigned selected-text UI with translation style support and cleaner browser interactions |

### 🛠️ Improvements & Fixes

- **Provider Defaults** — Local AI is now the default provider path, with cloud providers still available as BYOK options
- **Streaming Chat Reliability** — Added streaming handler coverage and provider-specific output token guards
- **IPC Validation** — Chat and translation payloads now have stricter Main Process validation before provider dispatch
- **STT Reliability** — Hedged Whisper/Gemini STT routing and smarter provider banning reduce live transcription stalls
- **UI Polish** — Responsive sidebar labels, updated blue theme, normalized surface styles, border radii and z-index layering
- **Build Pipeline** — macOS release runners pinned to avoid the macOS 15 DMG `hdiutil` issue
- **Tooling** — Biome upgraded to 2.4.13 and repository lint fixes applied

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Multiple AI Providers** | Local AI, Google Gemini, Anthropic Claude, OpenAI GPT — switch anytime |
| 🧠 **Local AI** | Detect Ollama, LM Studio or llama.cpp; benchmark hardware; download curated Ollama models; run without cloud API keys |
| 🔤 **7 Translation Styles** | Neutral, Friendly, Professional, Business, Slack, Polite, Technical — fits every context |
| 📢 **Phonetic Mode** | Pure phonetic/romanization transcription mode for any language |
| ⚡ **Live Translation** | Real-time translation & floating subtitles from microphone or system audio, with customizable color/size/opacity |
| 🖼️ **Image Translation (AI Vision)** | Drag & drop or paste an image — AI extracts and translates all text |
| 🎙️ **Voice Input** | Supports Web Speech API, OpenAI Whisper, Gemini STT, and Groq as fallback |
| 🔊 **Text-to-Speech** | OpenAI, Gemini, Edge TTS and ElevenLabs fallback chain |
| 💬 **AI Chat** | Full chat with image attachment, voice input, System Prompt with saved presets |
| 🔍 **Web Search in Chat** | Multi-provider web search with automatic failover |
| 🇯🇵 **Japanese Furigana** | Automatically renders furigana on Japanese translation output |
| 📜 **History** | Separate history for Translate, Chat and Live sessions — search & reuse anytime |
| 🌐 **Chrome Extension** | Translate directly in the browser (floating button, popup, right-click menu, Alt+T shortcut, ZIP release package) |
| 🔖 **Bookmarklet** | Quick translate on any browser without an extension |
| ⌨️ **Global Hotkey** | Activate Viezan from any application |
| 🌍 **19 Languages** | Vietnamese, English, Japanese, Korean, Chinese, French, German, Spanish, and more |
| 🌐 **Multi-language UI** | Interface available in Vietnamese, English and Japanese |
| 🔒 **Secure API Key Storage** | Encrypted via Electron safeStorage — Keychain (macOS) / Credential Manager (Windows) |
| 🌙 **Dark Mode** | Follows system appearance automatically |
| 🔄 **Auto Update** | Built-in auto-update |

---

## 🚀 Getting Started

### 1. Download & Install

Download the installer for your platform from the [Download](#-download) section above and run it.

> **macOS unsigned build:** Viezan is not signed/notarized yet, so macOS Gatekeeper may show **"Viezan" cannot be opened** on first launch. Open **System Settings → Privacy & Security** and click **Open Anyway** for Viezan. If you trust the downloaded app and macOS still blocks it, run `xattr -dr com.apple.quarantine /Applications/Viezan.app` after dragging it to Applications, then open Viezan again.

### 2. Add your API Key

1. Open **Viezan**
2. Click the **⚙ Settings** button (top-right, any tab)
3. Select a provider (Gemini / Claude / OpenAI), paste your API key → **Save Key**

Your key is stored securely in the OS Keychain and never leaves your device.

### 3. Start Translating

- **Translate** — Type or paste text, choose source/target language, style, or enable Phonetic Mode
- **Live** — Real-time translation from microphone/system audio with floating subtitles
- **Image** — Drag & drop or paste an image to extract and translate text
- **Chat** — Chat freely with AI, attach images, voice input, system prompts and web search
- **History** — Revisit all past translations, chats and live sessions

---

## 🔑 API Keys

Get your API keys from the respective dashboards:

| Provider | Dashboard |
|----------|-----------|
| Local AI | No key required — install/start Ollama, LM Studio or llama.cpp locally |
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI GPT | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Groq (STT) | [console.groq.com](https://console.groq.com) |

> API keys are only used in the Electron main process to call the provider API directly — never written to disk, never sent through any intermediate server, never exposed to any third party.

---

## 🌐 Chrome Extension

The Chrome Extension lets you translate directly in the browser without switching windows.

**Installation (Developer / Unpacked):**

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `chrome-extension/` folder from this repository
4. The Viezan icon will appear in your toolbar

**Connect to the Viezan app:**

1. Open **Viezan** → click ⚙ **Settings → Browser Extension**
2. Copy the **Connection Token**
3. Click the Viezan icon in Chrome → **⚙ Options** → Paste the token → **Save Settings**

**Keyboard Shortcuts:**

| Shortcut | Action |
|----------|--------|
| `Alt+T` (Windows/Linux) / `Option+T` (macOS) | Translate selected text |

> See [chrome-extension/README.md](chrome-extension/README.md) for details.

---

## 🛠️ Development

### Prerequisites

- **Node.js** v18+
- **macOS**, **Windows** or **Linux**

### Setup

```bash
# Clone the repository
git clone https://github.com/trunghieupham59/Viezan.git
cd Viezan

# Install dependencies
npm install

# Start development server + Electron
npm run dev
```

### Test

```bash
npm test              # Run all tests (unit + integration)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Tests are located in `src/**/__tests__/` and `electron/ipc/__tests__/`.

### Build

```bash
npm run build:mac     # macOS (arm64 + x64 DMG)
npm run build:win     # Windows (NSIS installer)
npm run build:linux   # Linux (AppImage)
```

Output files are placed in the `release/` directory.

---

## 📁 Project Structure

```
Viezan/
├── electron/                   # Main process (Node.js / Electron)
│   ├── main.ts                 # App entry point, window management
│   ├── preload.ts              # Context bridge (IPC bindings)
│   └── ipc/                   # IPC handlers
│       ├── keychain.ts         # Secure API key storage
│       ├── translate.ts        # Text translation
│       ├── localAi.ts          # Local AI runtime discovery, benchmark and model downloads
│       ├── imageTranslate.ts   # Image/vision translation
│       ├── transcribe.ts       # Speech-to-text (Whisper / Gemini / Groq)
│       ├── tts.ts              # Text-to-speech
│       ├── chat.ts             # AI chat
│       ├── subtitle.ts         # Live translation subtitles
│       ├── localServer.ts      # Local HTTP server (Chrome Extension)
│       ├── globalHotkey.ts     # Global hotkey registration
│       ├── webSearch.ts        # Multi-provider web search
│       ├── models.ts           # Available model listing
│       └── storage.ts          # Local data persistence
├── src/                        # Renderer process (React)
│   ├── pages/
│   │   ├── TranslatePage.tsx   # Main translation UI (+ Phonetic Mode)
│   │   ├── LiveTranslatePage.tsx # Real-time translation
│   │   ├── ChatPage.tsx        # AI chat interface (+ Web Search)
│   │   ├── HistoryPage.tsx     # Translation history
│   │   └── SettingsPage.tsx    # API keys & preferences
│   ├── components/
│   │   ├── SettingsModal.tsx   # Settings popup overlay
│   │   └── ...                 # Other reusable UI components
│   ├── store/                  # Zustand global state
│   ├── i18n/                   # UI translations (VI/EN/JA)
│   ├── types/                  # TypeScript type definitions
│   └── constants/              # Provider, model & language constants
└── chrome-extension/           # Chrome Extension (Browser Integration)
```

---

## 🧰 Tech Stack

| Technology | Version | Role |
|-----------|---------|------|
| [Electron](https://www.electronjs.org/) | v41 | Desktop shell |
| [React](https://react.dev/) | v18 | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | v5 | Type safety |
| [Vite](https://vitejs.dev/) | v8 | Build tool |
| [Tailwind CSS](https://tailwindcss.com/) | v3 | Styling |
| [Zustand](https://zustand-demo.pmnd.rs/) | v5 | State management |
| [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) | built-in | OS-level encrypted key storage |
| [electron-builder](https://www.electron.build/) | v26 | App packaging & distribution |
| [electron-updater](https://www.electron.build/auto-update) | v6 | Auto-update |
| [Ollama / LM Studio / llama.cpp](https://ollama.com/) | local | Optional local AI runtime |

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## ☕ Support the Author

If you find Viezan useful, consider buying me a coffee via MoMo to keep the project going and motivate new features! 🙏

<p align="center">
  <a href="https://me.momo.vn/aMI2T6tWf3uRteU4tqUZtn">
    <img src="https://img.shields.io/badge/☕_Buy_me_a_coffee-MoMo-ae2070?style=for-the-badge" alt="Buy me a coffee via MoMo">
  </a>
</p>

---

## 👤 Author

**trunghieupham59** — [github.com/trunghieupham59](https://github.com/trunghieupham59)

---

## ⚠️ Disclaimer

Viezan is an independent desktop application and is not affiliated with Google, Anthropic, OpenAI, or Groq. You are responsible for your own API usage and any associated costs.

---

## 📄 License

[MIT](LICENSE)
