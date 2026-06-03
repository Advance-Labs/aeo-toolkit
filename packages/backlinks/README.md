# @aeo/backlinks

A free-source backlink engine for the AEO Toolkit. It gathers backlink and brand-mention signals
from the public, no-key sources — DuckDuckGo's HTML results page, CommonCrawl's URL index, and the
Internet Archive's Wayback CDX API — extracts contact info from pages, and assembles the signals
into a sampled, layered **backlink graph**.

There is no free, complete backlink index, so every result is explicitly directional (`sampled:
true`), and every provider degrades gracefully: a blocked scrape, a dead index, or an empty parse
becomes a `warnings[]` entry, never a thrown error. All network I/O routes through an injectable
`HttpClient`, so callers and tests never need a live network.

## Usage

```ts
import { buildBacklinkGraph, search, queryIndex, fetchHistory } from '@aeo/backlinks';

// Build a sampled backlink graph (uses the package's live HTTP client by default).
const graph = await buildBacklinkGraph('https://example.com', { limit: 25 });
console.log(graph.stats.referringDomains, 'referring domains');
console.log(graph.stats.dofollowRatio); // fraction of backlinks that are dofollow
console.log(graph.stats.topSources);    // [{ domain, count }, ...]
if (graph.warnings) console.warn(graph.warnings); // any degraded sources

// Inject a fake HttpClient in tests — no real network.
const graph2 = await buildBacklinkGraph('https://example.com', { http: myFakeClient });

// Or call the providers directly.
const { results } = await search(http, '"example.com" -site:example.com', 20);
const { captures } = await queryIndex(http, 'example.com');
const history = await fetchHistory(http, 'https://example.com/');
```

## Public API

| Export | Kind | Description |
| --- | --- | --- |
| `buildBacklinkGraph(rootUrl, opts?)` | `Promise<BacklinkGraph>` | Fans out the providers, normalises + de-dups by canonical url/domain, aggregates to a domain layer, computes stats. Degrades gracefully. |
| `search(http, query, limit?)` | `Promise<SearchOutcome>` | DuckDuckGo HTML search adapter. |
| `queryIndex(http, domain, opts?)` | `Promise<CommonCrawlOutcome>` | CommonCrawl URL-index adapter. |
| `fetchHistory(http, url, limit?)` | `Promise<WaybackOutcome>` | Wayback Machine CDX timeline adapter. |
| `extractContacts(html, baseUrl)` | `ContactInfo` | Pure emails + social-handle extraction from page HTML. |
| `createLiveHttpClient(opts)` | `HttpClient` | The production HTTP seam (delegates page fetches to `@aeo/crawler`). |
| `createRateLimitedHttpClient(inner, limiter, key?)` | `HttpClient` | Rate-limited decorator over an inner client (uses `@aeo/storage`'s `RateLimiter`). |
| `canonicalUrl`, `normalizeDomain` | helpers | URL/domain canonicalisation used by the graph builder. |
| `parseResults`, `parseNdjson`, `parseCdx`, `extractEmails`, `extractSocials`, … | pure parsers | Exported for direct, network-free unit testing. |
| `BacklinkGraph`, `GraphNode`, `GraphEdge`, `BacklinkGraphStats`, `HttpClient`, … | types | Graph shapes and the injectable I/O seam. |

`PageResource` and the LLM/types shapes come from `@aeo/types`; the rate limiter comes from
`@aeo/storage`; page fetches delegate to `@aeo/crawler`. This package never redefines them.

## Status

**Implemented.** No stubs in the public surface. The fragile scraping selectors (DuckDuckGo markup,
CommonCrawl NDJSON, CDX rows) are marked `// STUB:` inline and always degrade to fewer results plus
a warning rather than throwing. The single I/O seam is the injectable `HttpClient`; pass a fake in
tests to stay network-free.
