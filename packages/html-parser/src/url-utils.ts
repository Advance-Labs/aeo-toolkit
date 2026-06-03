/**
 * URL helpers used by link/image extraction.
 *
 * These are intentionally pure and tolerant: malformed page URLs or hrefs must
 * never throw — extraction continues with the best information available.
 */

/** Parse a host out of a URL, returning `undefined` for anything unparseable. */
export function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Resolve a possibly-relative href against the page URL.
 *
 * Returns the original `href` untouched when resolution fails (e.g. the page
 * URL is itself malformed), so downstream extractors still see *something*.
 */
export function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/**
 * Whether a resolved link points at the same host as the page it lives on.
 *
 * Non-HTTP(S) schemes (mailto:, tel:, javascript:, #fragment) are treated as
 * non-internal navigations — they are not page-to-page links within the site.
 */
export function isInternalLink(resolvedHref: string, pageUrl: string): boolean {
  const linkHost = hostOf(resolvedHref);
  const pageHost = hostOf(pageUrl);
  if (linkHost === undefined || pageHost === undefined) return false;
  return linkHost === pageHost;
}
