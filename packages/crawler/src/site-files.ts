import type { SiteFilePresence, Url } from '@advance-labs/types';
import type { Fetcher } from './fetcher.js';
import { fetchResource } from './fetch-resource.js';
import { DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_USER_AGENT } from './constants.js';

export interface DetectSiteFilesOptions {
  fetcher?: Fetcher;
  requestTimeoutMs?: number;
  userAgent?: string;
}

/** The well-known crawl-hint / trust files probed at a site root, mapped to their presence keys. */
const SITE_FILES: ReadonlyArray<{ path: string; key: keyof SiteFilePresence }> = [
  { path: '/robots.txt', key: 'robotsTxt' },
  { path: '/sitemap.xml', key: 'sitemapXml' },
  { path: '/llms.txt', key: 'llmsTxt' },
  { path: '/llms-full.txt', key: 'llmsFullTxt' },
  { path: '/favicon.ico', key: 'favicon' },
];

/**
 * Detect which key crawl-hint / trust files exist at a site root. Probes each path with a HEAD
 * request first (cheap); if the server rejects HEAD (405 / 501) it retries with GET. A file is
 * "present" when the final response is a 2xx AND is not an HTML page. Runs all probes
 * concurrently.
 */
export async function detectSiteFiles(
  rootUrl: Url,
  opts: DetectSiteFilesOptions = {},
): Promise<SiteFilePresence> {
  const origin = originOf(rootUrl);
  const timeout = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;

  const results = await Promise.all(
    SITE_FILES.map(async ({ path, key }) => {
      const present = await probe(origin + path, opts.fetcher, timeout, userAgent);
      return [key, present] as const;
    }),
  );

  const presence: SiteFilePresence = {
    robotsTxt: false,
    sitemapXml: false,
    llmsTxt: false,
    llmsFullTxt: false,
    favicon: false,
  };
  for (const [key, present] of results) presence[key] = present;
  return presence;
}

/**
 * Whether a 2xx response is actually the requested file rather than an HTML page.
 *
 * Single-page apps routinely serve a catch-all route: every unmatched path returns 200
 * with the app shell. A status-only check therefore reports llms.txt, robots.txt and
 * sitemap.xml as PRESENT on any such site, which is the opposite of the truth and is
 * silent — the audit reports a pass for a file that does not exist.
 *
 * None of these files is ever legitimately served as HTML, so rejecting `text/html` fixes
 * the false positive without risking a false negative. A missing content-type is treated
 * as present: some static hosts omit it on HEAD, and refusing those would trade this bug
 * for the opposite one.
 */
function isNotHtml(contentType: string | undefined): boolean {
  if (contentType === undefined) return true;
  return !contentType.toLowerCase().includes('text/html');
}

/** HEAD-probe a URL, falling back to GET when the server does not support HEAD. */
async function probe(
  url: Url,
  fetcher: Fetcher | undefined,
  requestTimeoutMs: number,
  userAgent: string,
): Promise<boolean> {
  const head = await fetchResource(url, {
    fetcher,
    method: 'HEAD',
    requestTimeoutMs,
    userAgent,
    includeBody: false,
  });
  if (head.ok) return isNotHtml(head.contentType);
  // Some servers reject HEAD; retry with a bodyless GET before concluding "absent".
  if (head.status === 405 || head.status === 501 || head.status === 0) {
    const get = await fetchResource(url, {
      fetcher,
      method: 'GET',
      requestTimeoutMs,
      userAgent,
      includeBody: false,
    });
    return get.ok && isNotHtml(get.contentType);
  }
  return false;
}

function originOf(url: Url): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, '');
  }
}
