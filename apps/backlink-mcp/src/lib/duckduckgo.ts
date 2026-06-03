/**
 * DuckDuckGo HTML-endpoint search adapter.
 *
 * DuckDuckGo exposes a no-JavaScript HTML results page at
 * `https://html.duckduckgo.com/html/?q=<query>`. We POST/GET the query and parse
 * the result anchors with cheerio. This is inherently brittle: DDG can change its
 * markup or block aggressive scraping at any time. Every fragile selector is
 * marked `// STUB:` and the parser degrades to an empty list rather than throwing,
 * so the calling tool always returns a structured result (with a warning).
 */
import * as cheerio from 'cheerio';
import type { HttpClient } from './http.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchOutcome {
  results: SearchResult[];
  /** Non-fatal problems (blocked, empty, parse-degraded) surfaced to the caller. */
  warnings: string[];
}

const DDG_HTML_ENDPOINT = 'https://html.duckduckgo.com/html/';

/** Build the DuckDuckGo HTML search URL for a query. */
export function buildSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query });
  return `${DDG_HTML_ENDPOINT}?${params.toString()}`;
}

/**
 * DuckDuckGo wraps outbound result links in a redirect of the form
 * `//duckduckgo.com/l/?uddg=<encoded target>&...`. Unwrap it back to the real
 * destination; if the shape is unfamiliar, return the href unchanged.
 */
export function unwrapRedirect(href: string): string {
  try {
    // Protocol-relative hrefs need a base to parse.
    const normalized = href.startsWith('//') ? `https:${href}` : href;
    const u = new URL(normalized, DDG_HTML_ENDPOINT);
    if (u.pathname.includes('/l/') && u.searchParams.has('uddg')) {
      const target = u.searchParams.get('uddg');
      if (target) return decodeURIComponent(target);
    }
    return normalized;
  } catch {
    return href;
  }
}

/**
 * Parse a DuckDuckGo HTML results page into structured results. Pure: takes raw
 * HTML, returns results — no network. Exported for direct unit testing against
 * fixtures.
 */
export function parseResults(html: string): SearchResult[] {
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  // STUB: fragile selector — DDG's HTML endpoint renders each result inside
  // `.result` with the link in `.result__a` and the snippet in `.result__snippet`.
  // If DDG changes these class names this yields zero results (degrades, no throw).
  $('.result').each((_i, el) => {
    const anchor = $(el).find('a.result__a').first();
    const rawHref = anchor.attr('href');
    if (!rawHref) return;
    const url = unwrapRedirect(rawHref);
    const title = anchor.text().trim();
    const snippet = $(el).find('.result__snippet').first().text().trim();
    if (url && title) {
      results.push({ title, url, snippet });
    }
  });

  return results;
}

/**
 * Detect DuckDuckGo's "blocked / anomaly" interstitial so we can warn instead of
 * silently returning zero results that look like "no matches".
 */
function looksBlocked(html: string): boolean {
  const lowered = html.toLowerCase();
  return (
    lowered.includes('anomaly') ||
    lowered.includes('blocked') ||
    lowered.includes('unfortunately, bots use duckduckgo too')
  );
}

/**
 * Run a DuckDuckGo HTML search through the injectable `HttpClient`. Never throws:
 * network failure, a block page, or an empty parse all degrade to `results: []`
 * plus an explanatory warning.
 */
export async function search(http: HttpClient, query: string, limit = 20): Promise<SearchOutcome> {
  const warnings: string[] = [];
  const trimmed = query.trim();
  if (trimmed === '') {
    return { results: [], warnings: ['Empty search query.'] };
  }

  const res = await http.getText(buildSearchUrl(trimmed), {
    accept: 'text/html',
  });

  if (!res.ok || res.body === '') {
    warnings.push(
      `DuckDuckGo request failed (status ${res.status}). Returning no results; try again later.`,
    );
    return { results: [], warnings };
  }

  if (looksBlocked(res.body)) {
    warnings.push('DuckDuckGo returned a block/anomaly page; rate-limited. Returning no results.');
    return { results: [], warnings };
  }

  const parsed = parseResults(res.body);
  if (parsed.length === 0) {
    warnings.push(
      'No results parsed. DuckDuckGo markup may have changed, or the query had no matches.',
    );
  }

  return { results: parsed.slice(0, limit), warnings };
}
