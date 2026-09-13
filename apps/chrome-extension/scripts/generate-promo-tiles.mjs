/**
 * Generate the Chrome Web Store promotional images (small tile + marquee)
 * straight from the brand lockup — no overlaid text, no badges. The 2026-09-13
 * rejection ("Red Nickel": mimicking ranking/status) was caused by a
 * hand-made tile that had "Free" text baked into the image; Chrome treats
 * words like "free" / "new" / "#1" / "recommended" on listing art as faked
 * store status, regardless of whether they're true. Keep these tiles to the
 * brand mark + wordmark only.
 *
 * Run from the chrome-extension package root:
 *   node scripts/generate-promo-tiles.mjs
 *
 * Requires `sharp` (already a devDependency, used by generate-icons.mjs).
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const brandDir = resolve(root, '../../brand');
const outDir = resolve(root, 'store-assets');

const GROUND = '#0A0A0B';

// [name, width, height, logo-width-fraction-of-tile-width]
const TILES = [
  ['small-tile-440x280.png', 440, 280, 0.62],
  ['marquee-1400x560.png', 1400, 560, 0.5],
];

async function makeTile(name, width, height, logoFraction) {
  const logoPath = resolve(brandDir, 'logo-dark.png');
  const logo = sharp(logoPath);
  const meta = await logo.metadata();

  const logoWidth = Math.round(width * logoFraction);
  const logoHeight = Math.round((logoWidth / meta.width) * meta.height);

  const logoBuffer = await sharp(logoPath).resize(logoWidth, logoHeight).toBuffer();

  const out = resolve(outDir, name);
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: GROUND,
    },
  })
    .composite([
      {
        input: logoBuffer,
        left: Math.round((width - logoWidth) / 2),
        top: Math.round((height - logoHeight) / 2),
      },
    ])
    .png()
    .toFile(out);

  console.log(`generated ${out}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const [name, width, height, fraction] of TILES) {
    await makeTile(name, width, height, fraction);
  }
}

main().catch((error) => {
  console.error('promo tile generation failed:', error);
  process.exitCode = 1;
});
