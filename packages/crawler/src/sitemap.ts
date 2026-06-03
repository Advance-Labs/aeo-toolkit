import { XMLParser } from 'fast-xml-parser';
import type { SitemapEntry, Url } from '@aeo/types';

/**
 * Parses a sitemap XML document into a flat list of `SitemapEntry`. Supports both:
 *   - `<urlset>` — a normal sitemap listing page URLs.
 *   - `<sitemapindex>` — an index whose children are themselves sitemap URLs.
 *
 * For an index, each `<sitemap><loc>` becomes an entry (callers fetch and re-parse those).
 * Pure and synchronous: no network. Malformed XML yields an empty list rather than throwing,
 * so a broken sitemap never aborts a crawl.
 */
export function parseSitemap(xml: string): SitemapEntry[] {
  return parseSitemapDocument(xml).entries;
}

/** What kind of sitemap document was parsed — lets the crawler distinguish pages from nested sitemaps. */
export type SitemapKind = 'urlset' | 'sitemapindex' | 'unknown';

export interface ParsedSitemap {
  kind: SitemapKind;
  entries: SitemapEntry[];
}

/**
 * Internal variant of `parseSitemap` that also reports the document kind. `<sitemapindex>` entries
 * are nested sitemaps to fetch; `<urlset>` entries are page URLs. The public `parseSitemap` flattens
 * to just the entries (its documented contract).
 */
export function parseSitemapDocument(xml: string): ParsedSitemap {
  if (!xml || xml.trim().length === 0) return { kind: 'unknown', entries: [] };

  let parsed: unknown;
  try {
    parsed = SITEMAP_PARSER.parse(xml);
  } catch {
    return { kind: 'unknown', entries: [] };
  }
  if (!isRecord(parsed)) return { kind: 'unknown', entries: [] };

  // Sitemap index: <sitemapindex><sitemap><loc>…</loc></sitemap>…</sitemapindex>
  const index = parsed['sitemapindex'];
  if (isRecord(index)) {
    return { kind: 'sitemapindex', entries: toArray(index['sitemap']).flatMap(entryFromNode) };
  }

  // Standard sitemap: <urlset><url><loc>…</loc></url>…</urlset>
  const urlset = parsed['urlset'];
  if (isRecord(urlset)) {
    return { kind: 'urlset', entries: toArray(urlset['url']).flatMap(entryFromNode) };
  }

  return { kind: 'unknown', entries: [] };
}

/** Build a single `SitemapEntry` from a `<url>` or `<sitemap>` node; skip nodes lacking a usable `<loc>`. */
function entryFromNode(node: unknown): SitemapEntry[] {
  if (!isRecord(node)) return [];
  const loc = asUrl(node['loc']);
  if (!loc) return [];

  const entry: SitemapEntry = { loc };
  const lastmod = asString(node['lastmod']);
  if (lastmod) entry.lastmod = lastmod;
  const changefreq = asString(node['changefreq']);
  if (changefreq) entry.changefreq = changefreq;
  const priority = asNumber(node['priority']);
  if (priority !== undefined) entry.priority = priority;

  return [entry];
}

/**
 * fast-xml-parser collapses single-child collections into objects; force `url` and `sitemap`
 * to always be arrays so downstream code has one shape to handle. `parseTagValue` is off so a
 * `<loc>` like `2024` stays a string (URLs and dates must not be coerced to numbers).
 */
const SITEMAP_PARSER = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  parseTagValue: false,
  removeNSPrefix: true,
  isArray: (tagName: string): boolean => tagName === 'url' || tagName === 'sitemap',
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Normalize a possibly-single child into an array (handles parser's object-vs-array output). */
function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number') return String(value);
  return undefined;
}

function asUrl(value: unknown): Url | undefined {
  return asString(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
