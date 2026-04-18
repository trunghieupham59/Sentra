# 🪷 Lotus — AI Translation Desktop App

<p align="center">
  <img src="public/logo.png" width="96" alt="Lotus logo">
</p>

<p align="center">
  A beautiful, fast desktop app for AI-powered translation on <strong>macOS</strong> and <strong>Windows</strong>.<br>
  Supports <strong>Google Gemini</strong>, <strong>Anthropic Claude</strong>, and <strong>OpenAI GPT</strong> — with API keys stored securely in the OS Keychain.
</p>

<p align="center">
  <a href="https://github.com/trunghieupham59/lotus-translate/releases/latest">
    <img src="https://img.shields.io/github/v/release/trunghieupham59/lotus-translate?style=flat-square&color=f97316" alt="Latest Release">
  </a>
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/Electron-v41-47848F?style=flat-square&logo=electron" alt="Electron">
  <img src="https://img.shields.io/badge/React-v18-61DAFB?style=flat-square&logo=react" alt="React">
</p>

---

## 📦 Download

| Platform | Installer |
|----------|-----------|
|  macOS (Apple Silicon) | [Lotus-1.0.3-arm64.dmg](https://github.com/trunghieupham59/lotus-translate/releases/download/v1.0.3/Lotus-1.0.3-arm64.dmg) |
|  macOS (Intel x64) | [Lotus-1.0.3.dmg](https://github.com/trunghieupham59/lotus-translate/releases/download/v1.0.3/Lotus-1.0.3.dmg) |
| ⊞ Windows (x64) | [Lotus.Setup.1.0.3.exe](https://github.com/trunghieupham59/lotus-translate/releases/download/v1.0.3/Lotus.Setup.1.0.3.exe) |

> View all releases: [github.com/trunghieupham59/lotus-translate/releases](https://github.com/trunghieupham59/lotus-translate/releases)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Multiple AI Providers** | Google Gemini, Anthropic Claude, OpenAI GPT — switch anytime |
| 🖼️ **Image Translation** | Translate text directly from screenshots or images using AI vision |
| 🎙️ **Voice Input** | Record speech and transcribe it for instant translation |
| 🔊 **Text-to-Speech** | Listen to translated results with natural TTS |
| ⚡ **Live Translation** | Real-time translation as you type (debounced) |
| 💬 **AI Chat** | Full chat mode powered by your chosen AI provider |
| 🎨 **Translation Styles** | Standard, Casual, Formal, Technical, Message — pick your tone |
| 🇯🇵 **Japanese Furigana** | Reading aid (furigana) automatically rendered on Japanese output |
| 📜 **Translation History** | Browse, search, and reuse all past translations |
| 🌍 **20+ Languages** | Vietnamese, English, Japanese, Korean, Chinese, French, and more |
| 🌐 **Multi-language UI** | Interface available in English, Vietnamese, and Japanese |
| 🔒 **Secure Key Storage** | API keys stored in macOS Keychain / Windows Credential Manager — never in files |
| 🌙 **Dark Mode** | Follows system appearance automatically |

---

## 🚀 Getting Started

### 1. Download & Install

Download the installer for your platform from the [Download](#-download) section above and run it.

### 2. Add your API Key

1. Open **Lotus**
2. Click the **provider icon** in the sidebar (Gemini / Claude / OpenAI)
3. Paste your API key → click **Save Key**

Your key is stored securely in the OS Keychain and never leaves your device.

### 3. Start Translating

- **Translate tab** — type or paste text, choose source/target language and style
- **Live tab** — real-time translation as you type
- **Image tab** — paste or upload an image to extract and translate text
- **Chat tab** — chat freely with your AI provider
- **History tab** — revisit all past translations

---

## 🔑 API Keys

Get your API keys from the respective dashboards:

| Provider | Dashboard |
|----------|-----------|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI GPT | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

> All keys are stored in the OS Keychain (macOS) or Credential Manager (Windows). They are only used in the Electron main process and are never exposed to the renderer, never written to disk, and never sent to any third-party server.

---

## 🛠️ Development

### Prerequisites

- **Node.js** v18+
- **macOS** or **Windows**

### Setup

```bash
# Clone the repository
git clone https://github.com/trunghieupham59/lotus-translate.git
cd lotus-translate

# Install dependencies
npm install

# Rebuild native modules for your Electron version
npm run rebuild

# Start development server + Electron
npm run dev
```

### Test

```bash
npm test              # Run all tests (unit + integration)
npm run test:watch    # Watch mode for development
```

Tests are located in `src/**/__tests__/` and `electron/ipc/__tests__/`.

### Build

```bash
npm run build:mac     # macOS (arm64 + x64 DMG)
npm run build:win     # Windows (NSIS installer)
```

Output files are placed in the `release/` directory.

---

## 📁 Project Structure

```
lotus/
├── electron/                   # Main process (Node.js / Electron)
│   ├── main.ts                 # App entry point, window management
│   ├── preload.ts              # Context bridge (IPC bindings)
│   └── ipc/                   # IPC handlers
│       ├── keychain.ts         # Secure API key storage
│       ├── translate.ts        # Text translation
│       ├── imageTranslate.ts   # Image/vision translation
│       ├── transcribe.ts       # Speech-to-text
│       ├── tts.ts              # Text-to-speech
│       ├── chat.ts             # AI chat
│       ├── models.ts           # Available model listing
│       └── storage.ts          # Local data persistence
└── src/                        # Renderer process (React)
    ├── pages/
    │   ├── TranslatePage.tsx   # Main translation UI
    │   ├── LiveTranslatePage.tsx # Real-time translation
    │   ├── ChatPage.tsx        # AI chat interface
    │   ├── HistoryPage.tsx     # Translation history
    │   └── SettingsPage.tsx    # API keys & preferences
    ├── components/             # Reusable UI components
    ├── store/                  # Zustand global state
    ├── i18n/                   # UI translations (EN/VI/JA)
    ├── types/                  # TypeScript type definitions
    └── constants/              # Provider & model constants
```

---

## 🧰 Tech Stack

| Technology | Role |
|-----------|------|
| [Electron v41](https://www.electronjs.org/) | Desktop shell |
| [React v18](https://react.dev/) | UI framework |
| [TypeScript v5](https://www.typescriptlang.org/) | Type safety |
| [Vite v5](https://vitejs.dev/) | Build tool |
| [Tailwind CSS v3](https://tailwindcss.com/) | Styling |
| [Zustand v5](https://zustand-demo.pmnd.rs/) | State management |
| [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage) | OS-level encrypted key storage (built-in, no native compilation) |
| [electron-builder v26](https://www.electron.build/) | App packaging & distribution |

---

## 📝 Changelog

### v1.0.3
- Added **Live Translation** page — real-time translation as you type
- Added **AI Chat** mode with full conversation history
- Added **Model Selector** — choose specific model per provider
- Added **Markdown rendering** in translation and chat output
- Improved image translation pipeline
- UI language support expanded (English, Vietnamese, Japanese)
- Bug fixes and performance improvements

### v1.0.2
- Added **Image Translation** via AI vision models
- Added **Voice Input** (speech-to-text transcription)
- Added **Text-to-Speech** for translation output
- Added **Translation History** with persistence
- Added **Japanese Furigana** rendering

### v1.0.1
- Multi-provider support: Google Gemini, Anthropic Claude, OpenAI GPT
- Translation styles: Standard, Casual, Formal, Technical, Message
- 20+ language pairs
- Secure API key storage via OS Keychain

### v1.0.0
- Initial release

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome!
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 👤 Author

**trunghieupham59** — [github.com/trunghieupham59](https://github.com/trunghieupham59)

---

## ⚠️ Disclaimer

Lotus is an independent desktop application and is not affiliated with Google, Anthropic, or OpenAI. You are responsible for your own API usage and any associated costs.

---

## 📄 License

[MIT](LICENSE)
