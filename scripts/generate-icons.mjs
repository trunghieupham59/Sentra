#!/usr/bin/env node
/**
 * Script generate icons từ SVG logo
 * - logo-have-background.svg → macOS, Windows icons (white background)
 * - logo-remove-background.svg → Chrome Extension icons (transparent)
 *
 * Requires: rsvg-convert (brew install librsvg), ImageMagick (brew install imagemagick)
 */
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function run(cmd) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: 'pipe' });
}

// Check required tools
try {
  execSync('which rsvg-convert', { stdio: 'pipe' });
} catch(e) {
  console.error('❌ rsvg-convert not found. Install with: brew install librsvg');
  process.exit(1);
}

console.log('\n🖼️  Rendering SVGs with rsvg-convert...\n');

const masterWithBg = '/tmp/lotus_master_1024.png';
const masterTransparent = '/tmp/lotus_master_transparent.png';

// Render logo-have-background.svg at 2x size, then trim white & scale to fill icon
const renderedLarge = '/tmp/lotus_rendered_large.png';
const renderedTrimmed = '/tmp/lotus_rendered_trimmed.png';
run(`rsvg-convert -w 2048 -h 2048 --keep-aspect-ratio "${join(ROOT, 'logo-have-background.svg')}" -o "${renderedLarge}"`);
console.log('✓ Rendered logo-have-background.svg → 2048px (large)');

// Trim excess white borders (auto-trim based on border color)
run(`magick "${renderedLarge}" -background white -trim +repage "${renderedTrimmed}"`);
console.log('✓ Trimmed white borders');

// Create macOS squircle-shaped icon (corner radius ~22% = 229px for 1024px)
// Apple Big Sur+ icon standard: colored/white squircle background + logo centered
const squircleMask = '/tmp/lotus_squircle_mask.png';
const squircleWhite = '/tmp/lotus_squircle_white.png';

// Step 1: Create squircle mask (rounded rectangle with 229px corner radius)
// Squircle standard macOS Big Sur+ - transparent outside, white inside
run(`magick -size 1024x1024 xc:none -fill white -draw "roundrectangle 0,0 1023,1023 229,229" "${squircleMask}"`);
console.log('✓ Squircle mask created (229px corner radius)');

// Step 2: Place logo on white 1024x1024 background
const logoOnWhite = '/tmp/lotus_logo_on_white.png';
run(`magick -size 1024x1024 xc:white \\( "${renderedTrimmed}" -resize 780x780 \\) -gravity center -composite "${logoOnWhite}"`);

// Step 3: Apply squircle mask (CopyOpacity) → transparent corners, blue logo visible
run(`magick "${logoOnWhite}" "${squircleMask}" -compose CopyOpacity -composite "${masterWithBg}"`);
console.log('✓ Master 1024x1024 (squircle shape, transparent corners, colors preserved)');

// Create transparent version from rendered+trimmed SVG (remove white background)
// This is more reliable than logo-remove-background.svg (which has raw dark bg)
run(`magick "${renderedTrimmed}" -fuzz 5% -transparent white "${masterTransparent}"`);
console.log('✓ Created transparent version (removed white from rendered SVG)');

// Verify sizes
try {
  const s1 = execSync(`magick identify -format "%wx%h" "${masterWithBg}"`).toString().trim();
  const s2 = execSync(`magick identify -format "%wx%h" "${masterTransparent}"`).toString().trim();
  console.log(`  → With-bg size: ${s1}, Transparent size: ${s2}`);
} catch(e) {}

console.log('\n📦 Generating macOS icons...\n');

// build/icon.png (1024x1024)
run(`magick "${masterWithBg}" "${join(ROOT, 'build/icon.png')}"`);
console.log('✓ build/icon.png');

// build/icon-mac.png (1024x1024)
run(`magick "${masterWithBg}" "${join(ROOT, 'build/icon-mac.png')}"`);
console.log('✓ build/icon-mac.png');

// build/icon-win.png (256x256)
run(`magick "${masterWithBg}" -resize 256x256 "${join(ROOT, 'build/icon-win.png')}"`);
console.log('✓ build/icon-win.png');

// === macOS iconset ===
const iconsetDir = join(ROOT, 'build/icon.iconset');
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
];

for (const [filename, size] of iconsetSizes) {
  run(`magick "${masterWithBg}" -resize ${size}x${size} "${join(iconsetDir, filename)}"`);
  console.log(`✓ icon.iconset/${filename} (${size}x${size})`);
}

console.log('\n🍎 Generating icon.icns (macOS)...\n');
try {
  run(`iconutil -c icns "${iconsetDir}" -o "${join(ROOT, 'build/icon.icns')}"`);
  console.log('✓ build/icon.icns');
} catch(e) {
  console.error('⚠️  iconutil failed:', e.message);
}

console.log('\n🪟 Generating icon.ico (Windows)...\n');
const winSizes = [16, 24, 32, 48, 64, 128, 256];
const winPngs = winSizes.map(s => {
  const tmp = `/tmp/lotus_win_${s}.png`;
  run(`magick "${masterWithBg}" -resize ${s}x${s} "${tmp}"`);
  return tmp;
});
run(`magick ${winPngs.join(' ')} "${join(ROOT, 'build/icon.ico')}"`);
console.log('✓ build/icon.ico');

console.log('\n🌐 Generating Chrome Extension icons (transparent)...\n');

const extSizes = [
  ['icon16.png', 16],
  ['icon32.png', 32],
  ['icon48.png', 48],
  ['icon128.png', 128],
];

for (const [filename, size] of extSizes) {
  const outPath = join(ROOT, 'chrome-extension/icons', filename);
  // Trim, resize keeping aspect ratio, center in square canvas
  run(`magick "${masterTransparent}" -trim +repage -resize ${size}x${size} -background none -gravity center -extent ${size}x${size} "${outPath}"`);
  console.log(`✓ chrome-extension/icons/${filename} (${size}x${size})`);
}

console.log('\n🏠 Generating public/ icons...\n');

// public/icon.png → white background (for Electron window icon / browser tab)
run(`magick "${masterWithBg}" -resize 512x512 "${join(ROOT, 'public/icon.png')}"`);
console.log('✓ public/icon.png (white bg, for Electron)');

// public/logo.png → transparent background (for in-app AppLogo component in sidebar)
// Trim transparent logo, resize proportionally to 80% of 512, center on 512x512 transparent canvas
const logoTrimmed = '/tmp/lotus_logo_trimmed.png';
run(`magick "${masterTransparent}" -trim +repage "${logoTrimmed}"`);
run(`magick "${logoTrimmed}" -resize 410x410 -background none -gravity center -extent 512x512 "${join(ROOT, 'public/logo.png')}"`);
console.log('✓ public/logo.png (transparent, for in-app AppLogo)');

console.log('\n✅ All icons generated successfully!\n');
