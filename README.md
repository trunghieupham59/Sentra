<p align="right">
  <a href="https://me.momo.vn/aMI2T6tWf3uRteU4tqUZtn">
    <img src="https://img.shields.io/badge/Support%20via%20MoMo-ae2070?style=for-the-badge" alt="Support via MoMo">
  </a>
</p>

# Viezan

<p align="center">
  <img src="public/icon.png" width="96" alt="Viezan logo">
</p>

<p align="center">
  <strong>Local-first AI translation for desktop and browser.</strong><br>
  Viezan runs on macOS, Windows and Linux, with Local AI support plus bring-your-own-key cloud providers.
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

Viezan is a desktop translation workspace for text, images, live audio, chat and browser-selected text. The app does not use a Viezan-hosted relay server: requests are handled on your machine, then sent only to the local runtime or cloud provider you choose.

## Screenshots

<p align="center">
  <a href="https://trunghieupham59.github.io/viezan/" title="Open interactive screenshot slider">
    <img src="docs/screenshots/demo.gif" width="800" alt="Viezan screenshots">
  </a>
</p>

<p align="center">
  <a href="https://trunghieupham59.github.io/viezan/">Open interactive screenshot gallery</a>
</p>

## Download

| Platform | Package |
| --- | --- |
| macOS Apple Silicon | DMG from the [latest release](https://github.com/trunghieupham59/Viezan/releases/latest) |
| macOS Intel x64 | DMG from the [latest release](https://github.com/trunghieupham59/Viezan/releases/latest) |
| Windows x64 | NSIS installer from the [latest release](https://github.com/trunghieupham59/Viezan/releases/latest) |
| Linux x64 | AppImage from the [latest release](https://github.com/trunghieupham59/Viezan/releases/latest) |
| Chrome Extension | Extension package from the matching [release](https://github.com/trunghieupham59/Viezan/releases/latest) |

View all versions on the [GitHub Releases page](https://github.com/trunghieupham59/Viezan/releases).

## What's New in v2.0.0

| Area | Change |
| --- | --- |
| Quick Chat | Fixed macOS focus stealing and Dock reopen behavior for a smoother floating-chat workflow. |
| AI Chat | Added configurable chat shortcuts with test coverage for shortcut handling. |
| Browser Extension | Renamed the desktop connection token wording to connection API key across docs and setup copy. |
| Local-first docs | Refreshed README and release guidance around local runtimes, BYOK providers and unsigned macOS builds. |
| Release | Updated macOS GitHub Actions runners to supported `macos-15` / `macos-15-intel` labels. |

## Features

| Feature | Description |
| --- | --- |
| Text Translation | Translate text with source detection, manual mode, 7 tone styles and phonetic output. |
| Local AI | Run translation, rewrite and chat through Ollama, LM Studio or llama.cpp without a cloud API key. |
| Cloud Providers | Use Google Gemini, Anthropic Claude or OpenAI with your own API keys. |
| Live Translation | Real-time microphone/system-audio transcription, translation and floating subtitles. |
| Image Translation | Drag, drop or paste images; AI extracts and translates visible text. |
| Voice Input | Web Speech API plus Whisper, Gemini STT and Groq fallback routing. |
| Text-to-Speech | OpenAI, Gemini, Edge TTS and ElevenLabs fallback chain. |
| AI Chat | Chat with image attachments, voice input, saved system prompts, history, optional web search and native chart blocks in AI responses. |
| Web Search | Tavily and Brave key support with a Jina fallback path. |
| Browser Integration | Chrome Extension, context menu, floating selected-text button and `Alt+T` shortcut. |
| History | Separate searchable history for Translate, Chat and Live sessions. |
| Security | API keys are encrypted with Electron safeStorage and are used only by the Electron main process. |

## Getting Started

### 1. Install Viezan

Download the package for your platform from [Releases](https://github.com/trunghieupham59/Viezan/releases/latest), install it, then launch Viezan.

For unsigned macOS builds, Gatekeeper may show `"Viezan" cannot be opened` on first launch. Open **System Settings -> Privacy & Security** and choose **Open Anyway** for Viezan. If you trust the downloaded app and macOS still blocks it after dragging it to Applications, run:

```bash
xattr -dr com.apple.quarantine /Applications/Viezan.app
```

### 2. Choose a Provider

Local AI works without cloud keys when a compatible local runtime is available.

For cloud providers, open **Settings -> API Keys**, choose a provider, paste your key, and save it. Keys are encrypted by Electron safeStorage on the current OS and are not stored in the browser extension.

| Provider | Key required | Where to configure |
| --- | --- | --- |
| Local AI | No | **Settings -> Local AI** |
| Google Gemini | Yes | **Settings -> API Keys** |
| Anthropic Claude | Yes | **Settings -> API Keys** |
| OpenAI | Yes | **Settings -> API Keys** |
| Groq STT | Optional | **Settings -> Speech-to-Text** |
| Tavily / Brave Search | Optional | **Settings -> Web Search** |

### 3. Start Translating

- **Translate**: text translation, tone styles and phonetic mode.
- **Live**: live subtitles from microphone, system audio or both.
- **Image**: image OCR-style translation and translated image output where supported.
- **Chat**: multimodal chat with voice input, saved prompts and optional web search.
- **History**: search, reuse and delete previous Translate, Chat and Live sessions.

## Chrome Extension

The extension connects browser-selected text to the Viezan desktop app over `127.0.0.1:39875`.

1. Install the extension package from the matching release, or load `chrome-extension/` unpacked for local development.
2. Open **Viezan -> Settings -> Browser Extension**.
3. Copy or create a connection API key.
4. Open the extension **Options** page, paste the API key, set your preferred language/provider, then save.

The desktop app must be running for browser translations to work. The connection API key is sent through the local auth header, and the extension never stores cloud provider API keys.

See [chrome-extension/README.md](chrome-extension/README.md) for the detailed extension guide.

## Development

### Prerequisites

- Node.js 18+
- npm
- macOS, Windows or Linux

### Setup

```bash
git clone https://github.com/trunghieupham59/Viezan.git
cd Viezan
npm install
npm run dev
```

### Test

```bash
npm test
npm run test:watch
npm run test:coverage
```

Tests live in `src/**/__tests__/` and `electron/ipc/__tests__/`.

### Build

```bash
npm run build
npm run build:mac
npm run build:win
npm run build:linux
```

Build artifacts are written to `release/`.

## Project Map

```text
Viezan/
├── electron/                 # Electron main process and IPC handlers
│   ├── main.ts               # App lifecycle and window management
│   ├── preload.ts            # Context bridge entry
│   ├── preload/              # Renderer-facing preload modules
│   └── ipc/                  # Providers, storage, local server, audio, updater
├── src/                      # React renderer
│   ├── pages/                # Translate, Live, Chat, History, Settings
│   ├── components/           # Shared UI and feature components
│   ├── store/                # Zustand app state
│   ├── services/             # Renderer service helpers
│   ├── i18n/                 # App UI translations
│   └── types/                # Shared TypeScript types
├── chrome-extension/         # Chrome/Chromium extension
├── docs/                     # GitHub Pages landing page and screenshots
├── scripts/                  # Build and asset scripts
└── viezanagent/              # Agent rules, skills, workflows, reports and docs
```

## Tech Stack

| Technology | Role |
| --- | --- |
| Electron 41 | Desktop shell, native capabilities and secure storage |
| React 18 | Renderer UI |
| TypeScript 5 | Type safety across renderer and Electron code |
| Vite 8 | Renderer build pipeline |
| Tailwind CSS 3 | Styling |
| Zustand 5 | Client state |
| electron-builder 26 | Packaging and publishing |
| Vitest 4 | Unit and integration tests |

## Contributing

Contributions, bug reports and feature requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

If Viezan is useful to you, you can support development via MoMo:

<p align="center">
  <a href="https://me.momo.vn/aMI2T6tWf3uRteU4tqUZtn">
    <img src="https://img.shields.io/badge/Buy%20me%20a%20coffee-MoMo-ae2070?style=for-the-badge" alt="Buy me a coffee via MoMo">
  </a>
</p>

## Author

**trunghieupham59** - [github.com/trunghieupham59](https://github.com/trunghieupham59)

## Disclaimer

Viezan is an independent desktop application and is not affiliated with Google, Anthropic, OpenAI, Groq, Tavily, Brave, Ollama, LM Studio or llama.cpp. You are responsible for your own provider usage and associated costs.

## License

[MIT](LICENSE)
