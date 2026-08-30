/**
 * Tiny sitemap.xml `<loc>` extractor. We only need the entry list to populate
 * the `SitemapEntry[]` in the `CrawlResult`; full sitemap-index recursion is a
 * crawler concern, not an extension one.
 */
import type { SitemapEntry } from '@advance-labs/types';

/** Extract `<loc>` (and optional `<lastmod>`) entries from sitemap XML. */
export function parseSitemap(xml: string | null): SitemapEntry[] {
  if (xml === null) return [];
  const entries: SitemapEntry[] = [];
  const urlBlocks = xml.match(/<url\b[\s\S]*?<\/url>/gi) ?? [];

  if (urlBlocks.length > 0) {
    for (const block of urlBlocks) {
      const loc = firstTag(block, 'loc');
      if (loc === null) continue;
      const entry: SitemapEntry = { loc };
      const lastmod = firstTag(block, 'lastmod');
      if (lastmod !== null) entry.lastmod = lastmod;
      entries.push(entry);
    }
    return entries;
  }

  // Sitemap index (or a flat list of <loc> without <url> wrappers).
  const locs = xml.match(/<loc>([\s\S]*?)<\/loc>/gi) ?? [];
  for (const raw of locs) {
    const value = raw.replace(/<\/?loc>/gi, '').trim();
    if (value) entries.push({ loc: value });
  }
  return entries;
}

function firstTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  const value = match?.[1]?.trim();
  return value ? value : null;
}
