/**
 * Standalone app icon — used in Sidebar and Settings.
 * Uses the actual logo image from public/logo.png
 * Note: We use import.meta.env.BASE_URL so the path works correctly in both
 * Vite dev server (base = '/') and Electron production build (base = './').
 */
export type AppLogoSize = 'sm' | 'md' | 'lg' | number

export function AppLogoIcon({ size = 'md' }: { size?: AppLogoSize }) {
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`
  const semanticSize = typeof size === 'string' ? size : null
  return (
    <img
      src={logoSrc}
      alt=""
      aria-hidden="true"
      width={semanticSize ? undefined : size}
      height={semanticSize ? undefined : size}
      className={`app-logo${semanticSize ? ` app-logo--${semanticSize}` : ''}`}
      draggable={false}
    />
  )
}
