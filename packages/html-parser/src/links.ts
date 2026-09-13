/** Link extraction with internal/external and nofollow classification. */
import type { CheerioAPI } from 'cheerio';
import type { HreflangEntry, LinkInfo } from '@advance-labs/types';

import { isInternalLink, resolveUrl } from './url-utils.js';

/** Whether a `rel` attribute marks the link nofollow (token-aware, case-insensitive). */
function isNofollow(rel: string | undefined): boolean {
  if (rel === undefined) return false;
  return rel.toLowerCase().split(/\s+/).includes('nofollow');
}

/**
 * Extract anchor links with a resolved href, classified internal/external by
 * comparing host against the page URL's host, plus nofollow from `rel`.
 *
 * Anchors without an `href`, and pure in-page fragment links (`#section`), are
 * skipped — they are not navigational links to other resources.
 */
export function extractLinks($: CheerioAPI, pageUrl: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  $('a[href]').each((_, el) => {
    const $el = $(el);
    const rawHref = $el.attr('href')?.trim();
    if (rawHref === undefined || rawHref.length === 0) return;
    if (rawHref.startsWith('#')) return;

    const href = resolveUrl(rawHref, pageUrl);
    const rel = $el.attr('rel')?.trim();
    const text = $el.text().replace(/\s+/g, ' ').trim();

    links.push({
      href,
      text,
      rel: rel !== undefined && rel.length > 0 ? rel : undefined,
      internal: isInternalLink(href, pageUrl),
      nofollow: isNofollow(rel),
    });
  });
  return links;
}

/**
 * Extract `<link rel="alternate" hreflang="…" href="…">` annotations in document order.
 *
 * The hreflang value is kept exactly as authored (case preserved) so a validator can
 * report the offending string verbatim; the href is resolved against the page URL.
 * Elements missing either attribute are skipped — there is nothing to validate.
 * `rel` is matched token-aware and case-insensitively, so `rel="ALTERNATE stylesheet"`
 * still counts and `rel="alternates"` does not.
 */
export function extractHreflangs($: CheerioAPI, pageUrl: string): HreflangEntry[] {
  const entries: HreflangEntry[] = [];
  $('link[hreflang][href]').each((_, el) => {
    const $el = $(el);
    const rel = $el.attr('rel')?.trim().toLowerCase().split(/\s+/) ?? [];
    if (!rel.includes('alternate')) return;

    const hreflang = $el.attr('hreflang')?.trim();
    const rawHref = $el.attr('href')?.trim();
    if (hreflang === undefined || hreflang.length === 0) return;
    if (rawHref === undefined || rawHref.length === 0) return;

    entries.push({ hreflang, href: resolveUrl(rawHref, pageUrl) });
  });
  return entries;
}

/** Count of links classified as internal. */
export function internalLinkCount(links: LinkInfo[]): number {
  return links.filter((link) => link.internal).length;
}

/** Count of links classified as external. */
export function externalLinkCount(links: LinkInfo[]): number {
  return links.filter((link) => !link.internal).length;
}
