/** Row types for the twelve read-only Bing Webmaster Tools JSON API methods. */

/** From `GetUserSites`. */
export interface BingSite {
  url: string;
  isVerified: boolean;
}

/** From `GetRankAndTrafficStats`. */
export interface BingTrafficPoint {
  date: string;
  clicks: number;
  impressions: number;
}

/** From `GetQueryStats` and `GetPageQueryStats`. */
export interface BingQueryStat {
  query: string;
  clicks: number;
  impressions: number;
  /**
   * `null` when Bing reported no usable position. Bing's wire sentinel for this is
   * `-1` (verified live 2026-09-09: every zero-click row carries
   * `AvgClickPosition: -1`), which is not a position and must never reach a caller
   * as one. Normalized at the client boundary so no consumer has to know the
   * sentinel exists.
   */
  avgClickPosition: number | null;
  /** `null` when Bing reported no usable position. See `avgClickPosition`. */
  avgImpressionPosition: number | null;
  date: string | null;
}

/** From `GetPageStats` and `GetQueryPageStats`. */
export interface BingPageStat {
  page: string;
  clicks: number;
  impressions: number;
  /** `null` when Bing reported no usable position. See `BingQueryStat`. */
  avgClickPosition: number | null;
  /** `null` when Bing reported no usable position. See `BingQueryStat`. */
  avgImpressionPosition: number | null;
}

/** From `GetCrawlStats`. */
export interface BingCrawlPoint {
  date: string;
  crawledPages: number;
  inIndex: number;
  inLinks: number;
  blockedByRobotsTxt: number;
  codes4xx: number;
  codes5xx: number;
}

/** From `GetCrawlIssues`. */
export interface BingCrawlIssue {
  url: string;
  issues: number;
}

/** From `GetUrlInfo`. */
export interface BingUrlInfo {
  url: string;
  discoveredDate: string | null;
  documentSize: number;
  httpStatus: number;
  isPageIndexed: boolean;
  lastCrawledDate: string | null;
}

/** From `GetUrlSubmissionQuota`. */
export interface BingQuota {
  dailyQuota: number;
  monthlyQuota: number;
}

/** From `GetKeywordStats` and `GetRelatedKeywords`. */
export interface BingKeywordStat {
  query: string;
  impressions: number;
  broadImpressions: number;
}
