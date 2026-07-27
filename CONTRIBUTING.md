# Contributing to Viezan Translate

## Development Setup

```bash
# 1. Fork & clone repository
git clone https://github.com/trunghieupham59/Viezan-translate.git
cd Viezan-translate

# 2. Install dependencies
npm install

# 3. Rebuild native modules for your Electron version
npm run rebuild

# 4. Start development server + Electron
npm run dev
```

## Project Structure

```
Viezan/
├── electron/                 # Main process (Node.js / Electron)
│   ├── main.ts               # App entry point, window management
│   ├── preload.ts            # Context bridge (IPC bindings)
│   └── ipc/                  # IPC handlers (one file per feature)
│       ├── keychain.ts       # Secure API key storage
│       ├── translate.ts      # Text translation
│       ├── imageTranslate.ts # Image/vision translation
│       ├── transcribe.ts     # Speech-to-text (Whisper)
│       ├── tts.ts            # Text-to-speech
│       ├── chat.ts           # AI chat
│       ├── models.ts         # Available model listing
│       └── storage.ts        # Local data persistence
└── src/                      # Renderer process (React)
    ├── pages/                # Full-page components
    ├── components/           # Atomic UI layers + feature components
    │   ├── ui/atoms/         # Primitive reusable controls and icons
    │   ├── ui/molecules/     # Small props-driven compositions
    │   ├── organisms/        # App/feature sections
    │   └── templates/        # Layout-only page shells
    ├── hooks/                # Custom React hooks
    ├── store/                # Zustand global state
    ├── constants/            # Config & static data
    ├── i18n/                 # UI translations (EN/VI/JA)
    ├── types/                # TypeScript type definitions
    └── utils/                # Pure utility functions (testable)
```

## Adding a New AI Provider

1. Add provider config to `src/constants/providers.ts` (follow `ProviderConfig` interface)
2. Implement IPC handler in `electron/ipc/` (follow existing pattern)
3. Register handler in `electron/main.ts`
4. Add types to `src/types/index.ts` if needed
5. Update `keyStatus` initial state in `src/store/useAppStore.ts`

## Adding a New UI Language

1. Add locale code to `AppLocale` type in `src/i18n/index.ts`
2. Add translation object implementing the full `Translations` interface
3. Add locale name to `LOCALE_NAMES`
4. Add to `SUPPORTED_LOCALES` in `src/utils/locale.ts`

## Running Tests

```bash
npm test              # Run all tests (watch mode)
npm run test:ui       # Open Vitest UI
npm run test:coverage # Coverage report
```

## Code Style

- **Formatter:** Biome — run `npx biome check src/` before committing
- **TypeScript:** Strict mode enabled. No `any` unless strictly necessary (add comment explaining why)
- **Naming:** `camelCase` for variables/functions, `PascalCase` for components/types, `SCREAMING_SNAKE_CASE` for module-level constants
- **Components:** Keep files under ~400 lines. Extract hooks and sub-components when they grow larger.

## Commit Convention

```
type(scope): short description

feat(translate): add rewrite button for source text
fix(live): limit transcript buffer size to prevent memory growth
refactor(settings): split into sub-section components
test(utils): add hallucination filter unit tests
docs: update CONTRIBUTING.md
```

Types: `feat` | `fix` | `refactor` | `test` | `docs` | `chore` | `perf` | `style`

## Pull Request Checklist

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] New public functions have JSDoc comments
- [ ] Pure utility functions have corresponding unit tests in `src/utils/__tests__/`
- [ ] UI strings use the i18n system (`useT()` hook), not hard-coded text
- [ ] No `any` types without explanation comment
- [ ] `biome check` passes

## Security Notes

- **Never hard-code API keys** — always use the OS Keychain via `window.api.keychain`
- **Never access Node.js directly from renderer** — use the IPC bridge (`window.api`)
- New IPC handlers must validate their inputs before processing
