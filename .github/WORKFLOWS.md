# GitHub Workflows & Automation

Tài liệu tổng quan về toàn bộ pipeline CI/CD và automation của Viezan, lưu tại
`.github/`.

## 🚦 Pipeline tổng quan

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PUSH / PULL REQUEST                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   lint   │  │ typecheck│  │   test   │  │ build x3 │  │  CodeQL  │  │
│  │ (Biome)  │  │ tsc x2   │  │ (Vitest) │  │ mac/win/ │  │ security │  │
│  │          │  │          │  │          │  │  linux   │  │          │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│        │             │             │             │                     │
│        └─────────────┴─────────────┴─────────────┘                     │
│                                  │                                     │
│                                  ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  PR-only: dependency-review · pr-title · labeler · size-label  │    │
│  └────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                          SCHEDULED / TAG                               │
│  • nightly.yml         (mỗi đêm — build artifact dev)                  │
│  • codeql.yml          (mỗi tuần — security audit)                     │
│  • stale.yml           (mỗi ngày — close stale issues/PRs)             │
│  • dependabot.yml      (mỗi tuần — npm + actions update)               │
│  • release.yml         (tag v*  — publish DMG/EXE/AppImage + CRX)      │
│  • release-extension.yml (tag ext-v* — chỉ Chrome extension ZIP)       │
│  • pages.yml           (push docs/** — deploy GitHub Pages)            │
└────────────────────────────────────────────────────────────────────────┘
```

## 📁 Cấu trúc thư mục `.github/`

| File                                       | Mục đích                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `workflows/ci.yml`                         | Lint (Biome) + TypeCheck + Vitest + build matrix mac/win/linux              |
| `workflows/codeql.yml`                     | Phân tích bảo mật JS/TS định kỳ + theo PR                                   |
| `workflows/dependency-review.yml`          | Chặn dependency có CVE / license không tương thích trong PR                 |
| `workflows/pr-title.yml`                   | Bắt buộc tiêu đề PR theo Conventional Commits                               |
| `workflows/labeler.yml`                    | Auto-gán nhãn theo path file + size PR                                      |
| `workflows/stale.yml`                      | Đóng issues/PRs không hoạt động                                             |
| `workflows/nightly.yml`                    | Build dev nightly cho cả 3 OS — không publish, upload artifact 14 ngày      |
| `workflows/release.yml`                    | **(đã có)** Tag `v*` → build & publish DMG/EXE/AppImage + CRX               |
| `workflows/release-extension.yml`          | **(đã có)** Tag `ext-v*` → đóng gói Chrome extension ZIP                    |
| `workflows/pages.yml`                      | **(đã có)** Deploy `docs/` lên GitHub Pages                                 |
| `labeler.yml`                              | Định nghĩa rule cho `actions/labeler`                                       |
| `dependabot.yml`                           | Cập nhật npm + GitHub Actions hàng tuần (theo group)                        |
| `release.yml`                              | Cấu hình "auto-generated release notes" của GitHub                          |
| `CODEOWNERS`                               | Auto request review                                                         |
| `FUNDING.yml`                              | Nút Sponsor                                                                 |
| `pull_request_template.md`                 | Template PR                                                                 |
| `ISSUE_TEMPLATE/config.yml`                | Tắt blank issue + redirect Discussions / Security                           |
| `ISSUE_TEMPLATE/bug_report.yml`            | Form báo bug                                                                |
| `ISSUE_TEMPLATE/feature_request.yml`       | Form đề xuất feature                                                        |
| `ISSUE_TEMPLATE/question.yml`              | Form câu hỏi                                                                |

## 🔐 Secrets & Variables cần khai báo trong repo

> **Settings → Secrets and variables → Actions**

### Secrets (bắt buộc khi release)

| Secret                           | Dùng ở đâu                          | Bắt buộc                |
| -------------------------------- | ----------------------------------- | ----------------------- |
| `GITHUB_TOKEN`                   | (auto)                              | ✅                       |
| `APPLE_ID`                       | `release.yml` — notarize macOS      | ✅ (bản notarized)       |
| `APPLE_APP_SPECIFIC_PASSWORD`    | `release.yml` — notarize macOS      | ✅ (bản notarized)       |
| `SIGNPATH_API_TOKEN`             | `release.yml` — sign Windows        | ⛔ (optional fallback)   |
| `CHROME_EXTENSION_PEM_BASE64`    | `release.yml` — pack CRX            | ✅ (chỉ khi pack CRX)    |

### Variables

| Variable                         | Dùng ở đâu                          |
| -------------------------------- | ----------------------------------- |
| `APPLE_TEAM_ID`                  | `release.yml`                       |
| `SIGNPATH_ORGANIZATION_ID`       | `release.yml`                       |

## 🏷️ Quy ước Conventional Commits

Tiêu đề PR và commit nên theo dạng:

```
<type>(<scope>): <subject viết thường>
```

Các `type` được chấp nhận: `feat`, `fix`, `hotfix`, `patch`, `revert`, `improve`,
`enhance`, `update`, `refactor`, `perf`, `chore`, `style`, `docs`, `test`, `ci`,
`build`, `deps`, `security`.

Ví dụ:

- `feat(translate): add streaming response`
- `fix(electron): handle keychain missing on linux`
- `chore(deps): bump electron to 41.2.1`

## 🚀 Quy trình release

```bash
# 1) App release (DMG / EXE / AppImage / latest.yml + CRX)
git tag v2.1.0
git push origin v2.1.0

# 2) Chỉ ship lại Chrome extension (không build app)
git tag ext-v2.1.0
git push origin ext-v2.1.0
```

Trong cả hai trường hợp, `release.yml` / `release-extension.yml` sẽ tự build và
upload artifact lên GitHub Releases tương ứng.

## 🌙 Nightly build

- Chạy tự động lúc 01:00 sáng (giờ VN) trên branch `develop`.
- Hoặc trigger thủ công: **Actions → Nightly Build → Run workflow** và nhập
  branch / commit muốn build.
- Artifact lưu 14 ngày trong tab Actions, không tạo GitHub Release.

## 🤖 Dependabot — chiến lược group

- React + types: gom 1 PR.
- Vite + Vitest + plugin Vite: gom 1 PR.
- Electron + electron-builder + electron-updater: gom 1 PR.
- AI providers (Anthropic, Google GenAI, OpenAI): gom 1 PR.
- Testing tools, build tooling: mỗi nhóm 1 PR.
- Major bump của `electron`, `react`, `react-dom` bị **bỏ qua** — phải nâng tay.
- GitHub Actions cũng được bump theo tuần (gom toàn bộ vào 1 PR).
