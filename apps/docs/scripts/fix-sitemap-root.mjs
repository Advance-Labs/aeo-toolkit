// Starlight's sitemap lists the docs home as ".../docs/aeo-toolkit/" even with trailingSlash: 'never',
// while its canonical is slashless and advancelabs.dev 308s the slashed form. Make them agree.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/sitemap-0.xml', import.meta.url);
const xml = readFileSync(file, 'utf8');
const fixed = xml.replace(/<loc>([^<]*?\/docs\/aeo-toolkit)\/<\/loc>/, '<loc>$1</loc>');
if (fixed === xml) throw new Error('fix-sitemap-root: home <loc> not found; did the base path change?');
writeFileSync(file, fixed);
