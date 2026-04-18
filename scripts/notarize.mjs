/**
 * macOS Notarization Script
 *
 * Được gọi tự động bởi electron-builder sau khi sign app (afterSign hook).
 *
 * Yêu cầu:
 *   - Apple Developer Account (https://developer.apple.com)
 *   - Developer ID Application certificate (cài trong Keychain)
 *   - App-specific password từ https://appleid.apple.com
 *
 * Cấu hình các biến môi trường sau (trong .env hoặc CI/CD secrets):
 *   APPLE_ID          - Apple ID email của bạn
 *   APPLE_APP_PASSWORD - App-specific password (không phải password iCloud)
 *   APPLE_TEAM_ID     - Team ID từ https://developer.apple.com/account
 *
 * Nếu APPLE_ID không được set, script sẽ bỏ qua notarization
 * (hữu ích khi build local mà không có certificate).
 */

import { notarize } from "@electron/notarize";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Chỉ notarize trên macOS
  if (electronPlatformName !== "darwin") {
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;

  // Bỏ qua nếu chưa cấu hình (build local)
  if (!appleId || !appleIdPassword || !appleTeamId) {
    console.log(
      "⚠️  Bỏ qua notarization: Chưa cấu hình APPLE_ID / APPLE_APP_PASSWORD / APPLE_TEAM_ID"
    );
    console.log(
      "   → Người dùng có thể gặp lỗi 'app bị hỏng' khi mở trên macOS."
    );
    console.log(
      "   → Xem hướng dẫn tại: docs/MACOS_SIGNING.md"
    );
    return;
  }

  // Đọc productName từ package.json
  const pkg = JSON.parse(
    readFileSync(resolve(__dirname, "../package.json"), "utf8")
  );
  const appName = pkg.build.productName;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`🔏 Đang notarize: ${appPath}`);

  try {
    await notarize({
      appBundleId: pkg.build.appId,
      appPath,
      appleId,
      appleIdPassword,
      teamId: appleTeamId,
    });
    console.log("✅ Notarization thành công!");
  } catch (error) {
    console.error("❌ Notarization thất bại:", error);
    throw error;
  }
}
