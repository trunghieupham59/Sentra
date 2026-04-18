# Hướng dẫn Code Signing & Notarization cho macOS

## Vấn đề

Khi người dùng tải app từ internet và mở lần đầu, macOS Gatekeeper có thể hiển thị lỗi:

> **"T.R.E Assistant" bị hỏng và không thể mở được. Bạn nên di chuyển ứng dụng vào Thùng rác.**

Nguyên nhân: App chưa được **ký số (Code Signing)** và **xác thực với Apple (Notarization)**.

---

## 🚀 Giải pháp cho Người dùng (Tạm thời)

Mở **Terminal** và chạy lệnh sau để xóa cờ quarantine:

```bash
xattr -cr "/Applications/T.R.E Assistant.app"
```

Sau đó mở lại app bình thường.

---

## 🔐 Giải pháp cho Developer (Lâu dài)

### Bước 1: Đăng ký Apple Developer Account

1. Truy cập https://developer.apple.com/enroll/
2. Đăng ký tài khoản **$99/năm**
3. Lấy **Team ID** tại: https://developer.apple.com/account → Membership

### Bước 2: Tạo Developer ID Certificate

1. Mở **Xcode** → Settings → Accounts → Manage Certificates
2. Nhấn **+** → chọn **Developer ID Application**
3. Certificate sẽ được cài tự động vào Keychain

   *Hoặc* qua Apple Developer Portal:
   - https://developer.apple.com/account/resources/certificates/add
   - Chọn **Developer ID Application**
   - Download và double-click để cài vào Keychain

### Bước 3: Tạo App-Specific Password

1. Truy cập https://appleid.apple.com/account/manage
2. Vào **Sign-In and Security** → **App-Specific Passwords**
3. Tạo password mới, đặt tên ví dụ: `TRE-Assistant-Build`
4. **Lưu lại password này** (chỉ hiển thị 1 lần)

### Bước 4: Cấu hình biến môi trường

Tạo file `.env` ở thư mục gốc dự án (đã có trong `.gitignore`):

```bash
# .env
APPLE_ID=your-apple-id@email.com
APPLE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
```

Hoặc export trực tiếp trong terminal:

```bash
export APPLE_ID="your-apple-id@email.com"
export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

### Bước 5: Cài đặt dependencies

```bash
npm install
```

### Bước 6: Build & Release

```bash
# Build local (không publish)
npm run dist:mac

# Build và publish lên GitHub Releases
npm run release:mac
```

Quá trình notarization tự động sẽ:
1. ✅ Sign app bằng Developer ID certificate
2. ✅ Upload lên Apple Notary Service để kiểm tra
3. ✅ Staple notarization ticket vào app
4. ✅ App sẽ mở được trên mọi Mac mà không có cảnh báo

---

## 🔄 Cấu hình GitHub Actions (CI/CD)

Thêm các secrets sau vào GitHub repository:  
**Settings → Secrets and variables → Actions**

| Secret Name | Giá trị |
|-------------|---------|
| `APPLE_ID` | Apple ID email |
| `APPLE_APP_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Team ID từ Apple Developer |
| `CSC_LINK` | Base64-encoded .p12 certificate |
| `CSC_KEY_PASSWORD` | Password của .p12 certificate |

### Export certificate thành Base64:

```bash
# Export từ Keychain (thay YOUR_CERT_NAME)
security find-identity -v -p codesigning
# Copy tên certificate, ví dụ: "Developer ID Application: Your Name (TEAMID)"

# Export thành .p12
security export -t identities -f pkcs12 -o certificate.p12

# Encode thành Base64
base64 -i certificate.p12 | pbcopy
# (đã copy vào clipboard, paste vào GitHub Secret CSC_LINK)
```

---

## 🐛 Troubleshooting

### Lỗi "No identity found"
```
Error: No identity found for signing
```
→ Certificate chưa được cài vào Keychain, hoặc đã hết hạn.

### Lỗi "App-specific password is required"
```
Error: The application needs a valid app-specific password
```
→ Kiểm tra lại `APPLE_APP_PASSWORD` — phải là app-specific password, không phải iCloud password.

### Lỗi khi build local không có certificate
Bình thường! Script `notarize.mjs` sẽ tự động bỏ qua nếu không có env vars:
```
⚠️  Bỏ qua notarization: Chưa cấu hình APPLE_ID / APPLE_APP_PASSWORD / APPLE_TEAM_ID
```

---

## 📚 Tài liệu tham khảo

- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [electron-builder Code Signing](https://www.electron.build/code-signing)
- [@electron/notarize](https://github.com/electron/notarize)
