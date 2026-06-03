/**
 * Re-export shim — the CommonCrawl adapter now lives in `@aeo/backlinks`.
 */
export { queryIndex, parseNdjson, buildIndexUrl, DEFAULT_CC_INDEX } from '@aeo/backlinks';
export type { CommonCrawlCapture, CommonCrawlOutcome, CommonCrawlOptions } from '@aeo/backlinks';
