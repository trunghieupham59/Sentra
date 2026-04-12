/**
 * Standalone app icon — used in Sidebar and Settings.
 * Uses the actual logo image from public/logo.png
 */
export function AppLogoIcon({ size = 64 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Lotus App Logo Icon"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      draggable={false}
    />
  )
}
