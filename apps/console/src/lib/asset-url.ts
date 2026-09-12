/**
 * Absolute URLs for files in `public/`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BUG THIS EXISTS TO PREVENT
 * ─────────────────────────────────────────────────────────────────────────────
 * These pages are also served from `advancelabs.dev/tools/*` by a rewrite in the marketing
 * app. `next.config.mjs` already sets an absolute `assetPrefix` so the proxied HTML fetches
 * `/_next/static/*` from this origin instead of from advancelabs.dev, where that path belongs
 * to a different Next build.
 *
 * `assetPrefix` does NOT cover `public/`. Next rewrites `/_next/*` and nothing else, so a
 * literal `src="/advance-labs-mark-256.png"` in JSX stays literal. Under the proxy the browser
 * resolves it against `advancelabs.dev`, which has no such file, and the image 404s while the
 * page around it renders perfectly.
 *
 * That shipped: the brand mark and both story images were invisible on advancelabs.dev/tools
 * and fine on aeo.advancelabs.dev, which is the failure mode most likely to survive review,
 * because whoever is testing is usually on the canonical origin where everything works.
 *
 * The trigger was subtle. Before the September 2026 revamp the mark was `@advance-labs/ui`'s
 * `Logo` / `LogoMark`, which DREW it as inline SVG. Inline SVG has no URL and cannot 404. The
 * revamp replaced it with a raster fetched by URL and added `/story/*.webp` alongside. Nothing
 * about the proxy changed; the number of assets that could 404 went from zero to three.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS MIRRORS assetPrefix RATHER THAN HARDCODING AN ORIGIN
 * ─────────────────────────────────────────────────────────────────────────────
 * `next.config.mjs` deliberately lets a self-hoster set `NEXT_PUBLIC_ASSET_PREFIX=` (empty) so
 * their container serves its own assets instead of fetching them from aeo.advancelabs.dev,
 * which would be both a hard dependency on someone else's origin and a privacy leak. If this
 * helper hardcoded the hosted origin it would silently reintroduce exactly that, for images.
 * So the precedence below is the same, and the two must be changed together.
 *
 * `NEXT_PUBLIC_` is required for the value to be inlined into the client bundle. The bare
 * `assetPrefix` in next.config is build-time config and is not readable from component code.
 */

/**
 * The origin `public/` files are served from, or `''` to keep paths root-relative.
 *
 * Precedence, matching `assetPrefix` in `next.config.mjs`:
 *   1. `NEXT_PUBLIC_ASSET_PREFIX` set (including to empty) wins. Empty means "serve from my
 *      own origin", which is what the Docker image sets.
 *   2. Production defaults to the hosted origin, so proxied pages resolve correctly.
 *   3. Development stays relative, because `next dev` serves from localhost.
 */
export const ASSET_ORIGIN: string =
  process.env.NEXT_PUBLIC_ASSET_PREFIX !== undefined
    ? process.env.NEXT_PUBLIC_ASSET_PREFIX
    : process.env.NODE_ENV === 'production'
      ? 'https://aeo.advancelabs.dev'
      : '';

/**
 * Resolve a `public/` path to a URL that works on this origin AND through the proxy.
 *
 * Use for every file under `public/`. Do not hand-write a root-relative src for one; it will
 * work in every place you are likely to test it and 404 on the domain most visitors use.
 *
 *   assetUrl('/advance-labs-mark-256.png')
 *     dev         -> '/advance-labs-mark-256.png'
 *     production  -> 'https://aeo.advancelabs.dev/advance-labs-mark-256.png'
 *     self-hosted -> '/advance-labs-mark-256.png'
 *
 * @param path Root-relative path beginning with `/`, exactly as it sits in `public/`.
 */
export function assetUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`assetUrl expects a root-relative path starting with "/", got: ${path}`);
  }
  return `${ASSET_ORIGIN}${path}`;
}
