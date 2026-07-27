# Verification Rules

- Start with focused tests for the changed behavior, then expand when shared
  atoms, stores, IPC, or routing are affected.
- Run changed-file Biome, renderer TypeScript, Electron TypeScript, and
  `npm run check:atomic` for UI architecture work.
- Use `npm test -- --run`; do not leave Vitest in watch mode.
- Run `npm run build` for shared/release-relevant changes and `npm run test:web`
  when web-preview behavior is touched.
- UI completion requires visual QA for empty/active/error/loading states and a
  relevant narrow width.
- Test semantic variant/state hooks and native disabled behavior; do not assert
  literal hex/RGB values.
- Report skipped checks and their reason; never claim a check passed when it
  was not run.
