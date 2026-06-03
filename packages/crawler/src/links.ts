import type { Url } from '@aeo/types';

/**
 * Independent, dependency-free href extraction. Deliberately does NOT use `@aeo/html-parser`:
 * the crawler only needs to discover navigable links for its BFS frontier, and a tolerant regex
 * avoids a parse-tree dependency (and a dependency cycle) at this layer. Rich extraction
 * (meta, headings, structured data) is the html-parser's job, run later on captured bodies.
 */

// Matches `href="..."`, `href='...'`, or `href=bare` inside <a> (and any) tags. Case-insensitive.
const HREF_RE = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

/**
 * Extract absolute, http(s) links from an HTML body, resolved against `baseUrl`. Fragments,
 * `mailto:`/`tel:`/`javascript:` schemes, and non-http links are dropped. The hash is stripped
 * so `/a#x` and `/a#y` dedupe to one frontier entry. Returns a de-duplicated list.
 */
export function extractLinks(html: string, baseUrl: Url): Url[] {
  if (!html) return [];
  const seen = new Set<Url>();
  const out: Url[] = [];

  for (const match of html.matchAll(HREF_RE)) {
    const rawHref = match[2] ?? match[3] ?? match[4];
    if (rawHref === undefined) continue;
    const href = rawHref.trim();
    if (href.length === 0 || href.startsWith('#')) continue;

    const resolved = resolveHref(href, baseUrl);
    if (!resolved) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }

  return out;
}

/** Resolve + normalize a single href; returns `undefined` for non-http(s) or unparseable links. */
function resolveHref(href: string, baseUrl: Url): Url | undefined {
  let url: URL;
  try {
    url = new URL(href, baseUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  url.hash = '';
  return url.toString();
}

/** Whether `candidate` shares an origin with `root` (used to keep the crawl on-site). */
export function sameOrigin(candidate: Url, root: Url): boolean {
  try {
    return new URL(candidate).origin === new URL(root).origin;
  } catch {
    return false;
  }
}

/**
 * Whether `candidate`'s host is `root`'s host or a subdomain of it (e.g. `blog.example.com`
 * under `example.com`). Protocol-agnostic; used when `includeSubdomains` is enabled.
 */
export function sameRegistrableSite(candidate: Url, root: Url): boolean {
  try {
    const c = new URL(candidate).hostname;
    const r = new URL(root).hostname;
    return c === r || c.endsWith('.' + r);
  } catch {
    return false;
  }
}

/** Extract the host (for per-host rate limiting); empty string if unparseable. */
export function hostOf(url: Url): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}
