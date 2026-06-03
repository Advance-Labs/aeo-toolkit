/**
 * Pipeline: CrawlResult (+ parsed HTML) → LlmsTxtManifest.
 *
 * This module is pure: it takes an already-fetched `CrawlResult`, parses each
 * page's HTML for a title/description, derives a site name + summary, groups the
 * pages into sections, and assembles the manifest. The actual network crawl
 * lives in `crawl.ts` (the I/O seam) so this stays unit-testable without a fetch.
 */
import type { CrawlResult, LlmsTxtEntry, LlmsTxtManifest, ParsedHtml } from '@aeo/types';
import { parseHtml } from '@aeo/html-parser';
import { groupIntoSections } from './sections';

export interface BuildManifestResult {
  manifest: LlmsTxtManifest;
  /** Parsed pages in crawl order — handed to `renderLlmsFullTxt` for the full variant. */
  pages: ParsedHtml[];
}

/** Derive a human-readable site name from the root URL's host. */
function deriveSiteName(rootUrl: string): string {
  let host: string;
  try {
    host = new URL(rootUrl).hostname;
  } catch {
    return rootUrl;
  }
  const bare = host.replace(/^www\./i, '');
  const label = bare.split('.')[0] ?? bare;
  if (label === '') return bare;
  // Title-case the primary label: "example" → "Example".
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Pick the best title for an entry: prefer the parsed `<title>`, fall back to the
 * first H1, then to a path-derived label, then to the URL itself.
 */
function deriveTitle(parsed: ParsedHtml): string {
  const metaTitle = parsed.meta.title?.trim();
  if (metaTitle) return metaTitle;

  const firstH1 = parsed.headings.find((heading) => heading.level === 1)?.text.trim();
  if (firstH1) return firstH1;

  try {
    const path = new URL(parsed.url).pathname;
    const last = path
      .split('/')
      .filter((segment) => segment !== '')
      .pop();
    if (last) return last.replace(/[-_]+/g, ' ').replace(/\.[a-z0-9]+$/i, '');
  } catch {
    // fall through
  }
  return parsed.url;
}

/** Parse a crawled page's body into `ParsedHtml`, or `undefined` if no body. */
function parseCrawledPage(url: string, body: string | undefined): ParsedHtml | undefined {
  if (body === undefined || body.trim() === '') return undefined;
  return parseHtml(body, url);
}

/**
 * Build an `LlmsTxtManifest` (plus the parsed pages) from a completed crawl.
 *
 * Only successful (`ok`, 2xx) HTML pages with a non-empty body are included.
 * The site summary is taken from the homepage's meta description when available.
 */
export function buildManifest(crawl: CrawlResult): BuildManifestResult {
  const parsedPages: ParsedHtml[] = [];

  for (const page of crawl.pages) {
    if (!page.ok) continue;
    const contentType = page.contentType ?? '';
    if (contentType !== '' && !contentType.includes('html')) continue;
    const parsed = parseCrawledPage(page.finalUrl || page.url, page.body);
    if (parsed) parsedPages.push(parsed);
  }

  const entries: LlmsTxtEntry[] = parsedPages.map((parsed) => {
    const description = parsed.meta.description?.trim();
    const entry: LlmsTxtEntry = {
      title: deriveTitle(parsed),
      url: parsed.url,
    };
    if (description) entry.description = description;
    return entry;
  });

  const sections = groupIntoSections(entries);
  const siteName = deriveSiteName(crawl.rootUrl);

  // Summary: prefer the homepage's meta description, else its OG description.
  const homepage = parsedPages.find(
    (parsed) => parsed.url === crawl.rootUrl || isRootPath(parsed.url),
  );
  const summary =
    homepage?.meta.description?.trim() || homepage?.openGraph.description?.trim() || undefined;

  const manifest: LlmsTxtManifest = {
    siteName,
    sections,
  };
  if (summary) manifest.summary = summary;

  return { manifest, pages: parsedPages };
}

/** True when the URL's path is the site root ("/" or empty). */
function isRootPath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return path === '' || path === '/';
  } catch {
    return false;
  }
}
