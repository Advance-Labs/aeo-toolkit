/**
 * Same-origin crawl-hint file fetcher.
 *
 * The ONLY network I/O the extension performs: fetching robots.txt,
 * sitemap.xml, and llms.txt (+ llms-full.txt, favicon HEAD) from the active
 * tab's own origin. Isolated behind {@link SiteFileFetcher} so the context
 * builder is pure and unit-testable with a fake fetcher.
 */

/** Result of probing one same-origin file. */
export interface FetchedFile {
  /** Text body when the file exists (2xx), otherwise null. */
  body: string | null;
  /** True when the resource responded 2xx. */
  exists: boolean;
}

/** The set of crawl-hint files probed for an origin. */
export interface SiteFiles {
  robotsTxt: FetchedFile;
  sitemapXml: FetchedFile;
  llmsTxt: FetchedFile;
  llmsFullTxt: FetchedFile;
  favicon: FetchedFile;
}

/** Typed seam for site-file I/O — real impl uses `fetch`, tests use a fake. */
export interface SiteFileFetcher {
  fetchSiteFiles(origin: string): Promise<SiteFiles>;
}

const ABSENT: FetchedFile = { body: null, exists: false };

/**
 * Real fetcher running inside the MV3 background service worker. Each probe is
 * best-effort: a network error or non-2xx response yields an "absent" file
 * rather than failing the whole audit.
 */
export class HttpSiteFileFetcher implements SiteFileFetcher {
  constructor(private readonly doFetch: typeof fetch = fetch.bind(globalThis)) {}

  async fetchSiteFiles(origin: string): Promise<SiteFiles> {
    const base = origin.replace(/\/$/, '');
    const [robotsTxt, sitemapXml, llmsTxt, llmsFullTxt, favicon] = await Promise.all([
      this.probeText(`${base}/robots.txt`),
      this.probeText(`${base}/sitemap.xml`),
      this.probeText(`${base}/llms.txt`),
      this.probeText(`${base}/llms-full.txt`),
      this.probeHead(`${base}/favicon.ico`),
    ]);
    return { robotsTxt, sitemapXml, llmsTxt, llmsFullTxt, favicon };
  }

  private async probeText(url: string): Promise<FetchedFile> {
    try {
      const res = await this.doFetch(url, { method: 'GET', redirect: 'follow' });
      if (!res.ok) return ABSENT;
      const body = await res.text();
      return { body, exists: true };
    } catch {
      return ABSENT;
    }
  }

  private async probeHead(url: string): Promise<FetchedFile> {
    try {
      const res = await this.doFetch(url, { method: 'HEAD', redirect: 'follow' });
      return { body: null, exists: res.ok };
    } catch {
      return ABSENT;
    }
  }
}
