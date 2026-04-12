# 🪷 Lotus

> **Lotus** — Local AI Translation App for macOS & Windows  
> Supports Google Gemini, Anthropic Claude, and OpenAI GPT  
> API Keys stored **only** in OS Keychain — 100% private, no backend server

---

## ✨ Features

- 🤖 **Multiple AI Providers**: Google Gemini, Anthropic Claude, OpenAI GPT
- 🔒 **Secure Key Storage**: API keys stored in macOS Keychain / Windows Credential Manager
- ⚡ **Auto Translate**: Automatically translates as you type (debounced)
- 🔄 **Language Swap**: Swap source/target languages instantly
- 📋 **One-tap Copy**: Copy translation result with one click
- 🌍 **20+ Languages**: Vietnamese, English, Chinese, Japanese, Korean, and more
- 🎨 **Japanese Furigana**: Show furigana (reading) for Japanese translations
- 📝 **Translation History**: Browse and reuse previous translations
- 🌐 **Multi-language UI**: Interface available in English, Vietnamese, Japanese
- 🌙 **Dark Mode**: Automatic dark/light mode based on system settings
- 🎯 **Translation Styles**: Standard, Casual, Formal, Message, Technical

---

## 📦 Download

| Platform | File | Architecture |
|----------|------|-------------|
| macOS (Apple Silicon) | `Lotus-1.0.0-arm64.dmg` | M1/M2/M3/M4 |
| macOS (Intel) | `Lotus-1.0.0.dmg` | Intel x64 |
| Windows | `Lotus Setup 1.0.0.exe` | x64 |

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js v18+ (tested with v25.9.0)
- npm v9+ (tested with v11.12.1)
- macOS or Windows

### 1. Install Dependencies
```bash
npm install
```

### 2. Rebuild Native Modules (keytar)
```bash
npm run rebuild
```
> This rebuilds `keytar` for your specific Electron version so Keychain access works.

### 3. Start Development Server
```bash
npm run dev
```

This will:
1. Start Vite dev server at `http://localhost:5173`
2. Wait for Vite to be ready
3. Compile Electron TypeScript
4. Launch Electron window with DevTools

---

## 🔨 Build for Distribution

### macOS — Apple Silicon (arm64)
```bash
npm run build:mac
# Output: release/Lotus-1.0.0-arm64.dmg
```

### macOS — Intel (x64)
```bash
npm run build:mac
# Output: release/Lotus-1.0.0.dmg
```

> Both Mac builds are produced by `npm run build:mac` (builds arm64 + x64 simultaneously)

### Windows — NSIS Installer (x64)
```bash
npm run build:win
# Output: release/Lotus Setup 1.0.0.exe
```

---

## ⚙️ Configuration

### Getting API Keys

| Provider | Where to Get Key | Key Format |
|----------|-----------------|------------|
| Google Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `AIza...` |
| Anthropic Claude | [console.anthropic.com](https://console.anthropic.com) | `sk-ant-...` |
| OpenAI GPT | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `sk-...` |

### Adding Keys in App
1. Open Lotus
2. Click the provider icon in the sidebar (Gemini / Claude / OpenAI)
3. Paste your API key in the relevant section
4. Click **Save Key** — stored in OS Keychain, never in any file

---

## 🔒 Security & Privacy

| What | How |
|------|-----|
| API Key storage | OS Keychain (macOS) / Credential Manager (Windows) |
| Key transmission | Only sent directly to the AI provider's API |
| Data storage | Nothing stored — no database, no logs |
| Network | Direct HTTPS to AI API only |

> **Renderer process (UI) never sees raw API keys.** Keys are read in the Electron main process and used directly to call APIs.

---

## 🏗️ Project Structure

```
lotus/
├── README.md
├── package.json
├── tsconfig.json              # React/Vite TypeScript config
├── tsconfig.electron.json     # Electron main process TypeScript config
├── vite.config.ts
├── tailwind.config.js
│
├── electron/                  # Electron Main Process (Node.js)
│   ├── main.ts               # App entry, window creation
│   ├── preload.ts            # contextBridge API
│   └── ipc/
│       ├── keychain.ts       # OS Keychain operations via keytar
│       ├── models.ts         # Fetch available AI models
│       └── translate.ts      # AI API calls (Gemini/Claude/OpenAI)
│
└── src/                       # React Renderer (Browser)
    ├── App.tsx
    ├── i18n/                  # Internationalization (en/vi/ja)
    ├── pages/
    │   ├── TranslatePage.tsx
    │   ├── HistoryPage.tsx
    │   └── SettingsPage.tsx
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── LanguageSelector.tsx
    │   ├── ModelSelector.tsx
    │   ├── ApiKeyInput.tsx
    │   └── FuriganaText.tsx
    ├── store/
    │   └── useAppStore.ts     # Zustand state management
    ├── types/index.ts
    └── constants/providers.ts
```

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Electron | v33 | Desktop shell |
| React | v18 | UI framework |
| TypeScript | v5 | Type safety |
| Vite | v5 | Build tool + dev server |
| Tailwind CSS | v3 | Styling |
| Zustand | v5 | State management |
| keytar | v7 | OS Keychain access |
| electron-builder | v25 | App packaging |

---

## 🐛 Troubleshooting

### "Keychain not available"
```bash
npm run rebuild
```
keytar needs to be compiled for your Electron version.

### App shows blank screen
Make sure Vite is running: `npm run dev:vite` in one terminal, then `npm run dev:electron` in another.

### API key not saving
Check macOS Keychain Access or Windows Credential Manager — look for service "Lotus".

### Build fails on Windows
Make sure you have Visual Studio Build Tools installed for native modules.

---

## 📄 License

MIT — Free to use, modify, and distribute.
