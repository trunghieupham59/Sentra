import { notarize } from '@electron/notarize';

/**
 * Notarize the macOS app after signing.
 * Skips if APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD env vars are not set.
 */
export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.log('Skipping notarization: APPLE_ID or APPLE_APP_SPECIFIC_PASSWORD not set.');
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
