import { notarize } from '@electron/notarize';

/**
 * Notarize the macOS app after signing.
 * Skips if:
 * - Not on darwin platform
 * - APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID env vars are not set
 * - App is not code-signed (CSC_IDENTITY_AUTO_DISCOVERY=false and no CSC_LINK provided)
 */
export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log('Skipping notarization: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, or APPLE_TEAM_ID not set.');
    return;
  }

  // Skip notarization if code signing is disabled or no certificate provided
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false' && !process.env.CSC_LINK) {
    console.log('Skipping notarization: app is not code-signed (no CSC_LINK and CSC_IDENTITY_AUTO_DISCOVERY=false).');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Notarizing ${appPath}...`);

  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });

  console.log('Notarization complete.');
}
