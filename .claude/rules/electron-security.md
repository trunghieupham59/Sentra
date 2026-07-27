---
paths:
  - "electron/**/*.ts"
  - "src/web-preview/**/*.ts"
  - "chrome-extension/**/*.{js,json,html,css}"
---

# Electron and Integration Security

- Keep privileged operations in Electron main and expose only narrow, typed
  preload APIs.
- Validate IPC inputs and return structured errors; do not leak credentials.
- Do not enable Node integration or weaken context isolation/sandboxing.
- Web-preview mocks must preserve the preload API contract and must not become
  a production privilege path.
- Extension permissions and external origins must remain minimal and explicit.
