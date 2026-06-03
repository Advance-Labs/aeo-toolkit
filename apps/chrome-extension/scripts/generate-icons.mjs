/**
 * Rasterize the brand mark (src/icons/icon.svg) into the PNG toolbar / store
 * icons Chrome MV3 requires (SVG is not accepted for the action icon or the
 * store listing). Outputs into public/icons/, which CRXJS copies verbatim into
 * the build output (dist/icons/) so the manifest's icon paths resolve.
 *
 * Run from the chrome-extension package root:
 *   node scripts/generate-icons.mjs
 *
 * Requires `sharp` (a devDependency). The lead runs this once to produce the
 * PNGs; the manifest references them by path whether or not they exist yet.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const svgPath = resolve(root, 'src/icons/icon.svg');
const outDir = resolve(root, 'public/icons');

// 16/48/128 back the manifest `icons` map + `action.default_icon`; 32 is the
// extra size the Chrome Web Store listing uses (see CHROME_STORE.md).
const sizes = [16, 32, 48, 128];

async function main() {
  const svg = await readFile(svgPath);
  await mkdir(outDir, { recursive: true });

  await Promise.all(
    sizes.map(async (size) => {
      const out = resolve(outDir, `icon-${size}.png`);
      await sharp(svg, { density: 384 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(out);
      console.log(`generated ${out}`);
    }),
  );
}

main().catch((error) => {
  console.error('icon generation failed:', error);
  process.exitCode = 1;
});
