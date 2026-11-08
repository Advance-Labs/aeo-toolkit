import type { Url } from '@advance-labs/types';

/**
 * Independent, dependency-free href extraction. Deliberately does NOT use `@advance-labs/html-parser`:
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
    if (isNofollowTag(html, match.index ?? 0)) continue;

    const resolved = resolveHref(href, baseUrl);
    if (!resolved) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push(resolved);
  }

  return out;
}

const REL_RE = /(?<![\w-])rel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/** Whether the tag containing `index` is an `<a>` carrying `rel="nofollow"`. */
function isNofollowTag(html: string, index: number): boolean {
  const start = html.lastIndexOf('<', index);
  const end = html.indexOf('>', index);
  if (start === -1 || end === -1) return false;
  const tag = html.slice(start, end + 1);
  if (!/^<a[\s>]/i.test(tag)) return false;
  const rel = REL_RE.exec(tag);
  const value = rel?.[1] ?? rel?.[2] ?? rel?.[3] ?? '';
  return value.toLowerCase().split(/\s+/).includes('nofollow');
}

const META_ROBOTS_RE = /<meta\b[^>]*\bname\s*=\s*["']?robots["']?[^>]*>/gi;
const CONTENT_RE = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/**
 * Whether a page asks crawlers not to follow its links: `nofollow` or `none` in a robots meta tag
 * or an X-Robots-Tag header. A `noindex`-only page still has its links followed.
 */
export function pageForbidsFollow(headers: Record<string, string>, html: string | undefined): boolean {
  const values: string[] = [];
  const header = headers['x-robots-tag'];
  if (header) {
    // "googlebot: nofollow" is aimed at one agent; only unprefixed and search-engine ones count.
    for (const part of header.toLowerCase().split(',')) {
      const m = /^\s*([a-z0-9._-]+)\s*:\s*(.+)$/.exec(part);
      if (!m) values.push(part);
      else if (m[1] === 'googlebot' || m[1] === 'bingbot') values.push(m[2] ?? '');
    }
  }
  for (const tag of (html ?? '').match(META_ROBOTS_RE) ?? []) {
    const c = CONTENT_RE.exec(tag);
    values.push((c?.[1] ?? c?.[2] ?? '').toLowerCase());
  }
  return values
    .flatMap((v) => v.split(','))
    .map((t) => t.trim())
    .some((t) => t === 'nofollow' || t === 'none');
}

/**
 * Canonical frontier key for a URL: parsed and re-serialised (so an empty path becomes `/`, the
 * host is lower-cased and default ports dropped) with the fragment stripped. The query string is
 * kept, and a trailing slash on a non-root path is NOT touched: `/a` and `/a/` are different
 * resources. Unparseable input is returned unchanged.
 */
export function canonicalUrl(url: Url): Url {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
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
  return canonicalUrl(url.toString());
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
