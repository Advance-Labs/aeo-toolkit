/** Crawl domain — inputs and outputs of `@advance-labs/crawler`. */

/** A fully-qualified URL string. Kept as a branded-ish alias for readability. */
export type Url = string;

/** Names of known AI / LLM crawler user-agents we check for in robots.txt. */
export type AiBotName =
  | 'GPTBot'
  | 'ChatGPT-User'
  | 'OAI-SearchBot'
  | 'ClaudeBot'
  | 'Claude-Web'
  | 'anthropic-ai'
  | 'PerplexityBot'
  | 'Perplexity-User'
  | 'Google-Extended'
  | 'Applebot-Extended'
  | 'CCBot'
  | 'Bytespider'
  | 'Amazonbot'
  | 'meta-externalagent';

export interface CrawlOptions {
  /** Hard cap on pages fetched (50 for full audit, 12 for E-E-A-T, 1 for single-page). */
  maxPages: number;
  maxDepth?: number;
  concurrency?: number;
  requestTimeoutMs?: number;
  /** Minimum delay between requests to the same host. */
  perHostRateLimitMs?: number;
  userAgent?: string;
  respectRobotsTxt?: boolean;
  followSitemap?: boolean;
  includeSubdomains?: boolean;
}

export interface RedirectHop {
  url: Url;
  status: number;
}

/** Result of a single HTTP fetch. */
export interface PageResource {
  url: Url;
  finalUrl: Url;
  status: number;
  ok: boolean;
  contentType?: string;
  headers: Record<string, string>;
  body?: string;
  timingMs: number;
  redirectChain: RedirectHop[];
  error?: string;
}

export interface CrawledPage extends PageResource {
  depth: number;
  discoveredFrom?: Url;
}

export interface SitemapEntry {
  loc: Url;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
}

export interface RobotsGroup {
  userAgents: string[];
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export interface AiBotDirective {
  bot: AiBotName;
  /** Whether the bot is allowed to crawl the site root per robots.txt. */
  allowed: boolean;
}

export interface RobotsTxt {
  exists: boolean;
  url: Url;
  raw?: string;
  sitemaps: Url[];
  groups: RobotsGroup[];
  /** Convenience view of directives that target AI crawlers specifically. */
  aiBotDirectives: AiBotDirective[];
}

/** Presence of the key crawl-hint / trust files at a site root. */
export interface SiteFilePresence {
  robotsTxt: boolean;
  sitemapXml: boolean;
  llmsTxt: boolean;
  llmsFullTxt: boolean;
  favicon: boolean;
}

export interface CrawlResult {
  rootUrl: Url;
  https: boolean;
  pages: CrawledPage[];
  sitemap: SitemapEntry[];
  robots: RobotsTxt;
  filePresence: SiteFilePresence;
  startedAt: string;
  finishedAt: string;
  pageCount: number;
}
