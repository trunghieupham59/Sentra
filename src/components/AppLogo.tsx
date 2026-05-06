/**
 * Standalone app icon — used in Sidebar and Settings.
 * Uses the actual logo image from public/logo.png
 * Note: We use import.meta.env.BASE_URL so the path works correctly in both
 * Vite dev server (base = '/') and Electron production build (base = './').
 */
export function AppLogoIcon({ size = 64 }: { size?: number }) {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`
  return (
    <img
      src={logoSrc}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ objectFit: 'contain', filter: 'grayscale(1) contrast(1.08)' }}
      draggable={false}
    />
  )
}
