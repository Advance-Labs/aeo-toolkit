import type { SiteFilePresence, Url } from '@aeo/types';
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
 * "present" when the final response is a 2xx. Runs all probes concurrently.
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
  if (head.ok) return true;
  // Some servers reject HEAD; retry with a bodyless GET before concluding "absent".
  if (head.status === 405 || head.status === 501 || head.status === 0) {
    const get = await fetchResource(url, {
      fetcher,
      method: 'GET',
      requestTimeoutMs,
      userAgent,
      includeBody: false,
    });
    return get.ok;
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
