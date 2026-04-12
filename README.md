# 🪷 Lotus

**Lotus** is a desktop AI translation app for macOS and Windows.  
Supports Google Gemini, Anthropic Claude, and OpenAI GPT — with API keys stored securely in the OS Keychain.

---

## Download

| Platform | Link |
|----------|------|
| macOS (Apple Silicon) | [Lotus-1.0.2-arm64.dmg](https://github.com/trunghieupham59/lotus-translate/releases/download/v1.0.2/Lotus-1.0.2-arm64.dmg) |
| macOS (Intel x64) | [Lotus-1.0.2.dmg](https://github.com/trunghieupham59/lotus-translate/releases/download/v1.0.2/Lotus-1.0.2.dmg) |
| Windows (x64) | [Lotus Setup 1.0.2.exe](https://github.com/trunghieupham59/lotus-translate/releases/download/v1.0.2/Lotus.Setup.1.0.2.exe) |

> Or view all releases: [github.com/trunghieupham59/lotus-translate/releases](https://github.com/trunghieupham59/lotus-translate/releases)

---

## Features

- **Multiple AI Providers** — Google Gemini, Anthropic Claude, OpenAI GPT
- **Image Translation** — Translate text from images using AI vision
- **Voice Input** — Record and transcribe audio for translation
- **Text-to-Speech** — Listen to translation results
- **Auto Translate** — Translates as you type (debounced)
- **Translation Styles** — Standard, Casual, Formal, Technical, Message
- **Japanese Furigana** — Reading aid for Japanese output
- **Translation History** — Browse and reuse past translations
- **20+ Languages** — Vietnamese, English, Japanese, Korean, Chinese, and more
- **Multi-language UI** — Interface in English, Vietnamese, Japanese
- **Secure Key Storage** — API keys stored in macOS Keychain / Windows Credential Manager, never in any file
- **Dark Mode** — Follows system appearance

---

## Development

### Prerequisites

- Node.js v18+
- macOS or Windows

### Setup

```bash
npm install
npm run rebuild       # Rebuild keytar for your Electron version
npm run dev           # Start dev server + Electron
```

### Build

```bash
npm run build:mac     # macOS (arm64 + x64)
npm run build:win     # Windows NSIS installer
```

---

## API Keys

| Provider | Dashboard |
|----------|-----------|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI GPT | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

To add a key: open Lotus → click the provider icon in the sidebar → paste your key → **Save Key**.

---

## Security

API keys are stored in the OS Keychain (macOS) or Credential Manager (Windows). They are only used in the Electron main process to call the provider's API directly — they are never exposed to the renderer process, never stored in files, and never sent to any third-party server.

---

## Project Structure

```
lotus/
├── electron/                  # Main process (Node.js)
│   ├── main.ts
│   ├── preload.ts
│   └── ipc/
│       ├── keychain.ts
│       ├── translate.ts
│       ├── imageTranslate.ts
│       ├── transcribe.ts
│       ├── tts.ts
│       └── models.ts
└── src/                       # Renderer (React)
    ├── pages/
    ├── components/
    ├── store/
    ├── i18n/
    ├── types/
    └── constants/
```

---

## Tech Stack

| | |
|---|---|
| Electron v33 | Desktop shell |
| React v18 | UI |
| TypeScript v5 | Type safety |
| Vite v5 | Build tool |
| Tailwind CSS v3 | Styling |
| Zustand v5 | State management |
| keytar v7 | OS Keychain |
| electron-builder v25 | Packaging |

---

## License

MIT
