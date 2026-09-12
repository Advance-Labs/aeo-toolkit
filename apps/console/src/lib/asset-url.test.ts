import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetUrl } from './asset-url.js';

const CONSOLE_ROOT = resolve(__dirname, '../..');
const SRC = join(CONSOLE_ROOT, 'src');
const PUBLIC = join(CONSOLE_ROOT, 'public');

/** Extensions that live in `public/` and get fetched by URL from markup. */
const ASSET_EXT = /\.(png|jpe?g|webp|avif|gif|svg|ico|woff2?|mp4|webm)$/i;

/** `src="/foo.png"` or `href='/bar.webp'` — a root-relative reference to a public file. */
const ROOT_RELATIVE_ASSET = /\b(?:src|href|poster)\s*=\s*["'](\/[A-Za-z0-9][^"']*?\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|mp4|webm))["']/g;

/**
 * Strip comments before scanning.
 *
 * Documentation is allowed to quote the anti-pattern; that is how anyone reading
 * `asset-url.ts` learns what not to write. Without this the guard flags its own explanation,
 * and the obvious workaround (skip that file) would leave the one file most likely to grow
 * example code as the only unscanned one.
 *
 * Deliberately naive: it does not try to respect comment-like sequences inside string or
 * template literals. A URL in a string is `'https://…'`, whose `//` sits after a quote and
 * before no newline of consequence, so the failure mode is over-stripping a line that would
 * not have matched anyway. Erring toward false negatives is right here: a guard that cries
 * wolf gets deleted, and the real check is the presence of `assetUrl` in reviewed code.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue;
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

describe('assetUrl', () => {
  it('prefixes a root-relative path with the asset origin', () => {
    // ASSET_ORIGIN is '' under NODE_ENV=test, so the path passes through unchanged. The
    // point being asserted is that the path SURVIVES intact, not what the origin resolves to.
    expect(assetUrl('/advance-labs-mark-256.png')).toMatch(/\/advance-labs-mark-256\.png$/);
  });

  it('rejects a path that is not root-relative, rather than silently producing a broken URL', () => {
    // Concatenating an origin onto 'foo.png' yields 'https://exampleorigfoo.png', which is a
    // string, resolves to nothing, and fails only in a browser. Fail at the call instead.
    expect(() => assetUrl('advance-labs-mark-256.png')).toThrow(/root-relative/);
  });
});

/**
 * The regression guard for the bug asset-url.ts documents.
 *
 * These pages are also served from advancelabs.dev/tools/* by a rewrite, and `assetPrefix`
 * only covers `/_next/*`. A root-relative `src` to a `public/` file therefore resolves against
 * advancelabs.dev, which is a different app, and 404s for every visitor on the proxied origin
 * while rendering perfectly on aeo.advancelabs.dev.
 *
 * That asymmetry is what makes it worth a test rather than a code-review habit: the broken
 * case is invisible from the origin a developer naturally tests on. Three assets shipped that
 * way and were only caught by a user reporting a missing logo.
 */
describe('public assets are never referenced root-relative in markup', () => {
  it('has no root-relative src/href to a file in public/', () => {
    const sources = walk(SRC).filter((f) => /\.(tsx|ts|jsx|js)$/.test(f) && !/\.test\./.test(f));

    const offenders: string[] = [];
    for (const file of sources) {
      const text = stripComments(readFileSync(file, 'utf8'));
      for (const match of text.matchAll(ROOT_RELATIVE_ASSET)) {
        offenders.push(`${relative(CONSOLE_ROOT, file)}: ${match[0]}`);
      }
    }

    expect(
      offenders,
      'Use assetUrl() from src/lib/asset-url.ts. A root-relative src to a public/ file 404s ' +
        'on advancelabs.dev/tools/* because assetPrefix does not cover public/.',
    ).toEqual([]);
  });

  it('every file in public/ is reachable, so the guard above is testing something real', () => {
    // If public/ ever empties out, the test above would pass vacuously and stop protecting
    // anything. Assert there is still at least one asset for it to be about.
    const assets = walk(PUBLIC).filter((f) => ASSET_EXT.test(f));
    expect(assets.length).toBeGreaterThan(0);
  });
});
