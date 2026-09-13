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
 *
 * WHY THE ICONS CARRY A DARK GROUND
 * ---------------------------------
 * The mark is the off-white Advance Labs sphere on transparency (see
 * brand/README.md). Measured on the 128px raster it is 56.7% transparent with a
 * mean luminance of 155/255 across its opaque pixels — a light-grey object with
 * no outline. Chrome renders extension icons on backgrounds we do not control:
 * the Chrome Web Store listing card is white, and so is the light-mode toolbar.
 * On white the sphere is very nearly invisible; only its interior shading reads.
 *
 * So these icons composite the sphere onto the brand ground (#0A0A0B) as a
 * rounded tile. This is not a new brand direction — brand/README.md already
 * ships `logo-dark-preview.png`, "the dark lockup composited on the #0A0A0B
 * ground, for previews", for exactly this reason. An app icon is the same
 * problem: a context that cannot guarantee a dark background.
 */
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const svgPath = resolve(root, 'src/icons/icon.svg');
const outDir = resolve(root, 'public/icons');

/** The brand ground. Ships as `--bg` / `--v2-bg` in the console. */
const GROUND = '#0A0A0B';

/** Corner radius as a fraction of tile width — 28/128 at the reference size. */
const RADIUS_RATIO = 28 / 128;

/**
 * How much of the tile the sphere occupies, per size.
 *
 * The brand guide asks for clear space of at least a quarter of the mark's
 * width, which is the 0.64 figure — and it also sets the mark's minimum size at
 * 16px. Those two rules cannot both hold on a small tile: 0.64 of a 16px icon
 * is a 10px sphere, under the mark's own floor. Clear space is the rule that
 * gives, because it is a breathing-room preference, while legibility is a
 * functional requirement. So the inset tightens as the tile shrinks — standard
 * optical scaling, the same reason favicons are drawn heavier than logos.
 *
 * 16/48/128 back the manifest `icons` map + `action.default_icon`; 32 is the
 * extra size the Chrome Web Store listing uses (see CHROME_STORE.md).
 */
const SIZES = {
  128: 0.64, // store listing + install dialog. Full guide clear space.
  48: 0.64, // extensions management page. Still roomy enough.
  32: 0.78, // store listing thumbnail. Clear space yields to legibility.
  16: 0.88, // toolbar. Effectively full-bleed; at this size it reads as a dot.
};

/** A rounded rectangle of the brand ground, as an SVG buffer for sharp. */
function groundTile(size) {
  const radius = Math.round(size * RADIUS_RATIO);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${radius}" fill="${GROUND}"/>` +
      `</svg>`,
  );
}

async function main() {
  const svg = await readFile(svgPath);
  await mkdir(outDir, { recursive: true });

  await Promise.all(
    Object.entries(SIZES).map(async ([rawSize, ratio]) => {
      const size = Number(rawSize);
      const mark = Math.round(size * ratio);
      // Round the offset down so any odd leftover pixel sits bottom-right,
      // where it reads as optical centring rather than a visible shift.
      const offset = Math.floor((size - mark) / 2);

      const sphere = await sharp(svg, { density: 384 })
        .resize(mark, mark, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      const out = resolve(outDir, `icon-${size}.png`);
      await sharp(groundTile(size))
        .composite([{ input: sphere, top: offset, left: offset }])
        .png()
        .toFile(out);

      console.log(`generated ${out} (sphere ${mark}px on ${size}px ground)`);
    }),
  );
}

main().catch((error) => {
  console.error('icon generation failed:', error);
  process.exitCode = 1;
});
