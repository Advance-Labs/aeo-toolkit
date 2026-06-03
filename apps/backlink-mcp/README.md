# @aeo/backlink-mcp

A free-source **backlink MCP server** — a no-cost alternative to paid link-index SaaS. It finds
brand mentions, link-building prospects, competitor link sources, and contacts using only free
sources (DuckDuckGo's HTML endpoint, the Wayback Machine CDX API, and direct page fetches), then
drafts personalized outreach emails through your own LLM key (BYOK). Built on
[`@aeo/mcp-core`](../../packages/mcp-core) with token-bucket rate limiting, and exposed over both
**stdio** (Claude Desktop, Cursor) and **HTTP/SSE** (hosted / Vercel) from one shared tool registry.

## Tools

| Tool | Input | What it does |
|------|-------|--------------|
| `find_mentions` | `{ brand, domain?, limit? }` | DuckDuckGo search for a brand; classifies results into linked vs unlinked mentions when a domain is given. With a domain, adds a `commonCrawlMentions` section of pages CommonCrawl has indexed on that domain (supplementary, de-duped). |
| `find_prospects` | `{ topic, limitPerAngle? }` | Runs classic link-building footprints (write-for-us, resource pages, roundups) and merges prospects by host. |
| `find_competitor_link_sources` | `{ competitorUrl, limit? }` | Approximates third-party pages linking to a competitor via free DuckDuckGo signals, plus a `commonCrawlPages` list of the competitor's own indexed URLs (supplementary, free). |
| `verify_page_links` | `{ url, targetDomain }` | Fetches a page (via `@aeo/crawler`) and confirms a link to the target domain, with rel/dofollow detail. |
| `extract_contact_info` | `{ url }` | Extracts emails (incl. `mailto:` and de-obfuscated) and social handles from a page. |
| `check_page_history` | `{ url, limit? }` | Wayback Machine CDX timeline: total snapshots, first/last seen, archive links. |
| `generate_outreach_email` | `{ contact, context, provider, model, apiKey, ... }` | Drafts a short, personalized cold email via `@aeo/llm` (BYOK). |

Every scraping tool **degrades gracefully**: a blocked search, a non-JSON archive response, a
malformed CommonCrawl line, or a failed fetch returns an empty result plus a `warnings[]` array —
never a thrown error.

### Free sources

| Source | Endpoint | Used by |
|--------|----------|---------|
| DuckDuckGo HTML | `html.duckduckgo.com/html/` | `find_mentions`, `find_prospects`, `find_competitor_link_sources` |
| Wayback CDX | `web.archive.org/cdx/search/cdx` | `check_page_history` |
| CommonCrawl index | `index.commoncrawl.org/<crawl>-index` (newline-delimited JSON) | `find_mentions`, `find_competitor_link_sources` (supplementary) |

### Rate limiting

Two layers keep scraping polite: a **per-tool-call token bucket** (`@aeo/mcp-core`, tuned by
`BACKLINK_RATE_*`) and a **per-outbound-request limiter** around the raw source GETs
(`@aeo/storage`'s `resolveRateLimiter`, tuned by `BACKLINK_SCRAPE_*`). The scrape limiter uses an
in-memory fixed window by default and an **Upstash Redis** sliding window — shared across serverless
instances — when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set. When the scrape limit
is hit, the request sheds politely (treated like a failed fetch: empty result + warning), never a
throw. The limiter fails *open* if its backend errors, so a Redis hiccup never takes the tool down.

## Running

```bash
# Local (stdio) — Claude Desktop / Cursor
pnpm --filter @aeo/backlink-mcp build
node dist/server.js

# Hosted (HTTP/SSE)
node dist/http.js          # POST /mcp ; GET /healthz ; GET /.well-known/oauth-*
```

### Claude Desktop config

```jsonc
{
  "mcpServers": {
    "backlink": { "command": "node", "args": ["/abs/path/to/dist/server.js"] }
  }
}
```

## Environment variables

All optional — the server runs with polite defaults and no credentials.

| Var | Default | Purpose |
|-----|---------|---------|
| `BACKLINK_RATE_CAPACITY` | `8` | Token-bucket capacity (max burst of tool calls). |
| `BACKLINK_RATE_REFILL_PER_SEC` | `1` | Tokens refilled per second — keeps scraping polite. |
| `BACKLINK_SCRAPE_LIMIT` | `30` | Max outbound scrape requests per window (the `@aeo/storage` limiter). |
| `BACKLINK_SCRAPE_WINDOW_SECONDS` | `60` | Scrape-limiter window length, in seconds. |
| `UPSTASH_REDIS_REST_URL` | unset | Enables the distributed (shared) scrape limiter when set with the token. |
| `UPSTASH_REDIS_REST_TOKEN` | unset | Upstash REST token (paired with the URL above). |
| `BACKLINK_CC_INDEX` | `CC-MAIN-2024-51` | CommonCrawl monthly index id to query (roll forward as crawls publish). |
| `BACKLINK_USER_AGENT` | honest default UA | Outbound User-Agent (identifies the client honestly). |
| `BACKLINK_REQUEST_TIMEOUT_MS` | `15000` | Per-request network timeout. |
| `PORT` | `3000` | HTTP listen port (`http.js` only). |
| `MCP_PUBLIC_URL` | `http://localhost:PORT` | Public origin for OAuth `.well-known` discovery (`BACKLINK_PUBLIC_URL` is a legacy alias). |
| `BACKLINK_AUTH_SERVER` | the public origin | External OAuth issuer for protected-resource metadata. |
| `BACKLINK_HTTP_NO_LISTEN` | unset | Set to `1` to import `http.ts` without auto-starting (serverless adapters). |

Both Upstash vars must be present together to enable distributed limiting; with neither (or only
one) the limiter falls back to the in-memory window — so local dev and tests need **no secrets**.
See [`.env.example`](./.env.example) for the full list. Secrets come only from the environment and
are never hard-coded or logged.

**BYOK:** `generate_outreach_email` takes the LLM `apiKey` **per request**. It is forwarded to
`@aeo/llm` and is never persisted or logged by this server.

## Deploy (Vercel, remote MCP)

The remote variant ships as two Vercel Functions plus a `vercel.json` that rewrites the public paths
onto them (mirroring the stdio/self-hosted routes):

- `api/mcp.ts` → `/mcp` — the Streamable-HTTP MCP endpoint (delegates to `handleMcpRequest`).
- `api/well-known.ts` → `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`.

Both run on the **Node.js** runtime (the crawler + LLM client need Node `fetch`/streams). Set
`MCP_PUBLIC_URL` to the deployment origin so the discovery documents advertise the right URLs, and
(optionally) `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for cross-instance rate limiting.

## Status

**Implemented:** all seven tools, the shared rate-limited registry, the configurable outbound scrape
limiter (`@aeo/storage` — Upstash in prod, in-memory fallback), the CommonCrawl supplementary source,
both transports (stdio + Streamable HTTP), the Vercel function entries + `vercel.json`, OAuth 2.1
`.well-known` discovery, pure parsers (DuckDuckGo results, Wayback CDX, CommonCrawl NDJSON, contact
extraction, link verification), and outreach prompt shaping over `@aeo/llm`. Vitest suites cover the
pure logic, the scrape limiter, and the tool handlers with mocked `@aeo/*`, Upstash, and network —
no live calls.

**Stubbed (`// STUB:`):** the inherently brittle scrape seams — DuckDuckGo result-page selectors, the
Wayback CDX body shape, and the CommonCrawl crawl id + per-line shape — are wrapped behind adapters,
marked in-code, hardened with fallback selectors / detection, and degrade to empty + warning rather
than throwing. The live network seam (`createLiveHttpClient`, wrapped by the rate limiter) is the
single I/O point; tests inject a fake `HttpClient` / limiter to stay network-free.
