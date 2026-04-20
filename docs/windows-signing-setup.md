# Hướng dẫn ký số Windows miễn phí với SignPath.io

Dự án sử dụng **[SignPath.io](https://signpath.io)** — dịch vụ ký số **hoàn toàn miễn phí** dành cho các dự án open source. SignPath cung cấp certificate Authenticode được Windows SmartScreen tin tưởng.

---

## ✅ Tại sao dùng SignPath.io?

| Tiêu chí | SignPath.io (OSS) |
|---|---|
| Chi phí | **Miễn phí** cho open source |
| Certificate | Authenticode (tin cậy bởi Windows) |
| Tích hợp | GitHub Actions native |
| Yêu cầu | Repo phải public trên GitHub |

---

## 🚀 Hướng dẫn thiết lập (một lần duy nhất)

### Bước 1 — Đăng ký tài khoản SignPath.io

1. Truy cập **https://signpath.io** → chọn **"Get Started for Free"**
2. Chọn plan **"Open Source"** (miễn phí)
3. Đăng ký bằng tài khoản GitHub của bạn
4. Sau khi xác nhận email, vào **Dashboard**

---

### Bước 2 — Tạo Organization

1. Tạo organization mới (ví dụ: `sentra` hoặc tên tổ chức của bạn)
2. Ghi lại **Organization ID** (hiển thị trong URL: `https://app.signpath.io/web/Organizations/<ORGANIZATION_ID>`)
3. Lưu Organization ID vào GitHub Secret:
   - GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `SIGNPATH_ORGANIZATION_ID`
   - Value: _(Organization ID từ bước trên)_

---

### Bước 3 — Tạo Project

1. Trong SignPath Dashboard → **Projects** → **Add project**
2. **Project name:** `Sentra`
3. **Project slug:** `sentra` ← phải khớp chính xác với workflow
4. Nhấn **Create**

---

### Bước 4 — Lấy file mẫu để cấu hình Artifact Configuration

Chạy workflow helper để build file mẫu:

1. GitHub repo → **Actions** → **"Build Windows Sample (for SignPath setup)"** → **Run workflow**
2. Chờ ~5–10 phút, sau đó vào run vừa chạy → **Artifacts** → download **"windows-sample-bundle"**
3. Giải nén → bạn sẽ thấy: installer `.exe`, các file `.dll`, `electron.exe`, v.v.

---

### Bước 5 — Cấu hình Artifact Configuration

1. Vào project `sentra` → **Artifact Configurations** → **Add artifact configuration**
2. **Name:** `Windows Installer`
3. **Slug:** `windows-installer` ← phải khớp chính xác với workflow
4. Chọn tab **"Edit XML"** và paste nội dung từ `build/signpath-artifact-config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<artifact-configuration xmlns="http://signpath.io/artifact-configuration/v1">
  <zip-file>
    <pe-image path-regex="[^/]*\.exe">
      <authenticode-sign/>
    </pe-image>
    <pe-image path-regex="[^/]*\.dll">
      <authenticode-sign/>
    </pe-image>
  </zip-file>
</artifact-configuration>
```

5. Nhấn **Save**

---

### Bước 6 — Tạo Certificate (dành cho OSS)

1. Vào **Certificates** → **Add certificate**
2. Chọn **"Request from SignPath"** (KHÔNG chọn "Create self-signed")
3. Điền thông tin:
   - **Common Name:** `Sentra`
   - **Organization:** _(tên tổ chức)_
   - **Country:** `VN`
4. Submit và chờ phê duyệt (thường 1–3 ngày làm việc)

> ⚠️ **Lưu ý:** Sau khi được phê duyệt, SignPath sẽ gửi email xác nhận. Certificate sẽ có Issuer là `SignPath...` (không phải self-signed).

---

### Bước 7 — Tạo Signing Policy

1. Vào project `sentra` → **Signing Policies** → **Add signing policy**
2. **Name:** `Release Signing`
3. **Slug:** `release-signing` ← phải khớp chính xác với workflow
4. **Certificate:** chọn certificate vừa được approve ở Bước 6
5. **Artifact configuration:** chọn `windows-installer`
6. **Authorized signers:** thêm tài khoản của bạn
7. Nhấn **Save**

---

### Bước 8 — Kết nối GitHub Repository

1. Vào project `sentra` → **Trusted Build Systems** → **Add trusted build system**
2. Chọn **GitHub Actions**
3. **Repository:** `trunghieupham59/Sentra`
4. **Signing policy:** chọn `release-signing`
5. Nhấn **Save**

---

### Bước 9 — Lấy API Token

1. Vào **Account Settings** (icon góc trên phải) → **API Tokens**
2. **Add API token** → đặt tên (ví dụ: `github-actions`)
3. Copy token được tạo ra
4. Thêm vào GitHub Secret:
   - Name: `SIGNPATH_API_TOKEN`
   - Value: _(API token vừa copy)_

---

## 🔑 Tóm tắt GitHub Secrets cần thiết

| Secret name | Mô tả | Bắt buộc |
|---|---|---|
| `SIGNPATH_API_TOKEN` | API token từ signpath.io | ✅ Windows |
| `SIGNPATH_ORGANIZATION_ID` | Organization ID từ signpath.io | ✅ Windows |
| `APPLE_ID` | Apple ID email | macOS only |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password | macOS only |
| `APPLE_TEAM_ID` | Apple Developer Team ID | macOS only |

---

## 🔄 Quy trình hoạt động

Khi push tag `v*` lên GitHub:

```
Push tag v1.x.x
      │
      ├─► create-release  (tạo GitHub Release)
      │
      ├─► build-mac       (build + Apple sign + notarize → upload)
      │
      └─► build-windows
              │
              ├── Build unsigned installer (.exe)
              ├── Pack installer + DLL/EXE → unsigned-bundle.zip
              ├── Upload ZIP as GitHub artifact
              ├── SignPath.io ký tất cả EXE + DLL trong ZIP
              ├── Download signed ZIP
              ├── Giải nén → lấy signed installer
              └── Upload signed .exe lên GitHub Release
```

---

## ❓ Câu hỏi thường gặp

### SmartScreen vẫn hiện cảnh báo sau khi ký?

Certificate mới chưa có đủ "reputation". SmartScreen học theo thời gian — sau vài trăm lượt tải không bị báo cáo, cảnh báo sẽ tự giảm.

### SignPath từ chối ký?

- Kiểm tra signing policy đã được approve chưa
- Kiểm tra GitHub repo đã được thêm vào Trusted Build Systems chưa
- Kiểm tra các slug trong workflow khớp với SignPath dashboard

### Build thất bại ở bước "Sign bundle"?

- Kiểm tra `SIGNPATH_API_TOKEN` và `SIGNPATH_ORGANIZATION_ID` đã được thêm chưa
- Đảm bảo `permissions: id-token: write` có trong workflow (đã có sẵn)

---

## 📚 Tài liệu tham khảo

- [SignPath.io Open Source Program](https://about.signpath.io/documentation/open-source-software-signing)
- [SignPath GitHub Action](https://github.com/SignPath/github-action-submit-signing-request)
- [Artifact Configuration Reference](https://about.signpath.io/documentation/artifact-configuration)
