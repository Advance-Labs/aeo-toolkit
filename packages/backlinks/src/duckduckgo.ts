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

// STUB: fragile selectors — DDG's HTML endpoint historically renders each result
// inside `.result` with the link in `.result__a` and the snippet in
// `.result__snippet`, but it has shipped variants (`.web-result`, `.links_main`,
// bare `<h2><a>` blocks). We try the known shapes in order and fall back to a
// generic anchor sweep so a class-name change degrades to *fewer* results rather
// than zero. Any miss still yields an empty list (no throw).
const RESULT_CONTAINER_SELECTORS = ['.result', '.web-result', '.links_main', '.result__body'];
const RESULT_ANCHOR_SELECTORS = ['a.result__a', 'a.result__url', 'h2 a', 'a[href]'];
const RESULT_SNIPPET_SELECTORS = ['.result__snippet', '.result__extras', '.snippet'];

/** True when the href points somewhere we'd never want to surface as a result. */
function isJunkHref(href: string): boolean {
  if (href === '' || href === '#') return true;
  const lowered = href.toLowerCase();
  return lowered.startsWith('javascript:') || lowered.startsWith('mailto:');
}

/**
 * Parse a DuckDuckGo HTML results page into structured results. Pure: takes raw
 * HTML, returns results — no network. Exported for direct unit testing against
 * fixtures.
 *
 * Robustness: we walk a list of known container selectors (DDG has shipped a few
 * over time) and, inside each, try the known anchor/snippet selectors in order.
 * If *no* container matches at all we fall back to scanning bare `h2 > a` heading
 * anchors. Duplicate URLs are collapsed so the fallback sweep never inflates the
 * count, and every branch degrades to an empty array rather than throwing.
 */
export function parseResults(html: string): SearchResult[] {
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  const push = (url: string, title: string, snippet: string): void => {
    if (!url || !title || seen.has(url)) return;
    seen.add(url);
    results.push({ title, url, snippet });
  };

  const containerSelector = RESULT_CONTAINER_SELECTORS.join(', ');
  $(containerSelector).each((_i, el) => {
    const $el = $(el);

    let anchor = $el.find('a').first();
    for (const sel of RESULT_ANCHOR_SELECTORS) {
      const candidate = $el.find(sel).first();
      const href = candidate.attr('href');
      if (href && !isJunkHref(href)) {
        anchor = candidate;
        break;
      }
    }

    const rawHref = anchor.attr('href');
    if (!rawHref || isJunkHref(rawHref)) return;
    const url = unwrapRedirect(rawHref);
    const title = anchor.text().trim();

    let snippet = '';
    for (const sel of RESULT_SNIPPET_SELECTORS) {
      const text = $el.find(sel).first().text().trim();
      if (text !== '') {
        snippet = text;
        break;
      }
    }

    push(url, title, snippet);
  });

  // Last-ditch fallback: if container selectors matched nothing, scan heading
  // anchors directly. DDG's bare-bones markup still wraps result links in `h2`.
  if (results.length === 0) {
    $('h2 a[href]').each((_i, el) => {
      const $a = $(el);
      const rawHref = $a.attr('href');
      if (!rawHref || isJunkHref(rawHref)) return;
      push(unwrapRedirect(rawHref), $a.text().trim(), '');
    });
  }

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
    lowered.includes('bots use duckduckgo too') ||
    lowered.includes('if this error persists') ||
    lowered.includes('too many requests') ||
    lowered.includes('rate limit')
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
