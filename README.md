# 🌐 TranslateApp

> Local AI Translation App — macOS & Windows  
> Uses Google Gemini, Anthropic Claude, or OpenAI GPT APIs  
> API Keys stored **only** in OS Keychain — 100% private, no backend server

---

## ✨ Features

- 🤖 **Multiple AI Providers**: Google Gemini, Anthropic Claude, OpenAI GPT
- 🔒 **Secure Key Storage**: API keys stored in macOS Keychain / Windows Credential Manager
- ⚡ **Auto Translate**: Automatically translates as you type (debounced)
- 🔄 **Language Swap**: Swap source/target languages instantly
- 📋 **One-tap Copy**: Copy translation result
- 🌍 **20+ Languages**: Vietnamese, English, Chinese, Japanese, Korean, and more
- 🎨 **Native Desktop**: Electron app for macOS (.dmg) and Windows (.exe)

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

## 📦 Build for Distribution

### macOS (.dmg — Universal: Intel + Apple Silicon)
```bash
npm run build:mac
# Output: release/TranslateApp-1.0.0.dmg
```

### Windows (.exe — NSIS Installer)
```bash
npm run build:win
# Output: release/TranslateApp-Setup-1.0.0.exe
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
1. Open TranslateApp
2. Click **Settings** (⚙) in the top-right
3. Paste your API key in the relevant section
4. Click **Save Key**
5. Key is stored in OS Keychain — not in any file

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
translate-app/
├── DESIGN.md              # Full design document
├── README.md              # This file
├── package.json
├── tsconfig.json          # React/Vite TypeScript config
├── tsconfig.electron.json # Electron main process TypeScript config
├── vite.config.ts
├── tailwind.config.js
│
├── electron/              # Electron Main Process (Node.js)
│   ├── main.ts           # App entry, window creation
│   ├── preload.ts        # contextBridge API
│   └── ipc/
│       ├── keychain.ts   # OS Keychain operations via keytar
│       └── translate.ts  # AI API calls (Gemini/Claude/OpenAI)
│
└── src/                   # React Renderer (Browser)
    ├── App.tsx
    ├── pages/
    │   ├── TranslatePage.tsx
    │   └── SettingsPage.tsx
    ├── components/
    │   ├── Navbar.tsx
    │   ├── LanguageSelector.tsx
    │   ├── ModelSelector.tsx
    │   └── ApiKeyInput.tsx
    ├── store/
    │   └── useAppStore.ts  # Zustand state (settings persisted)
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
Check macOS Keychain Access or Windows Credential Manager — look for service "TranslateApp".

### Build fails on Windows
Make sure you have Visual Studio Build Tools installed for native modules.

---

## 📄 License

MIT — Free to use, modify, and distribute.
