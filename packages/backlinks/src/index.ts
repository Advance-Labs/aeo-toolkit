/**
 * @aeo/backlinks — a free-source backlink engine.
 *
 * Provider adapters over the public, no-key sources (DuckDuckGo HTML search,
 * CommonCrawl's URL index, the Wayback Machine CDX API) plus pure contact
 * extraction, an injectable HTTP seam (with a rate-limited decorator), and a
 * builder that assembles those signals into a sampled, layered backlink graph.
 *
 * Every adapter routes network I/O through the injectable {@link HttpClient} and
 * degrades gracefully (failures become `warnings[]`, never throws), so consumers
 * and tests stay network-free.
 */

// --- HTTP seam ---
export { createLiveHttpClient } from './http.js';
export type { HttpClient, TextResponse, LiveHttpClientOptions } from './http.js';
export { createRateLimitedHttpClient } from './rate-limited-http.js';

// --- DuckDuckGo provider ---
export { search, parseResults, unwrapRedirect, buildSearchUrl } from './duckduckgo.js';
export type { SearchResult, SearchOutcome } from './duckduckgo.js';

// --- CommonCrawl provider ---
export { queryIndex, parseNdjson, buildIndexUrl, DEFAULT_CC_INDEX } from './commoncrawl.js';
export type { CommonCrawlCapture, CommonCrawlOutcome, CommonCrawlOptions } from './commoncrawl.js';

// --- Wayback provider ---
export { fetchHistory, parseCdx, timestampToIso, buildCdxUrl } from './wayback.js';
export type { WaybackSnapshot, WaybackOutcome } from './wayback.js';

// --- Contact extraction ---
export { extractContacts, extractEmails, extractSocials } from './contacts.js';
export type { ContactInfo, SocialHandle, SocialNetwork } from './contacts.js';

// --- Graph builder ---
export { buildBacklinkGraph, canonicalUrl, normalizeDomain } from './build-graph.js';
export type { BuildBacklinkGraphOptions, BacklinkSource } from './build-graph.js';

// --- Graph types ---
export type {
  GraphNode,
  GraphNodeType,
  GraphEdge,
  GraphEdgeKind,
  MentionType,
  BacklinkGraph,
  BacklinkGraphStats,
} from './graph-types.js';
