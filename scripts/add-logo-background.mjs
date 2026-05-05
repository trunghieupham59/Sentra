#!/usr/bin/env node
/**
 * Add white background to release icons / logo images.
 *
 * Per-target strategy:
 *   - build/icon-mac.png        : 1024×1024 white squircle (macOS Big Sur+ shape).
 *                                 The original artwork is composited inside the
 *                                 ~824px safe area so it matches Apple's HIG.
 *   - build/icon.icns           : Regenerated from build/icon-mac.png so every
 *                                 size embedded inside the ICNS shares the
 *                                 squircle background.
 *   - build/icon.iconset/*      : Same squircle artwork resampled per slot.
 *   - build/icon-win.png        : 256×256 solid white square (Windows taskbar
 *                                 / Start menu show square thumbnails).
 *   - build/icon.ico            : Multi-size ICO regenerated from the white
 *                                 square so every embedded size has the bg.
 *   - build/icon.png            : 1024×1024 squircle (used as Electron tray /
 *                                 Linux fallback icon — squircle still works
 *                                 on Linux desktops, white square would also
 *                                 be fine but squircle is friendlier).
 *
 * Note: `public/logo.png` and `public/icon.png` are intentionally NOT touched
 * by this script. They are rendered *inside* the app (Sidebar, Settings,
 * empty-state placeholders) where the surrounding background changes with the
 * app theme — a baked-in white background would create an obvious white box
 * around the logo on light-gray / dark surfaces. They stay fully transparent.
 * The favicon (`<link rel="icon" href="/logo.png">`) also benefits from
 * transparency on dark browser tabs.

 *
 * Idempotent: each run starts from the artwork stored in build/source/ if it
 * exists, otherwise it falls back to the current PNG (so re-running won't
 * keep stacking white backgrounds).
 */

import { execFileSync } from 'node:child_process'
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SOURCE_DIR = join(ROOT, 'build', 'source')

mkdirSync(SOURCE_DIR, { recursive: true })

/**
 * Pick the artwork source. If we already saved a transparent original under
 * build/source/<name>, reuse it. Otherwise treat the current file as the
 * original and snapshot it so subsequent runs are idempotent.
 *
 * Uses `O_CREAT | O_EXCL | O_WRONLY` to atomically create the snapshot file
 * if (and only if) it doesn't already exist. This avoids a TOCTOU race where
 * the file could be created or replaced between an `existsSync` check and
 * the subsequent write (CodeQL js/file-system-race).
 */
function ensureSource(rel) {
  const live = join(ROOT, rel)
  const snap = join(SOURCE_DIR, rel.replace(/[\\/]/g, '__'))

  let fd
  try {
    fd = openSync(
      snap,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
      0o600,
    )
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      // Snapshot already exists – nothing to do.
      return snap
    }
    throw err
  }

  // We exclusively created the snapshot file; populate it from the live file.
  // If reading the live file fails we remove the empty snapshot we just made
  // so the next run can retry cleanly.
  try {
    let data
    try {
      data = readFileSync(live)
    } catch (readErr) {
      if (readErr && readErr.code === 'ENOENT') {
        throw new Error(`Missing source file: ${rel}`)
      }
      throw readErr
    }
    writeSync(fd, data)
  } catch (err) {
    closeSync(fd)
    try {
      unlinkSync(snap)
    } catch {
      // Ignore cleanup failure – propagate the original error.
    }
    throw err
  }
  closeSync(fd)
  return snap
}

function magick(...args) {
  execFileSync('magick', args, { stdio: 'inherit' })
}

// ImageMagick auto-detects PNG color type from contents. When we draw a
// solid-white background it gets saved as Gray+Alpha, and any subsequent
// composite of a colored artwork onto a Gray canvas is silently down-converted
// to grayscale (this turned the colored Viezan logo into a B/W mask in the
// first run of the script). Forcing TrueColorAlpha + sRGB everywhere keeps
// every intermediate image RGBA and preserves the original blue tones.
const RGB_FLAGS = [
  '-colorspace',
  'sRGB',
  '-type',
  'TrueColorAlpha',
  '-define',
  'png:color-type=6',
]


/**
 * Compose a white squircle (macOS-style superellipse) PNG.
 *
 * macOS Big Sur+ icons use a rounded-square mask that sits inside ~824/1024
 * of the canvas. We approximate that with ImageMagick's roundrectangle which
 * is visually indistinguishable from the true superellipse at icon sizes.
 */
function buildSquircleBackground(size, outPath) {
  const inset = Math.round(size * 0.0977) // ≈100px on 1024 canvas → 824 safe area
  const radius = Math.round(size * 0.2237) // 22.37% – matches Apple template
  const x0 = inset
  const y0 = inset
  const x1 = size - inset
  const y1 = size - inset
  magick(
    '-size',
    `${size}x${size}`,
    'xc:none',
    '-fill',
    'white',
    '-draw',
    `roundrectangle ${x0},${y0} ${x1},${y1} ${radius},${radius}`,
    ...RGB_FLAGS,
    outPath,
  )
}

/**
 * Composite source artwork on top of a generated background.
 */
function composeOnBackground(sourcePath, backgroundPath, outPath, options = {}) {
  const { artworkScale = 0.78, canvasSize } = options
  const artworkSize = canvasSize ? Math.round(canvasSize * artworkScale) : null
  // Resize source to fit inside the safe area, then center-composite.
  const tempArt = `${outPath}.art.png`
  magick(
    sourcePath,
    '-resize',
    artworkSize ? `${artworkSize}x${artworkSize}` : `${Math.round(artworkScale * 100)}%`,
    ...RGB_FLAGS,
    tempArt,
  )
  magick(
    backgroundPath,
    tempArt,
    '-gravity',
    'center',
    '-composite',
    ...RGB_FLAGS,
    outPath,
  )
  // Cleanup
  execFileSync('rm', ['-f', tempArt])
}

/**
 * Place artwork on a solid white square (Windows / web favicons).
 */
function composeOnWhiteSquare(sourcePath, outPath, size, artworkScale = 0.86) {
  const bg = `${outPath}.bg.png`
  magick('-size', `${size}x${size}`, 'xc:white', ...RGB_FLAGS, bg)
  composeOnBackground(sourcePath, bg, outPath, { artworkScale, canvasSize: size })
  execFileSync('rm', ['-f', bg])
}

/**
 * Place artwork on a transparent canvas with a white squircle (macOS / tray).
 */
function composeOnSquircle(sourcePath, outPath, size, artworkScale = 0.78) {
  const bg = `${outPath}.bg.png`
  buildSquircleBackground(size, bg)
  composeOnBackground(sourcePath, bg, outPath, { artworkScale, canvasSize: size })
  execFileSync('rm', ['-f', bg])
}

// ─── 1. build/icon-mac.png – 1024 squircle ────────────────────────────────
const macSrc = ensureSource('build/icon-mac.png')
const macOut = join(ROOT, 'build/icon-mac.png')
composeOnSquircle(macSrc, macOut, 1024)
console.log('✓ build/icon-mac.png (1024 squircle)')

// ─── 2. build/icon.png – 1024 squircle (tray / linux fallback) ────────────
const iconSrc = ensureSource('build/icon.png')
const iconOut = join(ROOT, 'build/icon.png')
composeOnSquircle(iconSrc, iconOut, 1024)
console.log('✓ build/icon.png (1024 squircle)')

// ─── 3. build/icon.iconset/* – regenerate from build/icon-mac.png ─────────
const iconsetSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]
const iconsetDir = join(ROOT, 'build/icon.iconset')
mkdirSync(iconsetDir, { recursive: true })
for (const [name, size] of iconsetSizes) {
  const out = join(iconsetDir, name)
  magick(macOut, '-resize', `${size}x${size}`, ...RGB_FLAGS, out)
}
console.log('✓ build/icon.iconset/* regenerated')

// ─── 4. build/icon-win.png – 256 white square ─────────────────────────────
const winSrc = ensureSource('build/icon-win.png')
const winOut = join(ROOT, 'build/icon-win.png')
composeOnWhiteSquare(winSrc, winOut, 256)
console.log('✓ build/icon-win.png (256 white square)')

// ─── 5. build/icon.ico – multi-size, all white square ─────────────────────
const icoSizes = [16, 24, 32, 48, 64, 128, 256]
const icoTmpDir = join(SOURCE_DIR, 'ico-tmp')
mkdirSync(icoTmpDir, { recursive: true })
const icoLayers = []
for (const size of icoSizes) {
  const out = join(icoTmpDir, `${size}.png`)
  composeOnWhiteSquare(winSrc, out, size)
  icoLayers.push(out)
}
magick(...icoLayers, join(ROOT, 'build/icon.ico'))
console.log('✓ build/icon.ico (multi-size white square)')

// ─── 6. build/icon.icns – rebuild from iconset ────────────────────────────
const icnsOut = join(ROOT, 'build/icon.icns')
try {
  execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsOut], {
    stdio: 'inherit',
  })
  console.log('✓ build/icon.icns')
} catch (err) {
  if (!existsSync(icnsOut)) {
    throw err
  }
  console.warn('! iconutil failed; keeping existing build/icon.icns')
}

// public/logo.png and public/icon.png are intentionally left transparent —
// see the file header for the rationale.

console.log('\nRelease icons (build/) now have a white background.')
console.log('In-app logos (public/) were left transparent on purpose.')
